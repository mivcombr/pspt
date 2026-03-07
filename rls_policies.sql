-- ============================================================
-- PSPT — POLÍTICAS RLS GRANULARES POR PAPEL
-- ============================================================
-- Execute este script inteiro no Supabase SQL Editor.
--
-- Papéis existentes na tabela profiles.role:
--   ADMIN     → acesso total a todos os dados de todos os hospitais
--   FINANCIAL → acesso financeiro limitado ao seu hospital
--   RECEPTION → gestão de atendimentos do seu hospital
--
-- IMPORTANTE: As funções get_my_role() e get_my_hospital_id() usam
-- SECURITY DEFINER para ler a tabela profiles SEM acionar o RLS dela,
-- evitando a recursão infinita que causou o disable_rls.sql original.
-- ============================================================


-- ============================================================
-- PASSO 1: FUNÇÕES AUXILIARES (anti-recursão)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_hospital_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT hospital_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ============================================================
-- PASSO 2: TABELA profiles
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"                            ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"                            ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"                            ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete"                            ON public.profiles;

-- Leitura: ADMIN vê todos; outros veem apenas o próprio perfil
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'ADMIN'
  );

-- Inserção: bloqueada para usuários comuns
-- (criação de usuários é feita pela Edge Function com service_role, que bypassa RLS)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- Atualização: usuário edita o próprio; ADMIN edita qualquer um
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'ADMIN'
  )
  WITH CHECK (
    id = auth.uid()
    OR public.get_my_role() = 'ADMIN'
  );

-- Exclusão: somente ADMIN
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'ADMIN');


-- ============================================================
-- PASSO 3: TABELA hospitals
-- ============================================================

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.hospitals;
DROP POLICY IF EXISTS "Allow public read on hospitals"             ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_select"                           ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_insert"                           ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_update"                           ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_delete"                           ON public.hospitals;

-- Leitura: ADMIN vê todos; RECEPTION/FINANCIAL veem apenas o seu hospital
CREATE POLICY "hospitals_select" ON public.hospitals
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR id = public.get_my_hospital_id()
  );

-- Escrita: somente ADMIN
CREATE POLICY "hospitals_insert" ON public.hospitals
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "hospitals_update" ON public.hospitals
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "hospitals_delete" ON public.hospitals
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'ADMIN');


-- ============================================================
-- PASSO 4: TABELA appointments
-- ============================================================

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only"    ON public.appointments;
DROP POLICY IF EXISTS "Allow authenticated read on appointments"      ON public.appointments;
DROP POLICY IF EXISTS "Admins can see all data"                       ON public.appointments;
DROP POLICY IF EXISTS "appointments_select"                           ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert"                           ON public.appointments;
DROP POLICY IF EXISTS "appointments_update"                           ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete"                           ON public.appointments;

-- Leitura: ADMIN vê tudo; RECEPTION e FINANCIAL veem apenas seu hospital
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR hospital_id = public.get_my_hospital_id()
  );

-- Criação: ADMIN (qualquer hospital) e RECEPTION (só seu hospital)
CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'RECEPTION'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

-- Atualização: ADMIN (qualquer) e RECEPTION (só seu hospital)
CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'RECEPTION'
      AND hospital_id = public.get_my_hospital_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'RECEPTION'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

-- Exclusão: somente ADMIN
CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'ADMIN');


-- ============================================================
-- PASSO 5: TABELA appointment_payments
-- Acesso herdado via hospital_id do atendimento vinculado
-- ============================================================

ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.appointment_payments;
DROP POLICY IF EXISTS "payments_select"                            ON public.appointment_payments;
DROP POLICY IF EXISTS "payments_insert"                            ON public.appointment_payments;
DROP POLICY IF EXISTS "payments_update"                            ON public.appointment_payments;
DROP POLICY IF EXISTS "payments_delete"                            ON public.appointment_payments;

CREATE POLICY "payments_select" ON public.appointment_payments
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_payments.appointment_id
        AND a.hospital_id = public.get_my_hospital_id()
    )
  );

-- Criação: ADMIN e RECEPTION (do próprio hospital)
CREATE POLICY "payments_insert" ON public.appointment_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'RECEPTION'
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = appointment_payments.appointment_id
          AND a.hospital_id = public.get_my_hospital_id()
      )
    )
  );

CREATE POLICY "payments_update" ON public.appointment_payments
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'RECEPTION'
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = appointment_payments.appointment_id
          AND a.hospital_id = public.get_my_hospital_id()
      )
    )
  );

CREATE POLICY "payments_delete" ON public.appointment_payments
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'RECEPTION'
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = appointment_payments.appointment_id
          AND a.hospital_id = public.get_my_hospital_id()
      )
    )
  );


-- ============================================================
-- PASSO 6: TABELA expenses
-- NOTA: Assume-se que a coluna hospital_id existe na tabela.
-- Se não existir, rode: ALTER TABLE expenses ADD COLUMN hospital_id UUID REFERENCES hospitals(id);
-- ============================================================

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.expenses;
DROP POLICY IF EXISTS "Allow authenticated read on expenses"       ON public.expenses;
DROP POLICY IF EXISTS "Admins can see all expenses"                ON public.expenses;
DROP POLICY IF EXISTS "expenses_select"                            ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert"                            ON public.expenses;
DROP POLICY IF EXISTS "expenses_update"                            ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete"                            ON public.expenses;

-- ADMIN vê tudo; FINANCIAL gerencia as do seu hospital; RECEPTION não acessa
CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );


-- ============================================================
-- PASSO 7: TABELA expense_categories
-- Tabela global (sem hospital_id) — gerenciada pelo ADMIN e FINANCIAL
-- ============================================================

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.expense_categories;
DROP POLICY IF EXISTS "categories_select"                          ON public.expense_categories;
DROP POLICY IF EXISTS "categories_insert"                          ON public.expense_categories;
DROP POLICY IF EXISTS "categories_update"                          ON public.expense_categories;
DROP POLICY IF EXISTS "categories_delete"                          ON public.expense_categories;

-- Todos os autenticados leem (necessário para criar despesas e atendimentos)
CREATE POLICY "categories_select" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (true);

-- Somente ADMIN e FINANCIAL podem criar e editar categorias
CREATE POLICY "categories_insert" ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'FINANCIAL'));

CREATE POLICY "categories_update" ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'FINANCIAL'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'FINANCIAL'));

-- Exclusão: somente ADMIN
CREATE POLICY "categories_delete" ON public.expense_categories
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'ADMIN');


-- ============================================================
-- PASSO 8: TABELA withdrawals (Rateios / Repasses)
-- NOTA: Assume-se que a coluna hospital_id existe na tabela.
-- Se não existir, rode: ALTER TABLE withdrawals ADD COLUMN hospital_id UUID REFERENCES hospitals(id);
-- ============================================================

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.withdrawals;
DROP POLICY IF EXISTS "Allow authenticated read on withdrawals"    ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_select"                         ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert"                         ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_update"                         ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_delete"                         ON public.withdrawals;

-- ADMIN vê tudo; FINANCIAL gerencia os do seu hospital
CREATE POLICY "withdrawals_select" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

CREATE POLICY "withdrawals_insert" ON public.withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

CREATE POLICY "withdrawals_update" ON public.withdrawals
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    OR (
      public.get_my_role() = 'FINANCIAL'
      AND hospital_id = public.get_my_hospital_id()
    )
  );

-- Exclusão: somente ADMIN
CREATE POLICY "withdrawals_delete" ON public.withdrawals
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'ADMIN');


-- ============================================================
-- PASSO 9: TABELA procedures_price_list
-- Tabela global — leitura para todos, escrita só para ADMIN
-- ============================================================

ALTER TABLE public.procedures_price_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.procedures_price_list;
DROP POLICY IF EXISTS "procedures_select"                          ON public.procedures_price_list;
DROP POLICY IF EXISTS "procedures_insert"                          ON public.procedures_price_list;
DROP POLICY IF EXISTS "procedures_update"                          ON public.procedures_price_list;
DROP POLICY IF EXISTS "procedures_delete"                          ON public.procedures_price_list;

-- Todos os autenticados leem (necessário para criar atendimentos)
CREATE POLICY "procedures_select" ON public.procedures_price_list
  FOR SELECT TO authenticated
  USING (true);

-- Somente ADMIN gerencia procedimentos
CREATE POLICY "procedures_insert" ON public.procedures_price_list
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "procedures_update" ON public.procedures_price_list
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "procedures_delete" ON public.procedures_price_list
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'ADMIN');


-- ============================================================
-- PASSO 10: TABELA appointment_audit_logs
-- ============================================================

ALTER TABLE public.appointment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on audit logs"   ON public.appointment_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated insert on audit logs" ON public.appointment_audit_logs;
DROP POLICY IF EXISTS "audit_select"                             ON public.appointment_audit_logs;
DROP POLICY IF EXISTS "audit_insert"                             ON public.appointment_audit_logs;

-- ADMIN vê tudo; outros veem apenas logs dos atendimentos do seu hospital
CREATE POLICY "audit_select" ON public.appointment_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_audit_logs.appointment_id
        AND a.hospital_id = public.get_my_hospital_id()
    )
  );

-- Inserção permitida a autenticados, mas changed_by deve ser o próprio usuário
CREATE POLICY "audit_insert" ON public.appointment_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());


-- ============================================================
-- VERIFICAÇÃO FINAL
-- Rode esta query para confirmar que as políticas foram criadas:
-- ============================================================
--
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   cmd,
--   qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

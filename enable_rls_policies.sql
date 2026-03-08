-- =========================================================================
-- PSPT — Enable RLS Policies (Role-Based Access per Hospital)
-- =========================================================================
-- 
-- REGRAS:
--   ADMIN       → acesso total (todas as tabelas, todos os hospitais)
--   RECEPTION   → acesso apenas aos dados do seu hospital_id
--   FINANCIAL   → acesso apenas aos dados do seu hospital_id
--
-- IMPORTANTE: Execute este script no Supabase SQL Editor.
--             Ele DESFAZ o que disable_rls.sql fez.
-- =========================================================================

-- -------------------------------------------------------------------------
-- PASSO 0: Função auxiliar para buscar o perfil do usuário autenticado
-- -------------------------------------------------------------------------
-- Usamos SECURITY DEFINER para que a função execute com privilégios do owner
-- (superuser/postgres), evitando recursão infinita quando a tabela profiles
-- também tem RLS habilitado.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (role TEXT, hospital_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role, hospital_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Garante que qualquer usuário autenticado possa chamar a função
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Funções auxiliares inline para uso nas policies (evita subconsultas repetidas)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_hospital_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hospital_id FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_hospital_id() TO authenticated;


-- -------------------------------------------------------------------------
-- PASSO 0.1: Garantir que a coluna hospital_id exista em todas as tabelas
-- -------------------------------------------------------------------------
-- Algumas tabelas podem ter sido criadas sem hospital_id originalmente.
-- Isso é necessário para que as políticas de RLS funcionem.
-- -------------------------------------------------------------------------

DO $$ 
BEGIN 
  -- Tabela: expenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'hospital_id' AND table_schema = 'public') THEN
      ALTER TABLE public.expenses ADD COLUMN hospital_id UUID REFERENCES public.hospitals(id);
    END IF;
  END IF;

  -- Tabela: withdrawals
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawals' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawals' AND column_name = 'hospital_id' AND table_schema = 'public') THEN
      ALTER TABLE public.withdrawals ADD COLUMN hospital_id UUID REFERENCES public.hospitals(id);
    END IF;
  END IF;

  -- Tabela: procedures_price_list
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'procedures_price_list' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'procedures_price_list' AND column_name = 'hospital_id' AND table_schema = 'public') THEN
      ALTER TABLE public.procedures_price_list ADD COLUMN hospital_id UUID REFERENCES public.hospitals(id);
    END IF;
  END IF;

  -- Tabela: doctors (tabela condicional)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctors' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'hospital_id' AND table_schema = 'public') THEN
      ALTER TABLE public.doctors ADD COLUMN hospital_id UUID REFERENCES public.hospitals(id);
    END IF;
  END IF;
END $$;


-- =========================================================================
-- PASSO 1: Limpar TODAS as policies antigas de todas as tabelas
-- =========================================================================

-- profiles
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- hospitals
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON hospitals;
DROP POLICY IF EXISTS "Allow public read on hospitals" ON hospitals;
DROP POLICY IF EXISTS "Users can manage their own hospitals" ON hospitals;
DROP POLICY IF EXISTS "Admins can see all hospitals" ON hospitals;
DROP POLICY IF EXISTS "hospitals_select" ON hospitals;
DROP POLICY IF EXISTS "hospitals_insert" ON hospitals;
DROP POLICY IF EXISTS "hospitals_update" ON hospitals;
DROP POLICY IF EXISTS "hospitals_delete" ON hospitals;

-- appointments
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated read on appointments" ON appointments;
DROP POLICY IF EXISTS "Users can manage their own appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can see all data" ON appointments;
DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

-- appointment_payments
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON appointment_payments;
DROP POLICY IF EXISTS "Users can manage their own payments" ON appointment_payments;
DROP POLICY IF EXISTS "appointment_payments_select" ON appointment_payments;
DROP POLICY IF EXISTS "appointment_payments_insert" ON appointment_payments;
DROP POLICY IF EXISTS "appointment_payments_update" ON appointment_payments;
DROP POLICY IF EXISTS "appointment_payments_delete" ON appointment_payments;

-- expenses
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON expenses;
DROP POLICY IF EXISTS "Allow authenticated read on expenses" ON expenses;
DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can see all expenses" ON expenses;
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

-- expense_categories
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON expense_categories;
DROP POLICY IF EXISTS "Users can manage their own categories" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_update" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete" ON expense_categories;

-- withdrawals
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON withdrawals;
DROP POLICY IF EXISTS "Allow authenticated read on withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Users can manage their own withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_select" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_update" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_delete" ON withdrawals;

-- procedures_price_list
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON procedures_price_list;
DROP POLICY IF EXISTS "Users can manage their own procedures" ON procedures_price_list;
DROP POLICY IF EXISTS "procedures_select" ON procedures_price_list;
DROP POLICY IF EXISTS "procedures_insert" ON procedures_price_list;
DROP POLICY IF EXISTS "procedures_update" ON procedures_price_list;
DROP POLICY IF EXISTS "procedures_delete" ON procedures_price_list;

-- doctors
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON doctors;
DROP POLICY IF EXISTS "Users can manage their own doctors" ON doctors;
DROP POLICY IF EXISTS "Admins can see all doctors" ON doctors;
DROP POLICY IF EXISTS "doctors_select" ON doctors;
DROP POLICY IF EXISTS "doctors_insert" ON doctors;
DROP POLICY IF EXISTS "doctors_update" ON doctors;
DROP POLICY IF EXISTS "doctors_delete" ON doctors;

-- appointment_audit_logs
DROP POLICY IF EXISTS "Allow authenticated read on audit logs" ON appointment_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated insert on audit logs" ON appointment_audit_logs;
DROP POLICY IF EXISTS "audit_logs_select" ON appointment_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON appointment_audit_logs;

-- Tabelas extras (podem ou não existir — DROP IF EXISTS é seguro)
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON hospital_documents;
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON hospital_payment_methods;
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON patients;


-- =========================================================================
-- PASSO 2: Habilitar RLS em todas as tabelas
-- =========================================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures_price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Tabelas extras (só habilita se existirem — usar DO block)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_blocks' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_documents' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE hospital_documents ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_payment_methods' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE hospital_payment_methods ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE patients ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;


-- =========================================================================
-- PASSO 3: Criar políticas por tabela
-- =========================================================================

-- -------------------------------------------------------------------------
-- 3.1  PROFILES
-- -------------------------------------------------------------------------
-- Todos podem ler seu próprio perfil.
-- ADMIN pode ler todos os perfis.
-- RECEPTION/FINANCIAL podem ler perfis do mesmo hospital (lista de colegas).
-- Somente o próprio usuário pode atualizar seu perfil (ou ADMIN).
-- -------------------------------------------------------------------------

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                              -- próprio perfil
    OR public.is_admin()                         -- admin vê tudo
    OR hospital_id = public.my_hospital_id()     -- colegas do mesmo hospital
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()                            -- só admin cria perfis
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()                              -- próprio perfil
    OR public.is_admin()                         -- admin atualiza qualquer um
  )
  WITH CHECK (
    id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (
    public.is_admin()                            -- só admin deleta perfis
  );


-- -------------------------------------------------------------------------
-- 3.2  HOSPITALS
-- -------------------------------------------------------------------------
-- Todos autenticados podem LER hospitais (necessário para dropdowns, etc).
-- Somente ADMIN pode criar/atualizar/deletar hospitais.
-- -------------------------------------------------------------------------

CREATE POLICY "hospitals_select" ON hospitals
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "hospitals_insert" ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "hospitals_update" ON hospitals
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "hospitals_delete" ON hospitals
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- -------------------------------------------------------------------------
-- 3.3  APPOINTMENTS
-- -------------------------------------------------------------------------
-- ADMIN vê tudo. RECEPTION/FINANCIAL só do seu hospital.
-- -------------------------------------------------------------------------

CREATE POLICY "appointments_select" ON appointments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "appointments_update" ON appointments
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  )
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "appointments_delete" ON appointments
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );


-- -------------------------------------------------------------------------
-- 3.4  APPOINTMENT_PAYMENTS
-- -------------------------------------------------------------------------
-- Acesso baseado no hospital_id do appointment pai.
-- -------------------------------------------------------------------------

CREATE POLICY "appointment_payments_select" ON appointment_payments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_payments.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  );

CREATE POLICY "appointment_payments_insert" ON appointment_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_payments.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  );

CREATE POLICY "appointment_payments_update" ON appointment_payments
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_payments.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_payments.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  );

CREATE POLICY "appointment_payments_delete" ON appointment_payments
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_payments.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  );


-- -------------------------------------------------------------------------
-- 3.5  EXPENSES
-- -------------------------------------------------------------------------
-- Se a tabela expenses tiver hospital_id, filtra por hospital.
-- Se não tiver, permite acesso para ADMIN e FINANCIAL.
-- O código já tenta filtrar por hospital_id com fallback.
-- Assumimos que hospital_id EXISTE (ou será adicionado).
-- -------------------------------------------------------------------------

CREATE POLICY "expenses_select" ON expenses
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  )
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );


-- -------------------------------------------------------------------------
-- 3.6  EXPENSE_CATEGORIES
-- -------------------------------------------------------------------------
-- Categorias são dados globais (compartilhados). Todos podem ler.
-- Somente ADMIN pode criar/editar/deletar categorias.
-- -------------------------------------------------------------------------

CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "expense_categories_insert" ON expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "expense_categories_update" ON expense_categories
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "expense_categories_delete" ON expense_categories
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- -------------------------------------------------------------------------
-- 3.7  WITHDRAWALS
-- -------------------------------------------------------------------------
-- Mesma lógica: hospital_id para filtrar por hospital.
-- -------------------------------------------------------------------------

CREATE POLICY "withdrawals_select" ON withdrawals
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "withdrawals_insert" ON withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "withdrawals_update" ON withdrawals
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  )
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "withdrawals_delete" ON withdrawals
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );


-- -------------------------------------------------------------------------
-- 3.8  PROCEDURES_PRICE_LIST
-- -------------------------------------------------------------------------
-- Se tiver hospital_id, filtra. Se não tiver (tabela global), todos lêem,
-- somente ADMIN modifica.
-- O serviço tenta filtrar por hospital_id, então assumimos que pode existir.
-- Usamos COALESCE para suportar registros globais (hospital_id IS NULL).
-- -------------------------------------------------------------------------

CREATE POLICY "procedures_select" ON procedures_price_list
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR hospital_id IS NULL                       -- procedimentos globais
    OR hospital_id = public.my_hospital_id()     -- procedimentos do hospital
  );

CREATE POLICY "procedures_insert" ON procedures_price_list
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "procedures_update" ON procedures_price_list
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  )
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "procedures_delete" ON procedures_price_list
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- -------------------------------------------------------------------------
-- 3.9  DOCTORS
-- -------------------------------------------------------------------------

CREATE POLICY "doctors_select" ON doctors
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "doctors_insert" ON doctors
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "doctors_update" ON doctors
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  )
  WITH CHECK (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );

CREATE POLICY "doctors_delete" ON doctors
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR hospital_id = public.my_hospital_id()
  );


-- -------------------------------------------------------------------------
-- 3.10  APPOINTMENT_AUDIT_LOGS
-- -------------------------------------------------------------------------
-- Acesso baseado no hospital_id do appointment pai.
-- Somente INSERT (logging) e SELECT (leitura).
-- -------------------------------------------------------------------------

CREATE POLICY "audit_logs_select" ON appointment_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_audit_logs.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  );

CREATE POLICY "audit_logs_insert" ON appointment_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_audit_logs.appointment_id
        AND a.hospital_id = public.my_hospital_id()
    )
  );


-- =========================================================================
-- PASSO 4: Tabelas extras (condicionais — só cria se a tabela existir)
-- =========================================================================

-- 4.1 SCHEDULE_BLOCKS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_blocks' AND table_schema = 'public') THEN

    DROP POLICY IF EXISTS "schedule_blocks_select" ON schedule_blocks;
    DROP POLICY IF EXISTS "schedule_blocks_insert" ON schedule_blocks;
    DROP POLICY IF EXISTS "schedule_blocks_update" ON schedule_blocks;
    DROP POLICY IF EXISTS "schedule_blocks_delete" ON schedule_blocks;

    EXECUTE 'CREATE POLICY "schedule_blocks_select" ON schedule_blocks
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "schedule_blocks_insert" ON schedule_blocks
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "schedule_blocks_update" ON schedule_blocks
      FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "schedule_blocks_delete" ON schedule_blocks
      FOR DELETE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

  END IF;
END $$;

-- 4.2 HOSPITAL_DOCUMENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_documents' AND table_schema = 'public') THEN

    DROP POLICY IF EXISTS "hospital_documents_select" ON hospital_documents;
    DROP POLICY IF EXISTS "hospital_documents_insert" ON hospital_documents;
    DROP POLICY IF EXISTS "hospital_documents_update" ON hospital_documents;
    DROP POLICY IF EXISTS "hospital_documents_delete" ON hospital_documents;

    EXECUTE 'CREATE POLICY "hospital_documents_select" ON hospital_documents
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "hospital_documents_insert" ON hospital_documents
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "hospital_documents_update" ON hospital_documents
      FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "hospital_documents_delete" ON hospital_documents
      FOR DELETE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

  END IF;
END $$;

-- 4.3 HOSPITAL_PAYMENT_METHODS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_payment_methods' AND table_schema = 'public') THEN

    DROP POLICY IF EXISTS "hospital_payment_methods_select" ON hospital_payment_methods;
    DROP POLICY IF EXISTS "hospital_payment_methods_insert" ON hospital_payment_methods;
    DROP POLICY IF EXISTS "hospital_payment_methods_update" ON hospital_payment_methods;
    DROP POLICY IF EXISTS "hospital_payment_methods_delete" ON hospital_payment_methods;

    EXECUTE 'CREATE POLICY "hospital_payment_methods_select" ON hospital_payment_methods
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "hospital_payment_methods_insert" ON hospital_payment_methods
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "hospital_payment_methods_update" ON hospital_payment_methods
      FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "hospital_payment_methods_delete" ON hospital_payment_methods
      FOR DELETE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

  END IF;
END $$;

-- 4.4 PATIENTS (tabela separada, se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients' AND table_schema = 'public') THEN

    DROP POLICY IF EXISTS "patients_select" ON patients;
    DROP POLICY IF EXISTS "patients_insert" ON patients;
    DROP POLICY IF EXISTS "patients_update" ON patients;
    DROP POLICY IF EXISTS "patients_delete" ON patients;

    EXECUTE 'CREATE POLICY "patients_select" ON patients
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "patients_insert" ON patients
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "patients_update" ON patients
      FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )
      WITH CHECK (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

    EXECUTE 'CREATE POLICY "patients_delete" ON patients
      FOR DELETE TO authenticated
      USING (
        public.is_admin()
        OR hospital_id = public.my_hospital_id()
      )';

  END IF;
END $$;


-- =========================================================================
-- PASSO 5: Verificação — Listar todas as policies ativas
-- =========================================================================
-- Execute esta query separadamente para conferir o resultado:
--
--   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- =========================================================================

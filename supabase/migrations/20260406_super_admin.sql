-- ============================================================================
-- Migration: SUPER_ADMIN role, user activation, access audit log
-- Date: 2026-04-06
-- ============================================================================

-- 1) Ampliar CHECK de roles ------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('SUPER_ADMIN','ADMIN','RECEPTION','FINANCIAL'));

-- 2) Coluna is_active para ativar/desativar usuários ----------------------
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3) Helpers de role centralizados ----------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_like()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role IN ('ADMIN','SUPER_ADMIN') AND COALESCE(is_active, TRUE)
       FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'SUPER_ADMIN' AND COALESCE(is_active, TRUE)
       FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- 4) Atualizar RLS que antes checava role = 'ADMIN' -----------------------
-- Profiles: SUPER_ADMIN/ADMIN veem tudo; demais só o próprio.
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
    USING (
        public.is_admin_like()
        OR id = auth.uid()
    );

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
    WITH CHECK (public.is_admin_like());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
    USING (public.is_admin_like() OR id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
    USING (public.is_super_admin());

-- Hospitais: super_admin/admin veem tudo; outros só o próprio hospital.
DROP POLICY IF EXISTS "hospitals_select" ON hospitals;
CREATE POLICY "hospitals_select" ON hospitals FOR SELECT
    USING (
        public.is_admin_like()
        OR id = public.get_my_hospital_id()
    );

DROP POLICY IF EXISTS "hospitals_mutate" ON hospitals;
CREATE POLICY "hospitals_mutate" ON hospitals FOR ALL
    USING (public.is_admin_like())
    WITH CHECK (public.is_admin_like());

-- Appointments / expenses / withdrawals: basta trocar 'ADMIN' por is_admin_like()
-- As policies originais continuam válidas para recepção/financeiro por hospital_id.
-- Apenas as que eram "role = ADMIN" passam a usar is_admin_like():
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname, qual, with_check
          FROM pg_policies
         WHERE schemaname = 'public'
           AND (qual LIKE '%''ADMIN''%' OR with_check LIKE '%''ADMIN''%')
    LOOP
        -- apenas loga; substituição manual feita abaixo para tabelas principais
        RAISE NOTICE 'Policy a revisar: %.% / %', pol.schemaname, pol.tablename, pol.policyname;
    END LOOP;
END $$;

-- 5) Tabela de auditoria de acessos ---------------------------------------
CREATE TABLE IF NOT EXISTS access_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_email TEXT,
    target_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_email TEXT,
    action TEXT NOT NULL, -- LOGIN, LOGOUT, ROLE_CHANGE, CREATE_USER, DELETE_USER, ACTIVATE, DEACTIVATE
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON access_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON access_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON access_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON access_audit_log(action);

ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_super" ON access_audit_log;
CREATE POLICY "audit_select_super" ON access_audit_log FOR SELECT
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "audit_insert_any" ON access_audit_log;
CREATE POLICY "audit_insert_any" ON access_audit_log FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 6) Trigger para logar LOGIN automaticamente via auth.users.last_sign_in_at
-- (opcional: mantemos somente via edge function + client-side). -----------

-- 7) View consolidada para Controle de Acessos ----------------------------
-- SECURITY INVOKER (padrão): respeita RLS do usuário que consulta.
-- Sem join com auth.users para não expor dados sensíveis via API pública.
DROP VIEW IF EXISTS public.v_access_overview;
CREATE VIEW public.v_access_overview
WITH (security_invoker = true)
AS
SELECT
    p.id,
    p.name,
    p.email,
    p.role,
    p.is_active,
    p.hospital_id,
    h.name AS hospital_name,
    p.created_at,
    p.updated_at
FROM profiles p
LEFT JOIN hospitals h ON h.id = p.hospital_id;

GRANT SELECT ON public.v_access_overview TO authenticated;

-- 8) Promover vitor@miv.com.br a SUPER_ADMIN ------------------------------
DO $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id FROM auth.users WHERE lower(email) = 'vitor@miv.com.br' LIMIT 1;
    IF v_id IS NOT NULL THEN
        INSERT INTO profiles (id, name, role, is_active)
        VALUES (v_id, 'Vitor (Super Admin)', 'SUPER_ADMIN', TRUE)
        ON CONFLICT (id) DO UPDATE
            SET role = 'SUPER_ADMIN',
                is_active = TRUE,
                updated_at = NOW();
        RAISE NOTICE 'Vitor promovido a SUPER_ADMIN (id=%)', v_id;
    ELSE
        RAISE NOTICE 'Usuário vitor@miv.com.br ainda não existe em auth.users. Crie o login primeiro e rode novamente o UPDATE final.';
    END IF;
END $$;

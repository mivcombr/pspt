-- ============================================================================
-- Migration: COMMERCIAL role
-- Date: 2026-04-13
-- Descrição: Novo role comercial com acesso a todos os hospitais, pacientes
--            e agendamentos, sem acesso ao faturamento total (financials/dashboard).
-- ============================================================================

-- 1) Ampliar CHECK de roles ------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('SUPER_ADMIN','ADMIN','RECEPTION','FINANCIAL','COMMERCIAL'));

-- 2) Helper para verificar se é admin-like ou commercial (acesso cross-hospital) --
CREATE OR REPLACE FUNCTION public.is_admin_like()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role IN ('ADMIN','SUPER_ADMIN','COMMERCIAL') AND COALESCE(is_active, TRUE)
       FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- 3) RLS: hospitais — COMMERCIAL também vê todos os hospitais ---------------
DROP POLICY IF EXISTS "hospitals_select" ON hospitals;
CREATE POLICY "hospitals_select" ON hospitals FOR SELECT
    USING (
        public.is_admin_like()
        OR id = public.get_my_hospital_id()
    );

-- COMMERCIAL não pode mutar hospitais (apenas ADMIN/SUPER_ADMIN)
DROP POLICY IF EXISTS "hospitals_mutate" ON hospitals;
CREATE POLICY "hospitals_mutate" ON hospitals FOR ALL
    USING (
        (SELECT role IN ('ADMIN','SUPER_ADMIN') AND COALESCE(is_active, TRUE)
           FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        (SELECT role IN ('ADMIN','SUPER_ADMIN') AND COALESCE(is_active, TRUE)
           FROM public.profiles WHERE id = auth.uid())
    );

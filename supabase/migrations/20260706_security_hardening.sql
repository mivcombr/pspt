-- Security hardening — 2026-07-06
-- Rollback disponível em: 20260706_security_hardening_rollback.sql
--
-- Contexto: varredura de segurança encontrou escalonamento de privilégio via
-- a tabela profiles, políticas de auditoria permissivas e funções sem
-- search_path fixo. Nenhuma destas mudanças altera a lógica das políticas RLS
-- de negócio (appointments, patients, expenses, withdrawals), portanto não
-- afeta o acesso do dia a dia dos usuários.

-- =====================================================================
-- 1. CRÍTICO — bloqueia escalonamento de privilégio via profiles
-- =====================================================================
-- A policy profiles_update (USING is_admin_like() OR id = auth.uid(), sem
-- WITH CHECK) permitia que qualquer usuário autenticado alterasse a própria
-- linha, inclusive role/is_active/hospital_id, tornando-se SUPER_ADMIN.
-- Toda gestão legítima de perfil passa pelas edge functions com service_role
-- (que ignoram grants de coluna), então restringir a escrita de
-- authenticated/anon não quebra nenhum fluxo do app.
--
-- OBS: não basta revogar as colunas — o grant existe no nível da TABELA
-- (padrão Supabase), que sobrepõe grants de coluna. É preciso revogar
-- UPDATE/INSERT da tabela e reconceder UPDATE só nas colunas seguras.
-- SELECT é mantido (o app lê role/hospital_id/is_active para montar a sessão).
REVOKE UPDATE, INSERT ON public.profiles FROM authenticated, anon;
GRANT UPDATE (name, avatar_url) ON public.profiles TO authenticated;

-- =====================================================================
-- 2. Auditoria — remove policies permissivas legadas
-- =====================================================================
-- Estas duas eram WITH CHECK (true) / USING (true), permitindo forjar e ler
-- registros de auditoria de todos os hospitais. As policies seguras
-- (audit_insert com changed_by = auth.uid(), audit_select por hospital)
-- permanecem e continuam cobrindo o fluxo.
DROP POLICY IF EXISTS "Allow authenticated insert on audit logs" ON public.appointment_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read on audit logs"   ON public.appointment_audit_logs;

-- =====================================================================
-- 3. Hardening — fixa search_path das funções SECURITY DEFINER/trigger
-- =====================================================================
-- Não altera o corpo das funções; apenas evita sequestro de search_path.
ALTER FUNCTION public.is_super_admin()           SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_role()              SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_like()            SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()          SET search_path = public, pg_temp;
ALTER FUNCTION public.check_payment_total()      SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

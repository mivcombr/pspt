-- ROLLBACK de 20260706_security_hardening.sql
-- Restaura exatamente o estado anterior. Rode este arquivo inteiro se
-- precisar desfazer todas as correções de segurança de 2026-07-06.

-- 1. Restaura os grants de tabela em profiles (reabre o escalonamento — use só se necessário)
GRANT UPDATE, INSERT ON public.profiles TO authenticated, anon;
REVOKE UPDATE (name, avatar_url) ON public.profiles FROM authenticated;

-- 2. Recria as policies de auditoria legadas
CREATE POLICY "Allow authenticated insert on audit logs"
    ON public.appointment_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read on audit logs"
    ON public.appointment_audit_logs FOR SELECT TO authenticated USING (true);

-- 3. Remove o search_path fixo das funções
ALTER FUNCTION public.is_super_admin()           RESET search_path;
ALTER FUNCTION public.get_my_role()              RESET search_path;
ALTER FUNCTION public.is_admin_like()            RESET search_path;
ALTER FUNCTION public.handle_new_user()          RESET search_path;
ALTER FUNCTION public.check_payment_total()      RESET search_path;
ALTER FUNCTION public.update_updated_at_column() RESET search_path;

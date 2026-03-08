-- ============================================================
-- LOGIN AUDIT LOGS TABLE
-- Tracks all login attempts (successful and failed).
-- Etapa 7 - Security Hardening
-- ============================================================

CREATE TABLE IF NOT EXISTS public.login_audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT        NOT NULL,
    success      BOOLEAN     NOT NULL,
    user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    error_message TEXT,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_audit_email      ON public.login_audit_logs(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON public.login_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_audit_success    ON public.login_audit_logs(success);

-- Enable RLS
ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

-- Clean up any previous policies
DROP POLICY IF EXISTS "login_audit_select"            ON public.login_audit_logs;
DROP POLICY IF EXISTS "login_audit_insert_authenticated" ON public.login_audit_logs;
DROP POLICY IF EXISTS "login_audit_insert_anon"       ON public.login_audit_logs;

-- SELECT: only ADMIN users can view login logs
CREATE POLICY "login_audit_select" ON public.login_audit_logs
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'ADMIN');

-- INSERT: authenticated users can log their own attempts
CREATE POLICY "login_audit_insert_authenticated" ON public.login_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- INSERT: anon users can log failed attempts (login failure happens before auth)
CREATE POLICY "login_audit_insert_anon" ON public.login_audit_logs
    FOR INSERT TO anon
    WITH CHECK (true);

-- No UPDATE or DELETE policies — audit logs are immutable

-- ============================================================
-- VERIFICATION
-- After running this script, verify the table and policies:
-- ============================================================
--
-- SELECT tablename, policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE tablename = 'login_audit_logs';

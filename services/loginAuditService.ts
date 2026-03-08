import { supabase } from '../lib/supabase';

interface LoginAttempt {
    email: string;
    success: boolean;
    userId?: string | null;
    errorMessage?: string | null;
}

/**
 * Logs a login attempt (success or failure) to login_audit_logs.
 * Silently fails so that audit errors never block the login flow.
 */
export async function logLoginAttempt({ email, success, userId, errorMessage }: LoginAttempt): Promise<void> {
    try {
        await supabase.from('login_audit_logs').insert({
            email,
            success,
            user_id: userId ?? null,
            error_message: errorMessage ?? null,
            user_agent: navigator.userAgent,
        });
    } catch {
        // Intentionally silent — audit logging must never break the login flow
    }
}

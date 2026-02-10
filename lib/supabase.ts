import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'pspt-auth-session',
    },
});

// Proactively refresh the session when the user returns to the tab after inactivity.
// This prevents the user from being "logged out" because the access token expired
// while the tab was in the background and the auto-refresh timer was throttled by the browser.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    // If the access token is close to expiry (within 2 minutes) or already expired,
                    // force a refresh to get a new one before any API call fails.
                    const now = Math.floor(Date.now() / 1000);
                    const expiresAt = session.expires_at ?? 0;
                    if (expiresAt - now < 120) {
                        console.log('[Auth] Session near expiry on tab focus, refreshing...');
                        await supabase.auth.refreshSession();
                    }
                }
            } catch (err) {
                console.warn('[Auth] Failed to refresh session on visibility change:', err);
            }
        }
    });
}

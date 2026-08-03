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

// NOTE: não adicionar handlers de visibilitychange/refresh manual aqui.
// O supabase-js já renova o token ao voltar o foco da aba (autoRefreshToken),
// e refreshes concorrentes disputam o lock de auth entre abas, travando
// todas as queries do app no momento em que o usuário volta à janela.

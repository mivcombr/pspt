import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- CORS: Only allow requests from known origins ---
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

function getAllowedOrigin(req: Request): string | null {
    const origin = req.headers.get('Origin') || '';
    // Check against explicit allowlist
    if (ALLOWED_ORIGINS.includes(origin)) return origin;
    // In development, allow localhost origins
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) return origin;
    return null;
}

function getCorsHeaders(req: Request): Record<string, string> {
    const origin = getAllowedOrigin(req);
    return {
        'Access-Control-Allow-Origin': origin || '',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    };
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Block requests from disallowed origins
    const origin = req.headers.get('Origin');
    if (origin && !getAllowedOrigin(req)) {
        return new Response(
            JSON.stringify({ error: 'Origin not allowed' }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 403,
            }
        )
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Nenhum token fornecido' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // Auth client for identity verification
        const authClient = createClient(supabaseUrl, supabaseServiceKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Admin client for high-privilege operations
        const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Verify caller
        const { data: { user: caller }, error: callerError } = await authClient.auth.getUser();

        if (callerError || !caller) {
            console.error('Erro ao autenticar autor da requisição:', callerError);
            return new Response(
                JSON.stringify({ error: 'Sessão inválida ou expirada' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // 1. Verify if the caller is an ADMIN
        const { data: profile, error: profileErr } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (profileErr || profile?.role !== 'ADMIN') {
            console.error('Tentativa de remoção sem permissão de admin:', caller.id);
            return new Response(
                JSON.stringify({ error: 'Acesso negado: Administradores apenas' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        const { user_id } = await req.json()

        if (!user_id) {
            return new Response(
                JSON.stringify({ error: 'ID do usuário ausente' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 2. Delete from Auth
        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user_id)
        if (deleteAuthError && !deleteAuthError.message?.toLowerCase().includes('not found')) {
            console.error('Error deleting user from auth:', deleteAuthError.message);
            return new Response(
                JSON.stringify({ error: 'Erro ao remover credenciais do usuário' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 3. Delete from Profiles
        const { error: deleteProfileError } = await adminClient
            .from('profiles')
            .delete()
            .eq('id', user_id)

        if (deleteProfileError) {
            console.error('Error deleting profile:', deleteProfileError.message);
            // We return success if auth was deleted, but keep the log
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('Internal Error in delete-user:', (error as any)?.message);
        return new Response(
            JSON.stringify({ error: 'Erro interno ao remover usuário. Tente novamente.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})

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

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader! },
                },
            }
        )

        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            console.error('Delete-user auth error:', userError?.message, userError?.stack);
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: 'Sessão inválida ou expirada. Por favor, faça login novamente.' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                }
            )
        }

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'ADMIN') {
            return new Response(
                JSON.stringify({ error: 'Forbidden: Admin access required' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403,
                }
            )
        }

        const { user_id } = await req.json()

        if (!user_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required field: user_id' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
        if (deleteAuthError && !deleteAuthError.message?.toLowerCase().includes('not found')) {
            console.error('Error deleting user from auth:', deleteAuthError.message, deleteAuthError.stack);
            return new Response(
                JSON.stringify({ error: 'Erro ao remover usuário. Tente novamente.' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        const { error: deleteProfileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', user_id)

        if (deleteProfileError) {
            console.error('Error deleting profile:', deleteProfileError.message, deleteProfileError.stack);
            return new Response(
                JSON.stringify({ error: 'Erro ao remover perfil do usuário. Tente novamente.' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        return new Response(
            JSON.stringify({ success: true }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Error in delete-user function:', (error as any)?.message, (error as any)?.stack);
        return new Response(
            JSON.stringify({ error: 'Erro interno ao remover usuário. Tente novamente.' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})

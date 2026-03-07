import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
        'Content-Type': 'application/json',
    };
}

Deno.serve(async (req) => {
    const headers = getCorsHeaders(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Auth Check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers });
        }

        const token = authHeader.replace(/Bearer /i, '');
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Validate Caller Identity
        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !caller) {
            console.error('Auth Error:', authError?.message);
            return new Response(JSON.stringify({
                error: 'Sessão inválida',
                debug: authError?.message || 'User not found for token',
                hint: 'Tente fazer Logoff e Logon novamente.'
            }), { status: 401, headers });
        }

        // 2. Validate Admin Role
        const { data: profile, error: pError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (pError || profile?.role !== 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Acesso negado: Administradores apenas' }), { status: 403, headers });
        }

        // 3. Process Deletion
        const { user_id } = await req.json();

        if (!user_id) {
            return new Response(JSON.stringify({ error: 'Falta o parâmetro user_id' }), { status: 400, headers });
        }

        // 4. Delete Auth (with service role)
        const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (authDelError && !authDelError.message.includes('not found')) throw authDelError;

        // 5. Delete Profile (with service role)
        const { error: profileDelError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', user_id);

        if (profileDelError) throw profileDelError;

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });

    } catch (error: any) {
        console.error('Critical Error:', error.message);
        return new Response(JSON.stringify({
            error: 'Erro ao remover usuário',
            details: error.message
        }), { status: 400, headers });
    }
});

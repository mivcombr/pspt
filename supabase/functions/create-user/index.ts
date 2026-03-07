import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    };
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const url = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminClient = createClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Validar Token (Verificação Manual Robusta)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('AUTH_HEADER_MISSING');

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !caller) {
            console.error('Falha Auth:', authError?.message);
            return new Response(JSON.stringify({ error: 'Auth failed', details: authError?.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
                statusText: `Unauthorized: ${authError?.message || 'Invalid Token'}`
            });
        }

        // 2. Verificar Admin
        const { data: profile, error: pError } = await adminClient.from('profiles').select('role').eq('id', caller.id).single();
        if (pError || profile?.role !== 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Acesso negado: Apenas administradores' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
                statusText: 'Forbidden: Admin access required'
            });
        }

        // 3. Processar criação
        const { email, password, name, role, hospital_id } = await req.json();

        // Criar ou Pegar usuário se já existir (Idempotência)
        const { data: st, error: stError } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { name, role, hospital_id }
        });

        let finalUserId = '';
        if (stError) {
            if (stError.message.includes('already registered')) {
                const { data: list } = await adminClient.auth.admin.listUsers();
                const existing = list.users.find((u: any) => u.email === email);
                if (existing) finalUserId = existing.id;
                else throw stError;
            } else throw stError;
        } else {
            finalUserId = st.user.id;
        }

        // Upsert Profile com Service Role
        await adminClient.from('profiles').upsert([{ id: finalUserId, name, role, hospital_id, email }]);

        return new Response(JSON.stringify({ success: true, id: finalUserId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('Erro Fatal:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: error.message === 'AUTH_HEADER_MISSING' ? 401 : 400
        });
    }
});

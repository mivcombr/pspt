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
        const url = Deno.env.get('SUPABASE_URL') || '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        if (!url || !serviceKey) {
            return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta (Missing Keys)' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Token não enviado pelo navegador' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401
            });
        }

        // Criar cliente temporário para validar o usuário
        const authClient = createClient(url, anonKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await authClient.auth.getUser(token);

        if (authError || !caller) {
            return new Response(JSON.stringify({
                error: 'Sessão inválida. Por favor, faça logout e login novamente.',
                details: authError?.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401
            });
        }

        // Cliente Admin para operações pesadas
        const adminClient = createClient(url, serviceKey);

        // 1. Verificar se é ADMIN
        const { data: profile } = await adminClient.from('profiles').select('role').eq('id', caller.id).single();
        if (profile?.role !== 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Acesso negado: Apenas administradores' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403
            });
        }

        // 2. Processar criação
        const body = await req.json();
        const { email, password, name, role, hospital_id } = body;

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { name, role, hospital_id }
        });

        if (createError) throw createError;

        await adminClient.from('profiles').upsert([{ id: newUser.user.id, name, role, hospital_id, email }]);

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('Erro fatal:', error.message);
        return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});

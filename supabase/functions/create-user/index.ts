import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurações Globais
const corsHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
};

function getResponseHeaders(req: Request) {
    const origin = req.headers.get('Origin') || '';
    const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim());
    const isAllowed = allowedOrigins.includes(origin) || origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);

    return {
        ...corsHeaders,
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Content-Type': 'application/json',
    };
}

serve(async (req: Request) => {
    // 1. Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getResponseHeaders(req) });
    }

    const headers = getResponseHeaders(req);

    try {
        const url = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Falta cabeçalho de autorização' }), { status: 401, headers });
        }

        // Cliente Admin para TUDO (Mais estável em Edge Runtime)
        const supabase = createClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 2. Validar o Usuário que chamou
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !caller) {
            console.error('Erro Auth Detalhado:', authError);
            return new Response(JSON.stringify({
                error: 'Sessão inválida',
                debug: authError?.message || 'Token não reconhecido'
            }), { status: 401, headers });
        }

        // 3. Verificar permissão de ADMIN
        const { data: profile, error: pError } = await supabase.from('profiles').select('role').eq('id', caller.id).single();
        if (pError || profile?.role !== 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Acesso negado: Administradores apenas' }), { status: 403, headers });
        }

        // 4. Lógica de Criação
        const body = await req.json();
        const { email, password, name, role, hospital_id } = body;

        // Tentar criar na Auth
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { name, role, hospital_id }
        });

        let targetUserId = '';
        if (createError) {
            if (createError.message.includes('already registered')) {
                // Se já existe, buscar o ID para garantir o Profile
                const { data: users } = await supabase.auth.admin.listUsers();
                const existing = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                if (!existing) throw createError;
                targetUserId = existing.id;
            } else {
                throw createError;
            }
        } else {
            targetUserId = authData.user.id;
        }

        // Upsert no Profile
        const { error: upsertError } = await supabase.from('profiles').upsert([
            { id: targetUserId, name, role, hospital_id, email }
        ], { onConflict: 'id' });

        if (upsertError) throw upsertError;

        return new Response(JSON.stringify({ success: true, user_id: targetUserId }), { status: 200, headers });

    } catch (error: any) {
        console.error('Erro na função:', error);
        return new Response(JSON.stringify({ error: 'Erro ao processar solicitação', details: error.message }), {
            status: 400,
            headers
        });
    }
});

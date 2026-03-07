import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- CORS Configuration ---
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

function getAllowedOrigin(req: Request): string | null {
    const origin = req.headers.get('Origin') || '';
    if (ALLOWED_ORIGINS.includes(origin)) return origin;
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

const findUserByEmail = async (supabaseAdmin: any, email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const perPage = 1000
    let page = 1

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error) return { user: null, error }

        const match = data.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail)
        if (match) return { user: match, error: null }

        if (data.users.length < perPage) break
        page += 1
    }
    return { user: null, error: null }
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // CORS pre-flight check failure
    const origin = req.headers.get('Origin');
    if (origin && !getAllowedOrigin(req)) {
        console.error('CORS Bloqueado: Origem não permitida ->', origin);
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        });
    }

    try {
        // Essential credentials
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Validate Token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('Erro: Nenhum header de autorização enviado');
            return new Response(JSON.stringify({ error: 'Nenhum token fornecido' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !caller) {
            console.error('Erro de Autenticação Supabase:', authError?.message);
            return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401
            });
        }

        // 2. Validate Admin Permissions
        const { data: profile, error: profileErr } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (profileErr || profile?.role !== 'ADMIN') {
            console.error('Acesso Negado: Usuário não é ADMIN ->', caller.id);
            return new Response(JSON.stringify({ error: 'Acesso negado: Administradores apenas' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403
            });
        }

        // 3. Process Request
        const { email, password, name, role, hospital_id } = await req.json();

        if (!email || !password || !name || !role || !hospital_id) {
            return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            });
        }

        // Handle Auth creation/update
        const { user: existingUser } = await findUserByEmail(adminClient, email);
        let resolvedUser;

        if (existingUser) {
            console.log('Atualizando usuário existente:', existingUser.id);
            const { data: updated, error: uErr } = await adminClient.auth.admin.updateUserById(existingUser.id, {
                password,
                email_confirm: true,
                user_metadata: { name, role, hospital_id }
            });
            if (uErr) throw uErr;
            resolvedUser = updated.user;
        } else {
            console.log('Criando novo usuário:', email);
            const { data: created, error: cErr } = await adminClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name, role, hospital_id }
            });
            if (cErr) throw cErr;
            resolvedUser = created.user;
        }

        // Handle Profile
        const { error: pErr } = await adminClient
            .from('profiles')
            .upsert([{ id: resolvedUser.id, name, role, hospital_id, email }], { onConflict: 'id' });

        if (pErr) console.error('Erro ao atualizar profiles:', pErr.message);

        return new Response(JSON.stringify({ success: true, user: { id: resolvedUser.id, email: resolvedUser.email } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('Internal Error:', error.message);
        const isDup = error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already exists');
        return new Response(JSON.stringify({ error: isDup ? 'E-mail já cadastrado.' : 'Erro interno ao processar solicitação.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: isDup ? 409 : 500
        });
    }
});

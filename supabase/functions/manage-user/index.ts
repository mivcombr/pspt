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

/**
 * manage-user: ações administrativas sobre um usuário existente
 * Body: { user_id, action: 'ACTIVATE'|'DEACTIVATE'|'SET_ROLE'|'SET_HOSPITAL', value? }
 * - ACTIVATE/DEACTIVATE: qualquer ADMIN ou SUPER_ADMIN, mas só SUPER_ADMIN pode mexer em ADMIN/SUPER_ADMIN
 * - SET_ROLE: apenas SUPER_ADMIN
 * - SET_HOSPITAL: ADMIN ou SUPER_ADMIN
 */
Deno.serve(async (req) => {
    const headers = getCorsHeaders(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers });

        const token = authHeader.replace(/Bearer /i, '');
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !caller) {
            return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers });
        }

        const { data: profile, error: pError } = await supabaseAdmin
            .from('profiles').select('role').eq('id', caller.id).single();

        if (pError || !['ADMIN', 'SUPER_ADMIN'].includes(profile?.role)) {
            return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers });
        }

        const body = await req.json();
        const { user_id, action, value } = body as { user_id: string; action: string; value?: any };

        if (!user_id || !action) {
            return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios: user_id, action' }), { status: 400, headers });
        }

        if (user_id === caller.id && (action === 'DEACTIVATE' || action === 'SET_ROLE')) {
            return new Response(JSON.stringify({ error: 'Você não pode executar esta ação no próprio usuário.' }), { status: 400, headers });
        }

        const { data: target } = await supabaseAdmin
            .from('profiles').select('id, role, email, is_active, hospital_id').eq('id', user_id).single();
        if (!target) {
            return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404, headers });
        }

        const targetIsAdminLike = ['ADMIN', 'SUPER_ADMIN'].includes(target.role);
        if (targetIsAdminLike && profile.role !== 'SUPER_ADMIN') {
            return new Response(JSON.stringify({ error: 'Apenas Super Administradores podem alterar contas ADMIN ou SUPER_ADMIN.' }), { status: 403, headers });
        }

        let updates: Record<string, any> = {};
        let metadata: Record<string, any> = {};

        switch (action) {
            case 'ACTIVATE':
                updates = { is_active: true };
                metadata = { from: target.is_active };
                break;
            case 'DEACTIVATE':
                updates = { is_active: false };
                metadata = { from: target.is_active };
                break;
            case 'SET_ROLE':
                if (profile.role !== 'SUPER_ADMIN') {
                    return new Response(JSON.stringify({ error: 'Apenas Super Administradores podem alterar roles.' }), { status: 403, headers });
                }
                if (!['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'FINANCIAL'].includes(value)) {
                    return new Response(JSON.stringify({ error: 'Role inválido' }), { status: 400, headers });
                }
                updates = { role: value };
                metadata = { from: target.role, to: value };
                break;
            case 'SET_HOSPITAL':
                updates = { hospital_id: value || null };
                metadata = { from: target.hospital_id, to: value };
                break;
            default:
                return new Response(JSON.stringify({ error: 'Ação desconhecida' }), { status: 400, headers });
        }

        const { error: updError } = await supabaseAdmin.from('profiles').update(updates).eq('id', user_id);
        if (updError) throw updError;

        // Se desativou, banir do auth também (impede login)
        if (action === 'DEACTIVATE') {
            await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: '876000h' }); // ~100 anos
        } else if (action === 'ACTIVATE') {
            await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: 'none' });
        }

        await supabaseAdmin.from('access_audit_log').insert({
            actor_id: caller.id,
            actor_email: caller.email,
            target_id: user_id,
            target_email: target.email,
            action,
            metadata
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch (e: any) {
        console.error('manage-user error:', e.message);
        return new Response(JSON.stringify({ error: 'Erro ao executar ação', details: e.message }), { status: 400, headers });
    }
});

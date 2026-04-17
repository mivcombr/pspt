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
 * Generates a secure temporary password that meets all validation requirements:
 * - At least 12 characters
 * - 1 uppercase letter, 1 lowercase letter, 1 digit, 1 special character
 */
function generateTempPassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;

    // Guarantee one of each required type
    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    pwd += special[Math.floor(Math.random() * special.length)];

    // Fill remaining 8 characters randomly
    for (let i = 0; i < 8; i++) {
        pwd += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle to avoid predictable positions
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

function validatePassword(password: string): string[] {
    const errors: string[] = [];
    if (password.length < 8) errors.push('mínimo 8 caracteres');
    if (!/[A-Z]/.test(password)) errors.push('1 letra maiúscula');
    if (!/[0-9]/.test(password)) errors.push('1 número');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('1 caractere especial');
    return errors;
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

        if (pError || !['ADMIN', 'SUPER_ADMIN'].includes(profile?.role)) {
            return new Response(JSON.stringify({ error: 'Acesso negado: Administradores apenas' }), { status: 403, headers });
        }

        // 3. Process Creation
        const { email, password: providedPassword, name, role, hospital_id } = await req.json();

        if (!email || !name) {
            return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando (email, name)' }), { status: 400, headers });
        }

        // 4. Use provided password or generate a temporary one
        const isTemporaryPassword = !providedPassword;
        const finalPassword = providedPassword || generateTempPassword();

        // 5. Validate password strength
        const passwordErrors = validatePassword(finalPassword);
        if (passwordErrors.length > 0) {
            return new Response(
                JSON.stringify({ error: `Senha fraca. Requisitos: ${passwordErrors.join(', ')}.` }),
                { status: 400, headers }
            );
        }

        // 6. Create in Auth (with Idempotency)
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: finalPassword,
            email_confirm: true,
            user_metadata: {
                name,
                role,
                hospital_id,
                ...(isTemporaryPassword ? { must_change_password: true } : {})
            }
        });

        let targetId = '';
        if (createError) {
            if (createError.message.includes('already registered')) {
                const { data: users } = await supabaseAdmin.auth.admin.listUsers();
                targetId = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id || '';
                if (!targetId) throw createError;
            } else {
                throw createError;
            }
        } else {
            targetId = authData.user.id;
        }

        // 7. Update Profile
        const { error: upsertError } = await supabaseAdmin.from('profiles').upsert([
            { id: targetId, name, role, hospital_id, email }
        ]);

        if (upsertError) throw upsertError;

        return new Response(JSON.stringify({
            success: true,
            user_id: targetId,
            ...(isTemporaryPassword ? { temporary_password: finalPassword } : {})
        }), { status: 200, headers });

    } catch (error: any) {
        console.error('Critical Error:', error.message);
        return new Response(JSON.stringify({
            error: 'Erro ao processar criação',
            details: error.message
        }), { status: 400, headers });
    }
});

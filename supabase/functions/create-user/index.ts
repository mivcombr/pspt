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

const findUserByEmail = async (supabaseAdmin: ReturnType<typeof createClient>, email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const perPage = 1000
    let page = 1

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error) {
            return { user: null, error }
        }

        const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)
        if (match) {
            return { user: match, error: null }
        }

        if (data.users.length < perPage) {
            break
        }
        page += 1
    }

    return { user: null, error: null }
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight requests
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

        // Create a client with the Auth header to verify the caller's identity
        const authClient = createClient(supabaseUrl, supabaseServiceKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Create a separate client with Service Role for admin operations
        const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Verify the caller's identity
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
            console.error('Tentativa de criação sem permissão de admin:', caller.id, profileErr);
            return new Response(
                JSON.stringify({ error: 'Acesso negado: Administradores apenas' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        // 2. Get request body
        const { email, password, name, role, hospital_id } = await req.json()

        // Validate required fields
        if (!email || !password || !name || !role || !hospital_id) {
            return new Response(
                JSON.stringify({ error: 'Campos obrigatórios ausentes' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 3. Process User (Auth)
        const { user: existingUser, error: findError } = await findUserByEmail(adminClient, email)
        if (findError) console.error('Error finding user:', findError)

        let resolvedUser;

        if (existingUser) {
            // Update existing user in Auth
            console.log('User already exists in Auth, updating:', existingUser.id)
            const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
                password,
                email_confirm: true,
                user_metadata: { name, role, hospital_id }
            });

            if (updateError) {
                console.error('Error updating auth:', updateError.message);
                return new Response(
                    JSON.stringify({ error: 'Erro ao atualizar credenciais do usuário' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }
            resolvedUser = updated.user;
        } else {
            // Create new user in Auth
            const { data: created, error: createError } = await adminClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name, role, hospital_id }
            });

            if (createError) {
                console.error('Error creating auth:', createError.message);
                return new Response(
                    JSON.stringify({ error: 'Erro ao criar conta do usuário' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }
            resolvedUser = created.user;
        }

        // 4. Upsert Profile
        const profilePayload = {
            id: resolvedUser.id,
            name,
            role,
            hospital_id,
            email,
        }

        const { data: finalProfile, error: finalProfileErr } = await adminClient
            .from('profiles')
            .upsert([profilePayload], { onConflict: 'id' })
            .select('*')
            .single()

        if (finalProfileErr) {
            console.error('Error upserting profile:', finalProfileErr)
            // Still returning success for auth creation, but logging the error
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: { id: resolvedUser.id, email: resolvedUser.email, name, role, hospital_id },
                profile: finalProfile
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Internal Error:', (error as any)?.message);

        const rawMessage = String((error as any)?.message || '').toLowerCase();
        const isDuplicate = rawMessage.includes('already registered') || rawMessage.includes('already exists');

        return new Response(
            JSON.stringify({
                error: isDuplicate ? 'E-mail já cadastrado.' : 'Erro interno ao processar solicitação.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: isDuplicate ? 409 : 500 }
        )
    }
})

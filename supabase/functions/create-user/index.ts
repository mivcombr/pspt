import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    try {
        const authHeader = req.headers.get('Authorization')
        console.log('Auth header present:', !!authHeader)

        // Create a Supabase client with the Auth context of the logged in user
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader! },
                },
            }
        )

        // Verify the user is authenticated and is an admin
        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            console.error('User auth error:', userError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                }
            )
        }
        console.log('Authenticated user:', user.id)

        // Check if user is admin
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

        // Get request body
        const { email, password, name, role, hospital_id } = await req.json()

        // Validate required fields
        if (!email || !password || !name || !role || !hospital_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: email, password, name, role, hospital_id' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        // Validate role
        if (!['RECEPTION', 'FINANCIAL'].includes(role)) {
            return new Response(
                JSON.stringify({ error: 'Invalid role. Must be RECEPTION or FINANCIAL' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        // Create Supabase Admin client
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

        const { user: existingUser, error: existingError } = await findUserByEmail(supabaseAdmin, email)
        if (existingError) {
            console.error('Error checking existing user:', existingError)
        }

        let resolvedUser = existingUser

        if (resolvedUser) {
            // If user exists in Auth, we will update it.
            // We don't return 409 anymore, instead we "adopt" the existing user.
            // This handles cases where a user was deleted but Auth remained, 
            // or if the admin just wants to re-register/update the user.

            console.log('User already exists in Auth, updating:', resolvedUser.id)

            const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(resolvedUser.id, {
                password,
                email_confirm: true,
                user_metadata: {
                    name,
                    role,
                    hospital_id,
                }
            })

            if (updateError) {
                console.error('Error updating existing user:', updateError)
                return new Response(
                    JSON.stringify({ error: updateError.message }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 400,
                    }
                )
            }

            resolvedUser = updatedUser.user
        } else {
            // Create new user
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    name,
                    role,
                    hospital_id,
                }
            })

            if (createError) {
                console.error('Error creating user:', createError)
                return new Response(
                    JSON.stringify({ error: createError.message }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 400,
                    }
                )
            }

            resolvedUser = newUser.user
        }

        // Ensure profile exists and is updated
        const profilePayload = {
            id: resolvedUser.id,
            name,
            role,
            hospital_id,
            email,
        }

        const { data: newProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert([profilePayload], { onConflict: 'id' })
            .select('*')
            .single()

        if (profileError) {
            console.error('Error upserting profile:', profileError)
            // We still return success if Auth was created/updated, but log the profile error
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: resolvedUser.id,
                    email: resolvedUser.email,
                    name,
                    role,
                    hospital_id,
                },
                profile: newProfile
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        console.error('Error in create-user function:', error)
        const rawMessage = String((error as any)?.message || '')
        const normalized = rawMessage.toLowerCase()
        const isDuplicateEmail =
            normalized.includes('already registered')
            || normalized.includes('already exists')
            || normalized.includes('email already')
            || normalized.includes('user already')

        const status = isDuplicateEmail ? 409 : 500
        const message = isDuplicateEmail
            ? 'E-mail já cadastrado. Use outro e-mail ou recupere o acesso.'
            : (rawMessage || 'Erro ao criar usuário.')

        return new Response(
            JSON.stringify({ error: message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status,
            }
        )
    }
})

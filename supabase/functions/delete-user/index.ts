import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://saudeparatodos.cloud')
    .split(',')
    .map(o => o.trim())

const getCorsHeaders = (origin: string | null) => {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    }
}

serve(async (req) => {
    const origin = req.headers.get('Origin')
    const corsHeaders = getCorsHeaders(origin)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
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
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
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
            return new Response(
                JSON.stringify({ error: deleteAuthError.message }),
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
            return new Response(
                JSON.stringify({ error: deleteProfileError.message }),
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
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})

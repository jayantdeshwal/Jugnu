// Supabase Edge Function: verify-phone-auth
// Server-side MSG91 OTP Widget token verification and authoritative Supabase Auth session issuance.

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// @ts-ignore - Resolved at runtime in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const rawPhone = String(body.phone || '').trim()
    const accessToken = String(body.accessToken || '').trim()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined
    const personalEmail = typeof body.email === 'string' && body.email.includes('@')
      ? body.email.trim().toLowerCase()
      : undefined

    // 1. Validate inputs
    const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10)
    if (cleanDigits.length !== 10) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid 10-digit Indian mobile number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing OTP verification token. Please verify OTP first.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!MSG91_AUTH_KEY) {
      console.error('[verify-phone-auth] MSG91_AUTH_KEY secret is not configured!')
      return new Response(
        JSON.stringify({ error: 'Authentication service temporarily misconfigured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formattedPhone = `+91${cleanDigits}`
    const canonicalEmail = personalEmail || `${cleanDigits}@phone.jugnu.in`

    // 2. Server-side verification of MSG91 widget access token
    console.log('[verify-phone-auth] Verifying token with MSG91 for phone:', cleanDigits)
    const msg91Res = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'access-token': accessToken,
      }),
    })

    const msg91Data = await msg91Res.json().catch(() => ({}))
    console.log('[verify-phone-auth] MSG91 response status:', msg91Res.status, 'data type:', msg91Data?.type, 'message:', msg91Data?.message)

    // Robust MSG91 error detection:
    // On failure: HTTP non-200, type === 'error', code === '201', or message indicates failure/AuthenticationFailure.
    // On success: MSG91 returns HTTP 200 with { "mobile": "91...", "type": "mobile" }.
    const isMsg91Error =
      !msg91Res.ok ||
      msg91Data.type === 'error' ||
      String(msg91Data.code) === '201' ||
      Boolean(msg91Data.message && /fail|invalid|expired|unauthorized/i.test(String(msg91Data.message)))

    if (isMsg91Error) {
      console.warn('[verify-phone-auth] MSG91 verification rejected:', msg91Data)
      return new Response(
        JSON.stringify({ error: msg91Data.message || 'OTP verification failed or expired. Please retry.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Cryptographic binding assertion: verified mobile must match requested phone
    const verifiedMobileRaw = String(
      msg91Data.mobile || msg91Data.data?.mobile || msg91Data.number || msg91Data.data?.number || ''
    )
    const verifiedDigits = verifiedMobileRaw.replace(/\D/g, '').slice(-10)

    if (verifiedDigits && verifiedDigits !== cleanDigits) {
      console.warn(`[verify-phone-auth] Phone mismatch: requested ${cleanDigits}, verified ${verifiedDigits}`)
      return new Response(
        JSON.stringify({ error: 'Verified mobile number does not match requested login number.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Initialize Supabase Admin & Anon clients
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 5. Look up existing profile or auth user by phone or canonical email
    let authUser: any = null
    let isNewUser = false

    // Check profiles by phone
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role, phone')
      .eq('phone', formattedPhone)
      .maybeSingle()

    if (existingProfile) {
      // Reject admin accounts from the customer/worker OTP path
      if (existingProfile.role === 'super_admin' || existingProfile.role === 'sub_admin') {
        return new Response(
          JSON.stringify({ error: 'Administrator accounts must sign in through the Administrator portal.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: userData, error: getUserErr } = await adminClient.auth.admin.getUserById(existingProfile.id)
      if (!getUserErr && userData?.user) {
        authUser = userData.user
      }
    }

    // If not found by profile, look up by canonical email
    if (!authUser) {
      const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const userByEmail = usersData?.users.find((user) => user.email?.toLowerCase() === canonicalEmail)
      if (userByEmail) {
        authUser = userByEmail
      }
    }

    // 6. Create user if new
    if (!authUser) {
      isNewUser = true
      const { data: createdData, error: createErr } = await adminClient.auth.admin.createUser({
        phone: formattedPhone,
        email: canonicalEmail,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: fullName || 'User',
          phone: formattedPhone,
          role: 'customer',
        },
      })

      if (createErr) {
        // Handle concurrent OTP race: another request may have just created the same user
        if (createErr.message?.toLowerCase().includes('already') || createErr.message?.toLowerCase().includes('duplicate')) {
          const { data: retryUsersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
          const retryUser = retryUsersData?.users.find((user) => user.email?.toLowerCase() === canonicalEmail)
          if (retryUser) {
            authUser = retryUser
            isNewUser = false
          } else {
            console.error('[verify-phone-auth] createUser error (no retry match):', createErr)
            return new Response(
              JSON.stringify({ error: 'Could not provision account. Please retry.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          console.error('[verify-phone-auth] createUser error:', createErr)
          return new Response(
            JSON.stringify({ error: 'Could not provision account. Please retry.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        authUser = createdData.user
      }

      // Ensure profile row exists
      await adminClient.from('profiles').upsert({
        id: authUser.id,
        full_name: fullName || 'User',
        phone: formattedPhone,
        email: personalEmail || null,
        role: 'customer',
        updated_at: new Date().toISOString(),
      })
    }

    // 7. Ensure profile is updated with verified phone if missing
    const { data: currentProfile } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role, phone')
      .eq('id', authUser.id)
      .single()

    if (!currentProfile) {
      await adminClient.from('profiles').insert({
        id: authUser.id,
        full_name: fullName || authUser.user_metadata?.full_name || 'User',
        phone: formattedPhone,
        email: personalEmail || null,
        role: 'customer',
        updated_at: new Date().toISOString(),
      })
    } else if (!currentProfile.phone) {
      await adminClient.from('profiles').update({
        phone: formattedPhone,
        updated_at: new Date().toISOString(),
      }).eq('id', authUser.id)
    }

    const resolvedRole = currentProfile?.role || 'customer'
    const resolvedName = currentProfile?.full_name || fullName || authUser.user_metadata?.full_name || 'User'

    // 8. Generate real Supabase session tokens via magiclink token_hash exchange
    const targetEmail = authUser.email || canonicalEmail
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('[verify-phone-auth] generateLink error:', linkErr)
      return new Response(
        JSON.stringify({ error: 'Session token generation failed. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: sessionData, error: sessionErr } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'email',
    })

    if (sessionErr || !sessionData?.session) {
      console.error('[verify-phone-auth] verifyOtp session exchange error:', sessionErr)
      return new Response(
        JSON.stringify({ error: 'Session establishment failed. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[verify-phone-auth] Session established successfully for user ${authUser.id} (role: ${resolvedRole})`)

    return new Response(
      JSON.stringify({
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in: sessionData.session.expires_in,
          token_type: sessionData.session.token_type,
        },
        user: {
          id: authUser.id,
          name: resolvedName,
          phone: formattedPhone,
          email: currentProfile?.email || personalEmail || null,
          role: resolvedRole,
        },
        isNewUser,
        role: resolvedRole,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[verify-phone-auth] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error during phone verification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

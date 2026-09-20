// Supabase Edge Function: verify-admin-2fa
// Server-side admin 2FA authorization.
// Flow: valid Supabase JWT -> admin role check -> MSG91 token verification ->
//       phone binding check -> write admin_2fa_sessions (30-minute expiry).
// The session_id is extracted from the JWT server-side — never trusted from the client.

declare const Deno: {
  env: { get(key: string): string | undefined }
}

// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const MSG91_AUTH_KEY            = Deno.env.get('MSG91_AUTH_KEY') || ''
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const TWO_FA_LIFETIME_MINUTES = 30

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

/** Decode JWT payload without verifying signature (GoTrue already verified it via getUser). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded  = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
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
    // 1. Extract and validate Bearer JWT
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const jwt = authHeader.replace('Bearer ', '').trim()

    // 2. Verify JWT with GoTrue — this is the authoritative identity check
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await adminClient.auth.admin.getUser(jwt)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const authUser = userData.user

    // 3. Confirm admin role from database — never trust client-supplied role
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, role, phone')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Profile not found.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (profile.role !== 'super_admin' && profile.role !== 'sub_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: This account does not have administrator privileges.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Obtain canonical admin phone from database — never from client
    const rawDbPhone = String(profile.phone || '').replace(/\D/g, '').slice(-10)
    if (rawDbPhone.length !== 10) {
      return new Response(JSON.stringify({ error: 'Administrator account has no verified phone number. Contact Super Admin.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Parse request body — only the MSG91 access token is accepted from client
    const body = await req.json().catch(() => ({}))
    const accessToken = String(body.accessToken || '').trim()

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Missing MSG91 OTP access token.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!MSG91_AUTH_KEY) {
      console.error('[verify-admin-2fa] MSG91_AUTH_KEY secret is not configured!')
      return new Response(JSON.stringify({ error: 'Authentication service misconfigured. Contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Verify MSG91 access token server-side
    const msg91Res = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: { 'authkey': MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'access-token': accessToken }),
    })

    const msg91Data = await msg91Res.json().catch(() => ({}))
    console.log('[verify-admin-2fa] MSG91 response:', msg91Res.status, msg91Data?.type, msg91Data?.message)

    const isMsg91Error =
      !msg91Res.ok ||
      msg91Data.type === 'error' ||
      String(msg91Data.code) === '201' ||
      Boolean(msg91Data.message && /fail|invalid|expired|unauthorized/i.test(String(msg91Data.message)))

    if (isMsg91Error) {
      console.warn('[verify-admin-2fa] MSG91 rejected token:', msg91Data)
      return new Response(JSON.stringify({ error: msg91Data.message || 'OTP verification failed or expired. Please retry.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Cryptographic binding: verified phone must match admin's DB phone
    const verifiedRaw    = String(msg91Data.mobile || msg91Data.data?.mobile || msg91Data.number || msg91Data.data?.number || '')
    const verifiedDigits = verifiedRaw.replace(/\D/g, '').slice(-10)

    if (verifiedDigits && verifiedDigits !== rawDbPhone) {
      console.warn(`[verify-admin-2fa] Phone mismatch: db=${rawDbPhone}, verified=${verifiedDigits}`)
      return new Response(JSON.stringify({ error: 'Verified phone does not match the administrator account phone.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 8. Extract session_id from JWT payload server-side — never from client
    const jwtPayload = decodeJwtPayload(jwt)
    const sessionId  = jwtPayload?.session_id as string | undefined

    if (!sessionId) {
      console.error('[verify-admin-2fa] JWT has no session_id claim. Keys:', Object.keys(jwtPayload || {}))
      return new Response(JSON.stringify({ error: 'JWT session_id missing. Please sign out and sign in again.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 9. Write admin_2fa_sessions row via service_role — clients cannot do this directly
    const now       = new Date().toISOString()
    const expiresAt = new Date(Date.now() + TWO_FA_LIFETIME_MINUTES * 60 * 1000).toISOString()

    const { error: upsertErr } = await adminClient
      .from('admin_2fa_sessions')
      .upsert(
        {
          admin_id:    authUser.id,
          session_id:  sessionId,
          verified_at: now,
          expires_at:  expiresAt,
          updated_at:  now,
        },
        { onConflict: 'admin_id,session_id' }
      )

    if (upsertErr) {
      console.error('[verify-admin-2fa] Failed to write 2FA session:', upsertErr)
      return new Response(JSON.stringify({ error: 'Failed to establish 2FA authorization. Please retry.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[verify-admin-2fa] 2FA authorized: admin=${authUser.id}, session=${sessionId.slice(0, 8)}..., expires=${expiresAt}`)

    return new Response(
      JSON.stringify({
        success:            true,
        expires_at:         expiresAt,
        expires_in_minutes: TWO_FA_LIFETIME_MINUTES,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[verify-admin-2fa] Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error during 2FA verification.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

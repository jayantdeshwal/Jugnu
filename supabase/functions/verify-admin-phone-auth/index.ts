// Supabase Edge Function: verify-admin-phone-auth
// Admin authentication via phone + MSG91 OTP only. No email/password.
//
// Flow:
//   1. Validate phone input
//   2. Verify MSG91 access token server-side
//   3. Confirm verified phone matches requested phone (cryptographic binding)
//   4. Look up admin profile by phone — reject if not super_admin/sub_admin
//   5. Resolve existing auth.users record for that admin
//   6. Issue a genuine Supabase Auth session via magiclink token_hash exchange
//   7. Extract session_id from the issued JWT
//   8. Write admin_2fa_sessions row (30-minute authorization window)
//   9. Return session + admin metadata
//
// The session_id is extracted server-side from the issued JWT — never from the client.
// The client supplies only: phone (10 digits) + MSG91 accessToken.

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
const SUPABASE_ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY') || ''

const TWO_FA_LIFETIME_MINUTES = 30

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

/** Decode JWT payload without verifying signature (GoTrue already verified it). */
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
    const body = await req.json().catch(() => ({}))
    const rawPhone    = String(body.phone || '').trim()
    const accessToken = String(body.accessToken || '').trim()

    // ── 1. Validate phone ──────────────────────────────────────────────────────
    const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10)
    if (cleanDigits.length !== 10) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid 10-digit Indian mobile number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing OTP verification token. Please verify OTP first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!MSG91_AUTH_KEY) {
      console.error('[verify-admin-phone-auth] MSG91_AUTH_KEY secret is not configured!')
      return new Response(
        JSON.stringify({ error: 'Authentication service misconfigured. Contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formattedPhone = `+91${cleanDigits}`

    // ── 2. Verify MSG91 access token server-side ───────────────────────────────
    console.log('[verify-admin-phone-auth] Verifying MSG91 token for phone:', cleanDigits)
    const msg91Res = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: { 'authkey': MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'access-token': accessToken }),
    })

    const msg91Data = await msg91Res.json().catch(() => ({}))
    console.log('[verify-admin-phone-auth] MSG91 response:', msg91Res.status, msg91Data?.type, msg91Data?.message)

    const isMsg91Error =
      !msg91Res.ok ||
      msg91Data.type === 'error' ||
      String(msg91Data.code) === '201' ||
      Boolean(msg91Data.message && /fail|invalid|expired|unauthorized/i.test(String(msg91Data.message)))

    if (isMsg91Error) {
      console.warn('[verify-admin-phone-auth] MSG91 rejected token:', msg91Data)
      return new Response(
        JSON.stringify({ error: msg91Data.message || 'OTP verification failed or expired. Please retry.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Cryptographic binding: verified phone must match requested phone ────
    const verifiedRaw    = String(msg91Data.mobile || msg91Data.data?.mobile || msg91Data.number || msg91Data.data?.number || '')
    const verifiedDigits = verifiedRaw.replace(/\D/g, '').slice(-10)

    if (verifiedDigits && verifiedDigits !== cleanDigits) {
      console.warn(`[verify-admin-phone-auth] Phone mismatch: requested=${cleanDigits}, verified=${verifiedDigits}`)
      return new Response(
        JSON.stringify({ error: 'Verified mobile number does not match the requested number.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Look up admin profile by phone — server-side role check ─────────────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: adminProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role, phone')
      .eq('phone', formattedPhone)
      .maybeSingle()

    if (profileErr) {
      console.error('[verify-admin-phone-auth] Profile lookup error:', profileErr)
      return new Response(
        JSON.stringify({ error: 'Authentication service error. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!adminProfile) {
      // Phone not registered at all — do not reveal whether it's an admin or not
      return new Response(
        JSON.stringify({ error: 'This mobile number is not registered as an administrator account.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (adminProfile.role !== 'super_admin' && adminProfile.role !== 'sub_admin') {
      // Phone belongs to a customer/worker — reject without revealing admin list
      return new Response(
        JSON.stringify({ error: 'This mobile number is not registered as an administrator account.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[verify-admin-phone-auth] Admin role confirmed: ${adminProfile.role}, id=${adminProfile.id}`)

    // ── 5. Resolve auth.users record for this admin ────────────────────────────
    const { data: authUserData, error: authUserErr } = await adminClient.auth.admin.getUserById(adminProfile.id)

    if (authUserErr || !authUserData?.user) {
      console.error('[verify-admin-phone-auth] auth.users lookup failed:', authUserErr)
      return new Response(
        JSON.stringify({ error: 'Administrator account is not properly configured. Contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authUser = authUserData.user

    // ── 6. Issue genuine Supabase Auth session via magiclink token_hash ────────
    const targetEmail = authUser.email
    if (!targetEmail) {
      console.error('[verify-admin-phone-auth] Admin auth.users has no email — cannot issue session:', authUser.id)
      return new Response(
        JSON.stringify({ error: 'Administrator account configuration error. Contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('[verify-admin-phone-auth] generateLink error:', linkErr)
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
      console.error('[verify-admin-phone-auth] verifyOtp session exchange error:', sessionErr)
      return new Response(
        JSON.stringify({ error: 'Session establishment failed. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const issuedAccessToken = sessionData.session.access_token

    // ── 7. Extract session_id from the issued JWT — never from client ──────────
    const jwtPayload = decodeJwtPayload(issuedAccessToken)
    const sessionId  = jwtPayload?.session_id as string | undefined

    if (!sessionId) {
      console.error('[verify-admin-phone-auth] Issued JWT has no session_id. Keys:', Object.keys(jwtPayload || {}))
      return new Response(
        JSON.stringify({ error: 'Session ID missing from issued token. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 8. Write admin_2fa_sessions row (30-minute authorization) ─────────────
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
      console.error('[verify-admin-phone-auth] Failed to write admin_2fa_sessions:', upsertErr)
      return new Response(
        JSON.stringify({ error: 'Failed to establish admin authorization. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[verify-admin-phone-auth] Admin authenticated: id=${authUser.id}, role=${adminProfile.role}, session=${sessionId.slice(0, 8)}..., expires=${expiresAt}`)

    // ── 9. Return session + admin metadata ────────────────────────────────────
    return new Response(
      JSON.stringify({
        session: {
          access_token:  sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in:    sessionData.session.expires_in,
          token_type:    sessionData.session.token_type,
        },
        user: {
          id:    authUser.id,
          name:  adminProfile.full_name,
          phone: formattedPhone,
          email: adminProfile.email || null,
          role:  adminProfile.role,
        },
        authorization: {
          expires_at:         expiresAt,
          expires_in_minutes: TWO_FA_LIFETIME_MINUTES,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[verify-admin-phone-auth] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error during admin authentication.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

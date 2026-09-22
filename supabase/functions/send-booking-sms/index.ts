// Supabase Edge Function: send-booking-sms
// Dispatches transactional booking SMS alerts via MSG91 Flow API
// Hardened: Server-authoritative recipient lookup, JWT verification, and strict event allowlist

// Ambient Deno type declaration for IDE compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// @ts-ignore - Deno remote URL imports are resolved at runtime by Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY') || ''
const MSG91_FLOW_BOOKING_CREATED = Deno.env.get('MSG91_FLOW_BOOKING_CREATED') || ''
const MSG91_FLOW_BOOKING_ACCEPTED = Deno.env.get('MSG91_FLOW_BOOKING_ACCEPTED') || ''
const MSG91_FLOW_BOOKING_COMPLETED = Deno.env.get('MSG91_FLOW_BOOKING_COMPLETED') || ''
const MSG91_FLOW_BOOKING_CANCELLED = Deno.env.get('MSG91_FLOW_BOOKING_CANCELLED') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

const ALLOWED_EVENTS = [
  'booking_created',
  'booking_accepted',
  'booking_completed',
  'booking_cancelled',
] as const

type AllowedEvent = typeof ALLOWED_EVENTS[number]

interface RequestPayload {
  event: AllowedEvent
  booking_id: string
}

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
    // 1. Verify caller authentication via Supabase JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Empty bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: userError } = await authSupabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid caller session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerId = userData.user.id

    // 2. Parse and validate request body
    const body: Partial<RequestPayload> = await req.json().catch(() => ({}))
    const { event, booking_id } = body

    if (!event || !ALLOWED_EVENTS.includes(event as AllowedEvent)) {
      return new Response(
        JSON.stringify({
          error: `Invalid event. Allowed events: ${ALLOWED_EVENTS.join(', ')}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!booking_id || !uuidRegex.test(booking_id)) {
      return new Response(
        JSON.stringify({ error: 'Valid booking_id UUID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // 3. Query authoritative booking record using server-side service role
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: booking, error: bookingErr } = await adminSupabase
      .from('bookings')
      .select('id, customer_id, worker_id, category_id, status, scheduled_at, address')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Check caller authorization: Must be customer, worker, or administrator
    const { data: callerProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .single()

    const isSuperAdmin = callerProfile?.role === 'super_admin'
    const isSubAdmin = callerProfile?.role === 'sub_admin'
    const isAdmin = isSuperAdmin || isSubAdmin
    const isCustomer = callerId === booking.customer_id
    const isWorker = callerId === booking.worker_id

    if (!isAdmin && !isCustomer && !isWorker) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You are not a participant in this booking' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify event-caller alignment
    if (!isAdmin) {
      if (event === 'booking_created' && !isCustomer) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only the booking customer may trigger booking_created alert' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      if ((event === 'booking_accepted' || event === 'booking_completed') && !isWorker) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only the assigned worker may trigger this status alert' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // A completion SMS is only valid after the authoritative booking state
    // has reached completed. Other SMS event behavior remains unchanged.
    if (event === 'booking_completed' && booking.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Booking is not completed' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Authoritatively determine recipient and lookup profiles from database
    // For booking_created: recipient is assigned worker
    // For booking_accepted / completed: recipient is customer
    // For booking_cancelled: recipient is the opposing party
    let targetRecipientId: string
    if (event === 'booking_created') {
      targetRecipientId = booking.worker_id
    } else if (event === 'booking_accepted' || event === 'booking_completed') {
      targetRecipientId = booking.customer_id
    } else {
      // booking_cancelled
      targetRecipientId = isCustomer ? booking.worker_id : booking.customer_id
    }

    const { data: recipientProfile } = await adminSupabase
      .from('profiles')
      .select('phone, full_name')
      .eq('id', targetRecipientId)
      .single()

    const { data: customerProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', booking.customer_id)
      .single()

    const { data: workerProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', booking.worker_id)
      .single()

    const { data: categoryData } = await adminSupabase
      .from('categories')
      .select('name_en')
      .eq('id', booking.category_id)
      .maybeSingle()

    const rawRecipientPhone = recipientProfile?.phone || ''
    const cleanDigits = rawRecipientPhone.replace(/\D/g, '').slice(-10)

    if (cleanDigits.length !== 10) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Recipient has no valid mobile number configured in profile.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const formattedRecipientPhone = `91${cleanDigits}`
    const recipientName = recipientProfile?.full_name || 'Valued User'
    const customerName = customerProfile?.full_name || 'Customer'
    const workerName = workerProfile?.full_name || 'Jugnu Artisan'
    const serviceCategory = categoryData?.name_en || booking.category_id

    // 6. Trigger MSG91 Flow API if configured
    let flowId = ''
    if (event === 'booking_created') flowId = MSG91_FLOW_BOOKING_CREATED
    else if (event === 'booking_accepted') flowId = MSG91_FLOW_BOOKING_ACCEPTED
    else if (event === 'booking_completed') flowId = MSG91_FLOW_BOOKING_COMPLETED
    else if (event === 'booking_cancelled') flowId = MSG91_FLOW_BOOKING_CANCELLED

    if (MSG91_AUTH_KEY && flowId) {
      const msg91Res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: MSG91_AUTH_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          template_id: flowId,
          short_url: '0',
          recipients: [
            {
              mobiles: formattedRecipientPhone,
              name: recipientName,
              worker: workerName,
              customer: customerName,
              service: serviceCategory,
            },
          ],
        }),
      })

      const msg91Data = await msg91Res.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: true, event, flowId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default simulated response when MSG91 flow templates are pending DLT configuration
    return new Response(
      JSON.stringify({
        success: true,
        simulated: true,
        event,
        message: `Booking notification queued for dispatch to ${formattedRecipientPhone.slice(0, 4)}XXXXXX`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error processing notification' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

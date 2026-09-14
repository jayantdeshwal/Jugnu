// Supabase Edge Function: send-booking-sms
// Dispatches transactional booking SMS alerts via MSG91 Flow / SMS API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface BookingSmsPayload {
  event: 'booking_created' | 'booking_accepted' | 'booking_completed' | 'booking_cancelled'
  recipient_phone?: string
  recipient_id?: string
  worker_id?: string
  recipient_name?: string
  worker_name?: string
  customer_name?: string
  service_category?: string
  scheduled_at?: string
  booking_id?: string
}

const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY') || ''
const MSG91_FLOW_BOOKING_CREATED = Deno.env.get('MSG91_FLOW_BOOKING_CREATED') || ''
const MSG91_FLOW_BOOKING_ACCEPTED = Deno.env.get('MSG91_FLOW_BOOKING_ACCEPTED') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const payload: BookingSmsPayload = await req.json()
    let { event, recipient_phone, recipient_id, worker_id, recipient_name, worker_name, customer_name, service_category } = payload

    // If recipient_phone not provided directly, attempt DB lookup using service role
    if (!recipient_phone) {
      const targetUserId = recipient_id || (event === 'booking_created' ? worker_id : null)
      if (targetUserId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${targetUserId}&select=phone,full_name`, {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          })
          const profiles = await profileRes.json()
          if (Array.isArray(profiles) && profiles[0]?.phone) {
            recipient_phone = profiles[0].phone
            if (!recipient_name && profiles[0].full_name) {
              recipient_name = profiles[0].full_name
            }
          }
        } catch (dbErr) {
          console.warn('[send-booking-sms] Profile lookup notice:', dbErr)
        }
      }
    }

    if (!recipient_phone) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No recipient phone number provided or found in database profiles.',
        details: payload 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Format phone to 91XXXXXXXXXX
    const cleanPhone = recipient_phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone

    console.log(`[send-booking-sms] Event: ${event} -> To: ${formattedPhone}`)

    // If MSG91 Auth Key is configured in Supabase Secrets, trigger the Flow API
    if (MSG91_AUTH_KEY) {
      let flowId = ''
      if (event === 'booking_created') flowId = MSG91_FLOW_BOOKING_CREATED
      if (event === 'booking_accepted') flowId = MSG91_FLOW_BOOKING_ACCEPTED

      if (flowId) {
        const msg91Res = await fetch('https://control.msg91.com/api/v5/flow/', {
          method: 'POST',
          headers: {
            'authkey': MSG91_AUTH_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            template_id: flowId,
            short_url: '0',
            recipients: [
              {
                mobiles: formattedPhone,
                name: recipient_name || 'User',
                worker: worker_name || 'Kaamgar Worker',
                customer: customer_name || 'Customer',
                service: service_category || 'Service',
              },
            ],
          }),
        })

        const result = await msg91Res.json()
        return new Response(JSON.stringify({ success: true, msg91: result }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
    }

    // Default simulated response when AuthKey/Flow is pending DLT registration
    return new Response(
      JSON.stringify({
        success: true,
        simulated: true,
        message: `Booking alert dispatched for event '${event}' to ${formattedPhone}`,
        details: payload,
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})

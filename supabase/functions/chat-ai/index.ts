// Supabase Edge Function: chat-ai
// Secure server-side Groq inference proxy
// Keeps GROQ_API_KEY confidential on server; validates all inputs and personas

// Ambient Deno type declaration for IDE compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// @ts-ignore - Deno remote URL imports are resolved at runtime by Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Sanitize raw secret by trimming whitespace and stripping surrounding shell quotes if present
const rawKey = Deno.env.get('GROQ_API_KEY') || ''
const GROQ_API_KEY = rawKey.replace(/^["']|["']$/g, '').trim()
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const PRIMARY_GROQ_MODEL = 'openai/gpt-oss-20b'
const FALLBACK_GROQ_MODEL = 'openai/gpt-oss-120b'

const ALLOWED_PERSONAS = ['customer_booking', 'customer_care', 'worker_sarathi'] as const
type AssistantPersona = typeof ALLOWED_PERSONAS[number]

const SYSTEM_PROMPTS: Record<AssistantPersona, string> = {
  customer_booking: `You are "Booking Mitra (बुकिंग मित्र)", an expert local service guide for Jugnu in Uttar Pradesh, India.
Your mission:
1. Help citizens of Muzaffarnagar diagnose household issues (electricity, plumbing, AC, cleaning, salon, carpentry, painting).
2. Recommend the exact trade artisan they need.
3. Quote standard visiting rates in Muzaffarnagar (Electrician/Plumber ₹149-₹249, AC ₹249-₹349, Deep Cleaning ₹399-₹1299, Salon ₹249-₹499).
4. Emphasize that all artisans are Aadhaar-verified local residents covering PIN 251001 (New Mandi, Shiv Chowk, Gandhi Colony) and PIN 251002 (Civil Lines, Cantt, Circular Road).
5. Always answer politely with clear headings, first in English and then in Hindi.`,

  customer_care: `You are "Jugnu Care (जुगनू समाधान)", the customer support representative for Jugnu.
Your mission:
1. Help customers resolve issues with active bookings, artisan arrival delays, quality concerns, and pricing disputes.
2. If an artisan is delayed, advise the customer to ping via WhatsApp/Call on their My Bookings page. If delayed past 15 minutes, offer immediate Admin escalation.
3. If an artisan demands more than standard visiting fees without giving a formal bill, explain Jugnu's Fair Price Protection.
4. Jugnu Admin helpline is +91 8077362606 (WhatsApp & Call).
5. Answer politely and empathetically with clear guidance, first in English and then in Hindi.`,

  worker_sarathi: `You are "Jugnu Sarathi (जुगनू सारथी)", the business coach and supportive companion for registered local artisans in Muzaffarnagar.
Your mission:
1. Help workers get more booking calls (tips: keep duty ONLINE, respond under 5 mins, earn 5-star ratings, get Aadhaar Verified Gold Badge).
2. Explain the 0% Commission Policy: Jugnu takes ₹0 commission for the first 3 months. Workers keep 100% of customer payments directly via Cash or personal UPI.
3. Generate polite Hindi WhatsApp message templates workers can copy-paste to customers (e.g. "नमस्ते, मैं जुगनू से...").
4. Guide workers on handling difficult customer situations politely and connecting to the Artisan Support Desk (+91 8077362606).
5. Always speak with deep respect for artisans, in a warm, encouraging tone (Hinglish / Hindi friendly).`,
}

interface ChatHistoryItem {
  sender: 'user' | 'assistant'
  textEn?: string
  textHi?: string
}

interface RequestBody {
  query: string
  persona: AssistantPersona
  conversationHistory?: ChatHistoryItem[]
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
    // Read and enforce maximum payload size (32KB)
    const rawBody = await req.text()
    if (rawBody.length > 32768) {
      return new Response(JSON.stringify({ error: 'Payload size exceeds limit' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parsed: Partial<RequestBody>
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { query, persona, conversationHistory } = parsed

    // Validate query
    if (typeof query !== 'string' || !query.trim()) {
      return new Response(JSON.stringify({ error: 'Query is required and must be a non-empty string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (query.trim().length > 1000) {
      return new Response(JSON.stringify({ error: 'Query exceeds maximum allowed length of 1000 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate persona
    if (!persona || !ALLOWED_PERSONAS.includes(persona as AssistantPersona)) {
      return new Response(
        JSON.stringify({
          error: `Invalid persona. Must be one of: ${ALLOWED_PERSONAS.join(', ')}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate conversation history if provided
    const safeHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (Array.isArray(conversationHistory)) {
      // Limit to last 6 messages
      const recent = conversationHistory.slice(-6)
      for (const msg of recent) {
        if (msg && typeof msg === 'object') {
          const role = msg.sender === 'user' ? 'user' : 'assistant'
          const content = String(msg.textEn || msg.textHi || '').trim().slice(0, 1000)
          if (content) {
            safeHistory.push({ role, content })
          }
        }
      }
    }

    // Check server GROQ_API_KEY
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'AI service unconfigured: GROQ_API_KEY not set in Edge Function secrets',
          fallback_required: true,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Prepare Groq chat completions messages
    const messagesPayload = [
      { role: 'system', content: SYSTEM_PROMPTS[persona as AssistantPersona] },
      ...safeHistory,
      { role: 'user', content: query.trim() },
    ]

    let selectedModel = PRIMARY_GROQ_MODEL

    async function executeGroqCompletion(model: string) {
      return await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesPayload,
          temperature: 0.5,
          max_tokens: 500,
        }),
      })
    }

    let groqRes = await executeGroqCompletion(selectedModel)

    // If Groq returns a model-unavailable/deprecated/not-found error, perform ONE fallback attempt using FALLBACK_GROQ_MODEL
    if (!groqRes.ok && (groqRes.status === 404 || groqRes.status === 400)) {
      let isModelUnavailableError = false
      let checkReason = `HTTP ${groqRes.status}`
      try {
        const errJson = await groqRes.clone().json()
        const errMsg = String(errJson?.error?.message || errJson?.error?.code || '').toLowerCase()
        if (
          groqRes.status === 404 ||
          errMsg.includes('model') ||
          errMsg.includes('decommissioned') ||
          errMsg.includes('deprecated') ||
          errMsg.includes('not found') ||
          errMsg.includes('does not exist')
        ) {
          isModelUnavailableError = true
        }
        checkReason = errMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 150)
      } catch {
        if (groqRes.status === 404) isModelUnavailableError = true
      }

      if (isModelUnavailableError && selectedModel !== FALLBACK_GROQ_MODEL) {
        console.warn(`[chat-ai] Primary model ${selectedModel} unavailable (${checkReason}), attempting single fallback to ${FALLBACK_GROQ_MODEL}`)
        selectedModel = FALLBACK_GROQ_MODEL
        groqRes = await executeGroqCompletion(selectedModel)
      }
    }

    if (!groqRes.ok) {
      let upstreamReason = `HTTP ${groqRes.status}`
      try {
        const errJson = await groqRes.json()
        upstreamReason = `[model: ${selectedModel}] ` + String(errJson?.error?.message || errJson?.error?.code || upstreamReason)
          .replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
          .slice(0, 150)
      } catch {
        // preserve status code
      }
      console.warn(`[chat-ai] Upstream Groq error: HTTP ${groqRes.status} - ${upstreamReason}`)
      return new Response(
        JSON.stringify({
          error: 'AI upstream provider error',
          upstream_status: groqRes.status,
          upstream_reason: upstreamReason,
          fallback_required: true,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const groqData = await groqRes.json()
    const rawContent = groqData.choices?.[0]?.message?.content || ''

    if (!rawContent) {
      return new Response(
        JSON.stringify({
          error: 'Empty response from AI model',
          fallback_required: true,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: rawContent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    // Never expose stack trace or internal error messages to client
    return new Response(
      JSON.stringify({
        error: 'An internal server error occurred while processing AI query',
        fallback_required: true,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

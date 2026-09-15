import { AssistantPersona, ChatAction, ChatMessage } from './types'
import { MUZAFFARNAGAR_KNOWLEDGE } from './domainKnowledge'

interface GenerateResponseParams {
  query: string
  persona: AssistantPersona
  conversationHistory?: ChatMessage[]
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

export async function processAiQuery({
  query,
  persona,
  conversationHistory = [],
}: GenerateResponseParams): Promise<ChatMessage> {
  const normalizedQuery = query.toLowerCase().trim()
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  // If Groq API Key is configured in .env, query Groq high-speed LLaMA inference
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const groqResponse = await callGroqCloud({
        query,
        persona,
        apiKey: apiKey.trim(),
        conversationHistory,
      })
      if (groqResponse) return groqResponse
    } catch (err) {
      console.warn('Groq API call failed, seamlessly falling back to local Kaamgar domain engine:', err)
    }
  }

  // Instant Local Domain Intelligence Engine (0ms latency, high precision for Muzaffarnagar)
  return resolveLocalQuery(normalizedQuery, persona)
}

// Call Groq LLaMA 3.3 API
async function callGroqCloud({
  query,
  persona,
  apiKey,
  conversationHistory = [],
}: {
  query: string
  persona: AssistantPersona
  apiKey: string
  conversationHistory?: ChatMessage[]
}): Promise<ChatMessage | null> {
  const model = import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL

  const systemPrompts: Record<AssistantPersona, string> = {
    customer_booking: `You are "Booking Mitra (बुकिंग मित्र)", an expert local service guide for Muzaffarnagar Kaamgar in Uttar Pradesh, India.
Your mission:
1. Help citizens of Muzaffarnagar diagnose household issues (electricity, plumbing, AC, cleaning, salon, carpentry, painting).
2. Recommend the exact trade artisan they need.
3. Quote standard visiting rates in Muzaffarnagar (Electrician/Plumber ₹149-₹249, AC ₹249-₹349, Deep Cleaning ₹399-₹1299, Salon ₹249-₹499).
4. Emphasize that all artisans are Aadhaar-verified local residents covering PIN 251001 (New Mandi, Shiv Chowk, Gandhi Colony) and PIN 251002 (Civil Lines, Cantt, Circular Road).
5. Always answer politely with clear headings, first in English and then in Hindi.`,

    customer_care: `You are "Kaamgar Care (कामगार समाधान)", the customer support representative for Muzaffarnagar Kaamgar.
Your mission:
1. Help customers resolve issues with active bookings, artisan arrival delays, quality concerns, and pricing disputes.
2. If an artisan is delayed, advise the customer to ping via WhatsApp/Call on their My Bookings page. If delayed past 15 minutes, offer immediate Admin escalation.
3. If an artisan demands more than standard visiting fees without giving a formal bill, explain Kaamgar's Fair Price Protection.
4. Muzaffarnagar Kaamgar Admin helpline is +91 8077362606 (WhatsApp & Call).
5. Answer politely and empathetically with clear guidance, first in English and then in Hindi.`,

    worker_sarathi: `You are "Kaamgar Sarathi (कामगार सारथी)", the business coach and supportive companion for registered local artisans (Kaamgars) in Muzaffarnagar.
Your mission:
1. Help workers get more booking calls (tips: keep duty ONLINE, respond under 5 mins, earn 5-star ratings, get Aadhaar Verified Gold Badge).
2. Explain the 0% Commission Policy: Muzaffarnagar Kaamgar takes ₹0 commission for the first 3 months. Workers keep 100% of customer payments directly via Cash or personal UPI.
3. Generate polite Hindi WhatsApp message templates workers can copy-paste to customers (e.g. "नमस्ते, मैं मुजफ्फरनगर कामगार से...").
4. Guide workers on handling difficult customer situations politely and connecting to the Artisan Support Desk (+91 8077362606).
5. Always speak with deep respect for artisans, in a warm, encouraging tone (Hinglish / Hindi friendly).`,
  }

  // Format past history into Groq chat format (last 6 messages for context)
  const recentHistory = conversationHistory.slice(-6).map(m => ({
    role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.textEn || m.textHi,
  }))

  const messagesPayload = [
    { role: 'system', content: systemPrompts[persona] },
    ...recentHistory,
    { role: 'user', content: query },
  ]

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messagesPayload,
      temperature: 0.3,
      max_tokens: 650,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.warn(`Groq API error HTTP ${response.status}:`, errBody)
    return null
  }

  const data = await response.json()
  const textContent = data?.choices?.[0]?.message?.content?.trim()
  if (!textContent) return null

  // Attach relevant action buttons based on persona and query content
  const actions = extractContextualActions(query, persona)

  return {
    id: 'groq_' + Date.now(),
    sender: 'assistant',
    persona,
    timestamp: new Date(),
    textEn: textContent,
    textHi: textContent,
    actions,
  }
}

function extractContextualActions(query: string, persona: AssistantPersona): ChatAction[] {
  const q = query.toLowerCase()
  const actions: ChatAction[] = []

  if (persona === 'customer_booking') {
    if (q.includes('electric') || q.includes('mcb') || q.includes('spark') || q.includes('fan') || q.includes('बिजली')) {
      actions.push({
        id: 'act_find_electrician',
        labelEn: 'Find Electricians in Muzaffarnagar',
        labelHi: 'इलेक्ट्रीशियन खोजें',
        type: 'navigate',
        payload: '/search?category=electrician',
        icon: 'Zap',
      })
    } else if (q.includes('plumb') || q.includes('leak') || q.includes('pipe') || q.includes('tank') || q.includes('नल')) {
      actions.push({
        id: 'act_find_plumber',
        labelEn: 'Find Plumbers in Muzaffarnagar',
        labelHi: 'प्लंबर खोजें',
        type: 'navigate',
        payload: '/search?category=plumber',
        icon: 'Droplet',
      })
    } else if (q.includes('ac') || q.includes('cool') || q.includes('fridge') || q.includes('एसी')) {
      actions.push({
        id: 'act_find_ac',
        labelEn: 'Book AC Repair Service',
        labelHi: 'AC मैकेनिक खोजें',
        type: 'navigate',
        payload: '/search?category=ac_repair',
        icon: 'Wind',
      })
    } else if (q.includes('clean') || q.includes('सफाई') || q.includes('pest')) {
      actions.push({
        id: 'act_find_clean',
        labelEn: 'Book Deep Cleaning Service',
        labelHi: 'सफाई सेवा बुक करें',
        type: 'navigate',
        payload: '/search?category=cleaning',
        icon: 'Sparkles',
      })
    } else if (q.includes('salon') || q.includes('spa') || q.includes('hair') || q.includes('सैलून')) {
      actions.push({
        id: 'act_men_salon',
        labelEn: "Men's Salon at Home",
        labelHi: 'पुरुष सैलून',
        type: 'navigate',
        payload: '/search?category=men_salon',
        icon: 'Scissors',
      })
      actions.push({
        id: 'act_women_spa',
        labelEn: "Women's Salon & Spa",
        labelHi: 'महिला सैलून व स्पा',
        type: 'navigate',
        payload: '/search?category=women_spa',
        icon: 'Heart',
      })
    } else {
      actions.push({
        id: 'act_search_all',
        labelEn: 'Browse All Categories',
        labelHi: 'सभी सेवाएं देखें',
        type: 'navigate',
        payload: '/search',
        icon: 'Search',
      })
    }
  } else if (persona === 'customer_care') {
    actions.push({
      id: 'act_view_my_bookings',
      labelEn: 'Go to My Bookings',
      labelHi: 'मेरी बुकिंग देखें',
      type: 'navigate',
      payload: '/bookings',
      icon: 'Calendar',
    })
    actions.push({
      id: 'act_wa_admin',
      labelEn: 'WhatsApp Admin Desk',
      labelHi: 'व्हाट्सऐप एडमिन डेस्क',
      type: 'external_link',
      payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Kaamgar%20Customer%20Support%3A%20${encodeURIComponent(query)}`,
      icon: 'MessageCircle',
    })
  } else if (persona === 'worker_sarathi') {
    if (q.includes('way') || q.includes('message') || q.includes('whatsapp') || q.includes('रास्ते') || q.includes('मैसेज')) {
      const templateText = `नमस्ते! मैं मुज़फ़्फ़रनगर कामगार से आपका कारीगर हूँ। मैं आपकी बताई लोकेशन के लिए निकल चुका हूँ और 20 मिनट में पहुँच रहा हूँ।`
      actions.push({
        id: 'act_copy_arrival_msg',
        labelEn: 'Copy Arrival Message',
        labelHi: 'मैसेज कॉपी करें',
        type: 'copy_text',
        payload: templateText,
        icon: 'Copy',
      })
    }
    actions.push({
      id: 'act_worker_home',
      labelEn: 'Worker Workspace',
      labelHi: 'डैशबोर्ड पर जाएँ',
      type: 'navigate',
      payload: '/worker/dashboard',
      icon: 'Briefcase',
    })
    actions.push({
      id: 'act_wa_helpline',
      labelEn: 'Artisan Support WhatsApp',
      labelHi: 'कारीगर सहायता',
      type: 'external_link',
      payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Kaamgar%20Artisan%20Query%3A%20${encodeURIComponent(query)}`,
      icon: 'MessageCircle',
    })
  }

  return actions
}

// Local Domain Intelligence Fallback Engine
function resolveLocalQuery(query: string, persona: AssistantPersona): ChatMessage {
  const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)

  // ==========================================
  // PERSONA 1: CUSTOMER BOOKING & TRADE GUIDE
  // ==========================================
  if (persona === 'customer_booking') {
    // 1. Electrical / MCB / Sparking / Light / Wiring
    if (query.includes('electric') || query.includes('mcb') || query.includes('spark') || query.includes('fan') || query.includes('light') || query.includes('पंख') || query.includes('बिजली')) {
      const actions: ChatAction[] = [
        {
          id: 'act_find_electrician',
          labelEn: 'Find Electricians in Muzaffarnagar',
          labelHi: 'इलेक्ट्रीशियन खोजें',
          type: 'navigate',
          payload: '/search?category=electrician',
          icon: 'Zap',
        },
        {
          id: 'act_view_all',
          labelEn: 'View All Trades',
          labelHi: 'सभी कारीगर देखें',
          type: 'navigate',
          payload: '/search',
          icon: 'Search',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `⚡ **Recommended Service: Electrician (इलेक्ट्रीशियन)**\n\n- **Safety Tip**: Please turn off the main switch / MCB immediately if you notice sparking or burning smell.\n- **Standard Visiting Fee**: ₹149 - ₹199 across Muzaffarnagar (251001 & 251002).\n- **Typical Scope**: Switchboard repairs, MCB replacement, fan regulator fixing, ceiling fan installation, inverter connection.\n- **Arrival Time**: Verified local electricians arrive within 30-45 minutes in New Mandi, Civil Lines, and Roorkee Road.`,
        textHi: `⚡ **सुझाई गई सेवा: इलेक्ट्रीशियन (बिजली मिस्त्री)**\n\n- **सुरक्षा सलाह**: अगर स्पार्किंग या जलने की गंध आ रही हो, तो तुरंत मुख्य MCB / मेन स्विच बंद कर दें।\n- **विजिटिंग शुल्क**: मुज़फ़्फ़रनगर में ₹149 - ₹199 (251001 व 251002 में)।\n- **प्रमुख कार्य**: स्विचबोर्ड मरम्मत, MCB बदलना, पंखा लगाना, इन्वर्टर वायरिंग।\n- **पहुँचने का समय**: नई मंडी, सिविल लाइन्स और रुड़की रोड में 30-45 मिनट में उपलब्ध।`,
        actions,
      }
    }

    // 2. Plumbing / Leakage / Tap / Tank / Motor
    if (query.includes('plumb') || query.includes('leak') || query.includes('pipe') || query.includes('tank') || query.includes('tap') || query.includes('पानी') || query.includes('नल') || query.includes('टंकी')) {
      const actions: ChatAction[] = [
        {
          id: 'act_find_plumber',
          labelEn: 'Find Plumbers in Muzaffarnagar',
          labelHi: 'प्लंबर खोजें',
          type: 'navigate',
          payload: '/search?category=plumber',
          icon: 'Droplet',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `🚰 **Recommended Service: Plumber (प्लंबर)**\n\n- **Emergency Tip**: If water is overflowing or pipe has burst, immediately close the main gate valve near your overhead water tank.\n- **Standard Visiting Fee**: ₹149 - ₹249 depending on locality.\n- **Typical Scope**: Concealed pipe leak diagnosis, tap/mixer replacement, flush tank ball-cock repair, motor pump priming.\n- **Coverage**: Verified plumbers available in Civil Lines, New Mandi, Gandhi Colony, and Circular Road.`,
        textHi: `🚰 **सुझाई गई सेवा: प्लंबर (नलसाज)**\n\n- **आपातकालीन सलाह**: अगर पाइप फट गया है या टंकी ओवरफ्लो हो रही है, तो सबसे पहले छत की टंकी के पास लगा मुख्य वाल्व बंद कर दें।\n- **विजिटिंग शुल्क**: मुज़फ़्फ़रनगर में ₹149 - ₹249।\n- **प्रमुख कार्य**: पाइप लीकेज मरम्मत, नल बदलना, फ्लश टैंक रिपेयर, मोटर पंप फिटिंग।\n- **कवरेज**: सिविल लाइन्स, नई मंडी, गांधी कॉलोनी और सर्कुलर रोड में उपलब्ध।`,
        actions,
      }
    }

    // 3. AC & Appliance Repair
    if (query.includes('ac') || query.includes('cool') || query.includes('fridge') || query.includes('appliance') || query.includes('कूल') || query.includes('एसी') || query.includes('गैस')) {
      const actions: ChatAction[] = [
        {
          id: 'act_find_ac',
          labelEn: 'Book AC & Appliance Technician',
          labelHi: 'AC मैकेनिक खोजें',
          type: 'navigate',
          payload: '/search?category=ac_repair',
          icon: 'Wind',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `❄️ **Recommended Service: AC & Appliance Repair**\n\n- **Common Problem**: If your split/window AC runs but does not cool, it is usually due to choked air filters, outdoor fan dust, or low refrigerant gas.\n- **Standard Inspection Fee**: ₹249 - ₹349.\n- **Full Jet Service**: ₹499 per unit (deep foam and water jet pressure wash).\n- **Refrigerant Gas Refill**: Typically ₹1400 - ₹2000 depending on gas type (R32 / R410A / R22) with warranty.`,
        textHi: `❄️ **सुझाई गई सेवा: AC व उपकरण मरम्मत**\n\n- **सामान्य कारण**: यदि AC हवा दे रहा है लेकिन ठंडक नहीं कर रहा, तो आमतौर पर फ़िल्टर चोक होने या गैस कम होने की वजह से होता है।\n- **जांच शुल्क**: ₹249 - ₹349।\n- **जेट सर्विसिंग**: ₹499 प्रति यूनिट (डीप वाटर व फोम जेट वॉश)।\n- **गैस रिफिल**: गैस के प्रकार (R32/R410/R22) के अनुसार ₹1400 - ₹2000 वारंटी के साथ।`,
        actions,
      }
    }

    // 4. Cleaning & Pest Control
    if (query.includes('clean') || query.includes('pest') || query.includes('घर') || query.includes('सफाई') || query.includes('कॉकरोच')) {
      const actions: ChatAction[] = [
        {
          id: 'act_find_clean',
          labelEn: 'Book Cleaning & Pest Service',
          labelHi: 'सफाई सेवा बुक करें',
          type: 'navigate',
          payload: '/search?category=cleaning',
          icon: 'Sparkles',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `✨ **Recommended Service: Cleaning & Pest Control**\n\n- **Available Packages in Muzaffarnagar**:\n  - Bathroom Deep Clean: ₹399 per bathroom\n  - Kitchen Chimney & Tile Degreasing: ₹599\n  - 2BHK / 3BHK Full Home Deep Clean: ₹1299 - ₹2499\n  - Pest Control (Cockroach & Termite gel): ₹699\n- Artisans carry their own specialized chemical agents and equipment.`,
        textHi: `✨ **सुझाई गई सेवा: डीप क्लीनिंग व पेस्ट कंट्रोल**\n\n- **मुज़फ़्फ़रनगर में प्रमुख पैकेज**:\n  - बाथरूम डीप क्लीनिंग: ₹399 प्रति बाथरूम\n  - किचन चिमनी व टाइल्स क्लीनिंग: ₹599\n  - 2BHK / 3BHK पूरे घर की डीप सफाई: ₹1299 - ₹2499\n  - कीट नियंत्रण (कॉकरोच/दीमक जेल स्प्रे): ₹699\n- कारीगर अपनी विशेष मशीनें और सुरक्षित केमिकल्स साथ लाते हैं।`,
        actions,
      }
    }

    // 5. Salon & Grooming (Men / Women)
    if (query.includes('salon') || query.includes('hair') || query.includes('spa') || query.includes('facial') || query.includes('groom') || query.includes('बाल') || query.includes('दाढ़ी') || query.includes('सैलून') || query.includes('स्पा')) {
      const actions: ChatAction[] = [
        {
          id: 'act_men_salon',
          labelEn: "Men's Salon at Home",
          labelHi: 'पुरुष सैलून',
          type: 'navigate',
          payload: '/search?category=men_salon',
          icon: 'Scissors',
        },
        {
          id: 'act_women_spa',
          labelEn: "Women's Salon & Spa",
          labelHi: 'महिला सैलून व स्पा',
          type: 'navigate',
          payload: '/search?category=women_spa',
          icon: 'Heart',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `✂️ **Urban Company Style Salon & Spa at Home**\n\n- **Men's Grooming**: Haircut + beard styling + head massage (starts at ₹249). Hygienic disposable sheets used.\n- **Women's Salon & Spa**: Facial, cleanup, waxing, manicure/pedicure by background-verified female professionals in privacy of your home.\n- **Convenience**: No waiting in crowded market salons in Shiv Chowk or New Mandi!`,
        textHi: `✂️ **घर पर सैलून व स्पा सेवा**\n\n- **पुरुष ग्रूमिंग**: बाल कटिंग + दाढ़ी सेट + हेड मसाज (मात्र ₹249 से शुरू)। डिस्पोजेबल किट का उपयोग।\n- **महिला सैलून व स्पा**: फेशियल, वैक्सिंग, मैनीक्योर/पेडीक्योर सत्यापित महिला ब्यूटीशियन द्वारा आपके घर की निजता में।\n- **सुविधा**: बाज़ार के सैलूनों में इंतज़ार करने की कोई ज़रूरत नहीं!`,
        actions,
      }
    }

    // 6. Locality / Pincode coverage
    if (query.includes('mandi') || query.includes('civil') || query.includes('pincode') || query.includes('area') || query.includes('251001') || query.includes('251002') || query.includes('कवरेज') || query.includes('इलाका')) {
      const actions: ChatAction[] = [
        {
          id: 'act_browse_all',
          labelEn: 'Search All Verified Artisans',
          labelHi: 'सभी कारीगर देखें',
          type: 'navigate',
          payload: '/search',
          icon: 'MapPin',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `📍 **Muzaffarnagar Locality Coverage**:\n\n- **PIN 251001**: New Mandi, Shiv Chowk, Gandhi Colony, Roorkee Road, Bharthal, Patel Nagar.\n- **PIN 251002**: Civil Lines, Cantt, Jansath Road, Circular Road, South Civil Lines, Rampuram.\n\nOver 100+ Aadhaar-verified local electricians, plumbers, AC mechanics, carpenters, and painters are active across both zones with average 30-45 minute arrival times.`,
        textHi: `📍 **मुज़फ़्फ़रनगर कार्यक्षेत्र कवरेज**:\n\n- **पिन 251001**: नई मंडी, शिव चौक, गांधी कॉलोनी, रुड़की रोड, भरथल, पटेल नगर।\n- **पिन 251002**: सिविल लाइन्स, कैंट, जानसठ रोड, सर्कुलर रोड, साउथ सिविल लाइन्स, रामपुरम।\n\nदोनों क्षेत्रों में 100+ आधार-सत्यापित इलेक्ट्रीशियन, प्लंबर, कारपेंटर और पेंटर औसतन 30-45 मिनट में उपलब्ध रहते हैं।`,
        actions,
      }
    }

    // Default Booking Mitra response
    const defaultActions: ChatAction[] = [
      {
        id: 'act_search_all',
        labelEn: 'Browse All Categories',
        labelHi: 'सभी सेवाएं देखें',
        type: 'navigate',
        payload: '/search',
        icon: 'Search',
      },
      {
        id: 'act_whatsapp_admin',
        labelEn: 'Ask Admin on WhatsApp',
        labelHi: 'व्हाट्सऐप पर पूछें',
        type: 'external_link',
        payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Namaste%20Kaamgar%20Team%2C%20I%20need%20help%20finding%20an%20artisan%20for%3A%20${encodeURIComponent(query)}`,
        icon: 'MessageCircle',
      },
    ]

    return {
      id: msgId,
      sender: 'assistant',
      persona,
      timestamp: new Date(),
      textEn: `I can help you find verified local artisans across all 8 trades in Muzaffarnagar (Electrician, Plumber, AC Repair, Cleaning, Men's/Women's Salon, Carpenter, Painter).\n\nStandard visiting charges are **₹149 - ₹249** with 0% middleman markup. Tell me what issue you are facing or click below to search.`,
      textHi: `मैं मुज़फ़्फ़रनगर के सभी 8 ट्रेडों (इलेक्ट्रीशियन, प्लंबर, AC मरम्मत, सफाई, सैलून, कारपेंटर, पेंटर) में सत्यापित कारीगर खोजने में आपकी मदद कर सकता हूँ।\n\nविजिटिंग शुल्क मात्र **₹149 - ₹249** है। आप नीचे दी गई श्रेणियों में से चुन सकते हैं।`,
      actions: defaultActions,
    }
  }

  // ==========================================
  // PERSONA 2: CUSTOMER CARE & ORDER SUPPORT
  // ==========================================
  if (persona === 'customer_care') {
    // 1. Delay / Artisan Not Answering
    if (query.includes('delay') || query.includes('late') || query.includes('not answer') || query.includes('reach') || query.includes('फोन नहीं') || query.includes('लेट') || query.includes('आया नहीं')) {
      const actions: ChatAction[] = [
        {
          id: 'act_my_bookings',
          labelEn: 'View Active Bookings',
          labelHi: 'सक्रिय बुकिंग देखें',
          type: 'navigate',
          payload: '/bookings',
          icon: 'Calendar',
        },
        {
          id: 'act_escalate_admin',
          labelEn: 'WhatsApp Admin Helpline',
          labelHi: 'एडमिन को रिपोर्ट करें',
          type: 'external_link',
          payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Urgent%3A%20My%20booked%20artisan%20is%20delayed%20and%20not%20answering.%20Please%20assist.`,
          icon: 'MessageCircle',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `⏱️ **Handling Artisan Delays**:\n\n1. Check your **My Bookings** page and use the **WhatsApp / Call** button to ping the artisan directly.\n2. Local traffic (e.g. Shiv Chowk or Roorkee Road railway crossing) can occasionally cause a 10-15 minute delay.\n3. If the artisan does not answer within 10 minutes, click the button below to alert our **Kaamgar Admin Desk**—we will immediately dispatch an alternate verified artisan to your location!`,
        textHi: `⏱️ **कारीगर के लेट होने पर क्या करें**:\n\n1. **My Bookings** पेज पर जाकर कारीगर के नंबर पर सीधे व्हाट्सऐप या कॉल करें।\n2. कई बार शहर में जाम (जैसे शिव चौक या रेलवे फाटक) के कारण 10-15 मिनट की देरी हो जाती है।\n3. अगर कारीगर 10 मिनट तक फोन न उठाए, तो नीचे दिए बटन से हमारे **एडमिन डेस्क** को बताएं—हम तुरंत दूसरा कारीगर भेजेंगे!`,
        actions,
      }
    }

    // 2. Pricing disputes / Overcharging
    if (query.includes('pric') || query.includes('charg') || query.includes('extra') || query.includes('money') || query.includes('पैस') || query.includes('ज़्यादा') || query.includes('रुपय') || query.includes('बिल')) {
      const actions: ChatAction[] = [
        {
          id: 'act_dispute_admin',
          labelEn: 'Report Overcharging to Admin',
          labelHi: 'एडमिन को शिकायत भेजें',
          type: 'external_link',
          payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Complaint%3A%20Artisan%20is%20demanding%20extra%20charges%20above%20standard%20quote.`,
          icon: 'Shield',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `💰 **Fair Price Protection Policy**:\n\n- **Standard Visiting/Inspection Charge**: ₹149 - ₹249 for Electrician, Plumber, Carpenter.\n- **Parts & Materials**: Artisans should present original market receipts from Muzaffarnagar electrical/hardware shops.\n- **Labour Charge**: Must be agreed before starting the repair.\n- If an artisan demands unreasonable rates without prior approval, do **not pay** extra and report them to Admin immediately.`,
        textHi: `💰 **उचित दर सुरक्षा नीति**:\n\n- **मानक विजिटिंग शुल्क**: इलेक्ट्रीशियन, प्लंबर या कारपेंटर का ₹149 - ₹249 होता है।\n- **सामान का बिल**: कारीगर को दुकान का पक्का बिल देना अनिवार्य है।\n- **मजदूरी**: काम शुरू करने से पहले तय होनी चाहिए।\n- अगर कोई कारीगर तय से ज्यादा मांगता है, तो तुरंत नीचे दिए बटन से एडमिन को बताएं।`,
        actions,
      }
    }

    // 3. Reschedule or Cancel
    if (query.includes('cancel') || query.includes('resched') || query.includes('time') || query.includes('रद्द') || query.includes('बदल')) {
      const actions: ChatAction[] = [
        {
          id: 'act_bookings_resched',
          labelEn: 'Manage Bookings',
          labelHi: 'बुकिंग प्रबंधित करें',
          type: 'navigate',
          payload: '/bookings',
          icon: 'Calendar',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `📅 **Cancelling or Rescheduling**:\n\n- Go to **My Bookings** in the navigation bar.\n- For pending bookings, you can cancel directly without any penalty or cancellation fees.\n- If the booking was accepted, please message or call the artisan courteously via the booking card to inform them before cancelling.`,
        textHi: `📅 **बुकिंग बदलना या रद्द करना**:\n\n- मेन्यू में **My Bookings** पर जाएं।\n- पेंडिंग बुकिंग को आप बिना किसी शुल्क के कभी भी रद्द कर सकते हैं।\n- यदि बुकिंग स्वीकार हो चुकी है, तो कारीगर को कॉल या व्हाट्सऐप पर सूचित कर दें ताकि उनका समय खराब न हो।`,
        actions,
      }
    }

    // 4. Admin Direct Call
    if (query.includes('admin') || query.includes('call') || query.includes('talk') || query.includes('help') || query.includes('संपर्क') || query.includes('बात')) {
      const actions: ChatAction[] = [
        {
          id: 'act_call_admin',
          labelEn: 'Call Helpline: +91 8077362606',
          labelHi: 'कॉल करें: +91 8077362606',
          type: 'external_link',
          payload: `tel:${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}`,
          icon: 'PhoneCall',
        },
        {
          id: 'act_wa_admin',
          labelEn: 'WhatsApp Admin Desk',
          labelHi: 'व्हाट्सऐप पर बात करें',
          type: 'external_link',
          payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Hello%20Kaamgar%20Admin%2C%20I%20need%20immediate%20customer%20support.`,
          icon: 'MessageCircle',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `📞 **Muzaffarnagar Kaamgar Customer Desk**\n\nOur administrative support team is available from 8:00 AM to 9:00 PM every day.\n\n- **Helpline Phone**: ${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}\n- **Direct WhatsApp**: Fast resolution within 10 minutes.\n\nClick below to connect immediately:`,
        textHi: `📞 **मुज़फ़्फ़रनगर कामगार ग्राहक सहायता**\n\nहमारी एडमिन टीम प्रतिदिन सुबह 8:00 बजे से रात 9:00 बजे तक उपलब्ध है।\n\n- **हेल्पलाइन नंबर**: ${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}\n- **व्हाट्सऐप सहायता**: 10 मिनट में समाधान।\n\nतुरंत संपर्क के लिए नीचे क्लिक करें:`,
        actions,
      }
    }

    // Default Customer Care response
    const defaultActions: ChatAction[] = [
      {
        id: 'act_view_my_bookings',
        labelEn: 'Go to My Bookings',
        labelHi: 'मेरी बुकिंग देखें',
        type: 'navigate',
        payload: '/bookings',
        icon: 'Calendar',
      },
      {
        id: 'act_contact_admin',
        labelEn: 'WhatsApp Admin Desk',
        labelHi: 'एडमिन डेस्क',
        type: 'external_link',
        payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Customer%20Support%20Request%3A%20${encodeURIComponent(query)}`,
        icon: 'MessageCircle',
      },
    ]

    return {
      id: msgId,
      sender: 'assistant',
      persona,
      timestamp: new Date(),
      textEn: `I am here to resolve any booking delay, pricing issue, or work quality concern. If you have an urgent question, our Muzaffarnagar Admin Desk is available at **${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}**.`,
      textHi: `मैं किसी भी बुकिंग देरी, शुल्क विवाद या कारीगर समस्या को हल करने के लिए यहाँ हूँ। आपात स्थिति में आप हमारे एडमिन डेस्क **${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}** पर भी संपर्क कर सकते हैं।`,
      actions: defaultActions,
    }
  }

  // ==========================================
  // PERSONA 3: WORKER SARATHI & DUTY COACH
  // ==========================================
  if (persona === 'worker_sarathi') {
    // 1. WhatsApp Template generator: On my way
    if (query.includes('way') || query.includes('message') || query.includes('whatsapp') || query.includes('रास्ते') || query.includes('पहुँच') || query.includes('मैसेज')) {
      const templateText = `नमस्ते! मैं मुज़फ़्फ़रनगर कामगार से आपका इलेक्ट्रीशियन/कारीगर हूँ। मैं आपकी बताई लोकेशन के लिए निकल चुका हूँ और लगभग 20 मिनट में पहुँच रहा हूँ। अगर कोई विशेष दिशा-निर्देश हों तो कृपया बताएँ।`
      const actions: ChatAction[] = [
        {
          id: 'act_copy_arrival_msg',
          labelEn: 'Copy Arrival Message (Hindi)',
          labelHi: 'मैसेज कॉपी करें',
          type: 'copy_text',
          payload: templateText,
          icon: 'Copy',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `💬 **Ready-to-Use Customer WhatsApp Message**:\n\n> *"${templateText}"*\n\nClick the button below to copy this message, then paste it directly into the customer's WhatsApp chat from your Worker Dashboard!`,
        textHi: `💬 **ग्राहक को भेजने के लिए तैयार संदेश**:\n\n> *"${templateText}"*\n\nनीचे दिए बटन पर क्लिक करके इस संदेश को कॉपी करें और अपने डैशबोर्ड से ग्राहक के व्हाट्सऐप पर भेज दें!`,
        actions,
      }
    }

    // 2. How to get more jobs / tips
    if (query.includes('more job') || query.includes('earn') || query.includes('call') || query.includes('काम') || query.includes('बुकिंग') || query.includes('ज्यादा')) {
      const actions: ChatAction[] = [
        {
          id: 'act_worker_dashboard',
          labelEn: 'Open Worker Dashboard',
          labelHi: 'डैशबोर्ड खोलें',
          type: 'navigate',
          payload: '/worker/dashboard',
          icon: 'Briefcase',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `🔔 **4 Golden Rules to Get Maximum Jobs in Muzaffarnagar**:\n\n1. **Keep Duty Status 'ONLINE'**: Customers only see and call active artisans on the homepage.\n2. **Respond in Under 5 Minutes**: Fast acceptance doubles your ranking in New Mandi and Civil Lines.\n3. **Maintain 5-Star Ratings**: Polite communication and clean workmanship prompt customers to leave top reviews.\n4. **Get the Gold Verified Badge**: Verified profiles receive 3x more direct booking calls!`,
        textHi: `🔔 **मुज़फ़्फ़रनगर में सबसे ज्यादा काम पाने के 4 नियम**:\n\n1. **ड्यूटी स्टेटस 'ONLINE' रखें**: ग्राहक केवल उन्हीं कारीगरों को कॉल करते हैं जो ऑनलाइन दिखाई देते हैं।\n2. **5 मिनट के अंदर स्वीकार करें**: तेजी से जवाब देने से आपकी प्रोफाइल सर्च में ऊपर आती है।\n3. **5-स्टार रेटिंग बनाए रखें**: विनम्र व्यवहार और साफ-सुथरे काम से ग्राहक अच्छी रेटिंग देते हैं।\n4. **गोल्ड वेरिफाइड बैज लगवाएं**: वेरिफाइड कारीगरों को 3 गुना ज्यादा काम मिलता है!`,
        actions,
      }
    }

    // 3. 0% Commission & Payment rules
    if (query.includes('commission') || query.includes('payment') || query.includes('cut') || query.includes('कमीशन') || query.includes('रुपए') || query.includes('पेमेंट')) {
      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `💵 **0% Platform Commission Guarantee**:\n\n- **100% Earnings are Yours**: For the first 3 months, Muzaffarnagar Kaamgar charges **₹0 commission** from artisans.\n- **Direct Customer Payment**: Collect your visiting fees and labour charges directly from the customer via **Cash** or your personal **UPI (PhonePe / Google Pay / Paytm QR)**.\n- Kaamgar never holds or deducts your hard-earned money!`,
        textHi: `💵 **0% कमीशन और भुगतान गारंटी**:\n\n- **पूरी कमाई आपकी**: पहले 3 महीनों के लिए मुज़फ़्फ़रनगर कामगार आपसे **0% कमीशन** लेता है।\n- **सीधा भुगतान**: अपना विजिटिंग चार्ज और मजदूरी ग्राहक से सीधे **कैश या अपने UPI (PhonePe/GPay/Paytm)** पर लें।\n- कंपनी आपकी मेहनत की कमाई में से एक भी रुपया नहीं काटती!`,
      }
    }

    // 4. Gold Verified Badge
    if (query.includes('badge') || query.includes('verify') || query.includes('aadhaar') || query.includes('बैज') || query.includes('वेरिफ')) {
      const actions: ChatAction[] = [
        {
          id: 'act_submit_kyc',
          labelEn: 'Submit ID to Admin on WhatsApp',
          labelHi: 'व्हाट्सऐप पर ID भेजें',
          type: 'external_link',
          payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Namaste%20Admin%2C%20I%20am%20a%20registered%20Kaamgar%20artisan%20and%20want%20to%20verify%20my%20Aadhaar%2FVoter%20ID%20for%20the%20Gold%20Badge.`,
          icon: 'Shield',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `⭐ **How to Get the Verified Gold Badge**:\n\n1. Send a photo of your **Aadhaar Card** or **Voter ID** and a clear selfie to our Admin WhatsApp.\n2. Verification is completed within **24 hours**.\n3. A shiny **Gold Shield Badge (सत्यापित कारीगर)** will appear on your profile card, boosting customer trust!`,
        textHi: `⭐ **वेरिफाइड गोल्ड बैज कैसे प्राप्त करें**:\n\n1. अपने **आधार कार्ड** या **वोटर आईडी** की फोटो और एक साफ सेल्फी हमारे एडमिन व्हाट्सऐप पर भेजें।\n2. 24 घंटे के अंदर आपकी आईडी की जांच पूरी कर दी जाएगी।\n3. आपकी प्रोफाइल पर **गोल्ड शील्ड बैज (सत्यापित कारीगर)** लग जाएगा, जिससे ग्राहकों का भरोसा बढ़ता है!`,
        actions,
      }
    }

    // 5. Customer Dispute at door / refused visiting fee
    if (query.includes('dispute') || query.includes('refus') || query.includes('door') || query.includes('लड़ाई') || query.includes('मना') || query.includes('विवाद')) {
      const actions: ChatAction[] = [
        {
          id: 'act_call_worker_support',
          labelEn: 'Call Artisan Helpline Now',
          labelHi: 'हेल्पलाइन पर बात करें',
          type: 'external_link',
          payload: `tel:${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}`,
          icon: 'PhoneCall',
        },
        {
          id: 'act_wa_worker_dispute',
          labelEn: 'WhatsApp Admin Desk',
          labelHi: 'व्हाट्सऐप पर बताएं',
          type: 'external_link',
          payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Urgent%20Artisan%20Dispute%3A%20Customer%20at%20location%20is%20refusing%20standard%20visiting%20inspection%20fee.`,
          icon: 'MessageCircle',
        },
      ]

      return {
        id: msgId,
        sender: 'assistant',
        persona,
        timestamp: new Date(),
        textEn: `⚠️ **If Customer Refuses Visiting Charge**:\n\n1. Remain calm and polite. Explain: *"Sir, as per Kaamgar guidelines, the visiting fee covers transport and technical diagnosis."*\n2. Do not argue. Show them the booking card in the app.\n3. If they still refuse, immediately tap the button below to report to our Admin Desk. We will speak with the customer directly and protect your rights.`,
        textHi: `⚠️ **यदि ग्राहक विजिटिंग चार्ज देने से मना करे**:\n\n1. शांत व शालीन रहें। विनम्रता से कहें: *"सर, कामगार के नियमानुसार विजिटिंग चार्ज आने-जाने और खराबी की जांच का तय शुल्क है।"*\n2. बहस न करें, ऐप में बुकिंग का विवरण दिखाएं।\n3. फिर भी न मानें तो तुरंत नीचे दिए बटन से एडमिन को सूचित करें। एडमिन टीम स्वयं ग्राहक से बात कर समाधान निकालेगी।`,
        actions,
      }
    }

    // Default Worker Sarathi response
    const defaultActions: ChatAction[] = [
      {
        id: 'act_wa_helpline',
        labelEn: 'Artisan Support WhatsApp',
        labelHi: 'कारीगर सहायता व्हाट्सऐप',
        type: 'external_link',
        payload: `https://api.whatsapp.com/send?phone=${MUZAFFARNAGAR_KNOWLEDGE.adminPhoneRaw}&text=Kaamgar%20Artisan%20Query%3A%20${encodeURIComponent(query)}`,
        icon: 'MessageCircle',
      },
      {
        id: 'act_worker_home',
        labelEn: 'Go to Worker Workspace',
        labelHi: 'डैशबोर्ड पर जाएँ',
        type: 'navigate',
        payload: '/worker/dashboard',
        icon: 'Briefcase',
      },
    ]

    return {
      id: msgId,
      sender: 'assistant',
      persona,
      timestamp: new Date(),
      textEn: `Kaamgar Sarathi is always with you. Keep your duty **ONLINE**, serve customers politely, and collect 100% of your earnings with **0% commission**. For any immediate help, connect with our Artisan Desk at **${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}**.`,
      textHi: `कामगार सारथी सदैव आपके साथ है। अपनी ड्यूटी **ONLINE** रखें, ग्राहकों से विनम्र रहें और **0% कमीशन** के साथ पूरी कमाई अपने पास रखें। सहायता के लिए **${MUZAFFARNAGAR_KNOWLEDGE.adminPhone}** पर संपर्क करें।`,
      actions: defaultActions,
    }
  }

  // Fallback safety
  return {
    id: msgId,
    sender: 'assistant',
    persona,
    timestamp: new Date(),
    textEn: 'How can I assist you with services or bookings in Muzaffarnagar?',
    textHi: 'मुज़फ़्फ़रनगर में सेवाओं या बुकिंग के संबंध में मैं आपकी क्या सहायता कर सकता हूँ?',
  }
}

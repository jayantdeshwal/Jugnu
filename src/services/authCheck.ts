import { getSupabaseClient } from '@/lib/supabase'

export interface PhoneCheckResult {
  isRegistered: boolean
  role?: 'customer' | 'worker' | 'admin'
  fullName?: string
  isWorker?: boolean
  error?: string
}

const LOCAL_REGISTERED_PHONES_KEY = 'kaamgar_registered_phones_cache'

function getLocalCache(): Record<string, { role?: string; name?: string }> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_REGISTERED_PHONES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function recordPhoneRegistered(cleanPhone: string, role: 'customer' | 'worker' | 'admin' = 'customer', name?: string) {
  if (typeof window === 'undefined') return
  try {
    const cache = getLocalCache()
    cache[cleanPhone] = { role, name }
    localStorage.setItem(LOCAL_REGISTERED_PHONES_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('Could not update phone cache:', e)
  }
}

/**
 * Checks whether a given phone number is registered as a customer or worker.
 * Uses the security-definer RPC `check_phone_registration` with multi-layered fallbacks.
 */
export async function checkPhoneRegistration(rawPhone: string): Promise<PhoneCheckResult> {
  const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length !== 10) {
    return {
      isRegistered: false,
      error: 'Please enter a valid 10-digit mobile number'
    }
  }

  const supabase = getSupabaseClient()

  // 1. Check local cache (instant verification for newly registered users on this device)
  const localCache = getLocalCache()
  if (localCache[cleanPhone]) {
    const cached = localCache[cleanPhone]
    return {
      isRegistered: true,
      role: (cached.role as any) || 'customer',
      isWorker: cached.role === 'worker',
      fullName: cached.name
    }
  }

  // 2. Primary check: Call Supabase RPC function check_phone_registration
  try {
    const { data, error } = await (supabase as any).rpc('check_phone_registration', {
      lookup_phone: cleanPhone
    })

    if (!error && data) {
      if (data.registered === true) {
        recordPhoneRegistered(cleanPhone, data.role, data.full_name)
        return {
          isRegistered: true,
          role: data.role || 'customer',
          isWorker: Boolean(data.is_worker),
          fullName: data.full_name
        }
      } else if (data.registered === false) {
        return {
          isRegistered: false
        }
      }
    }
  } catch (rpcErr) {
    console.warn('check_phone_registration RPC query warning:', rpcErr)
  }

  // 3. Fallback check: Probe using Supabase Auth signIn with default phone credentials
  const phoneEmail = `${cleanPhone}@phone.kaamgar.local`
  const defaultPassword = `kaamgar_phone_${cleanPhone}_secure`

  try {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: phoneEmail,
      password: defaultPassword
    })

    if (signInData?.user) {
      // User definitively exists!
      recordPhoneRegistered(cleanPhone, 'customer', signInData.user.user_metadata?.full_name)
      return {
        isRegistered: true,
        role: (signInData.user.user_metadata?.role as any) || 'customer',
        fullName: signInData.user.user_metadata?.full_name
      }
    }

    // If signIn returned invalid credentials, check if the account exists with another password
    // Supabase signUp returns 422 with error_code 'user_already_exists' if the user is registered!
    const { error: signUpErr } = await supabase.auth.signUp({
      email: phoneEmail,
      password: 'Probe_Check_Kaamgar_Existing_999!'
    })

    if (signUpErr && (signUpErr.message?.toLowerCase().includes('already registered') || (signUpErr as any).code === 'user_already_exists')) {
      recordPhoneRegistered(cleanPhone, 'customer')
      return {
        isRegistered: true,
        role: 'customer'
      }
    }
  } catch (authErr) {
    console.warn('Auth fallback check warning:', authErr)
  }

  return {
    isRegistered: false
  }
}

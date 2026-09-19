import { getSupabaseClient } from '@/lib/supabase'

export interface PhoneCheckResult {
  isRegistered: boolean
  error?: string
}

/**
 * Checks whether a given phone number is registered in Jugnu.
 * Uses the security-definer RPC `check_phone_registration` which returns boolean status only (zero PII exposure).
 */
export async function checkPhoneRegistration(rawPhone: string): Promise<PhoneCheckResult> {
  const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length !== 10) {
    return {
      isRegistered: false,
      error: 'Please enter a valid 10-digit mobile number',
    }
  }

  const supabase = getSupabaseClient()

  try {
    const { data, error } = await (supabase as any).rpc('check_phone_registration', {
      lookup_phone: cleanPhone,
    })

    if (!error && data) {
      return {
        isRegistered: Boolean(data.registered),
      }
    }
  } catch (rpcErr) {
    console.warn('check_phone_registration RPC notice:', rpcErr)
  }

  return {
    isRegistered: false,
  }
}

// Clean up any legacy localStorage cache on device if present
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('kaamgar_registered_phones_cache')
  } catch {
    // Ignore in non-browser environments
  }
}

/**
 * @deprecated Legacy no-op cache writer. Kept for backwards-compatibility.
 */
export function recordPhoneRegistered(_cleanPhone: string, _role?: string, _name?: string, _email?: string): void {
  // No-op: passwordless architecture relies on Supabase DB as source of truth
}

/**
 * @deprecated Legacy no-op cache remover. Kept for backwards-compatibility.
 */
export function removePhoneFromRegisteredCache(_rawPhone?: string | null): void {
  // No-op: passwordless architecture relies on Supabase DB as source of truth
}

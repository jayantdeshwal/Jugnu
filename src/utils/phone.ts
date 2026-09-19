/**
 * Canonical Indian phone number normalization utility.
 *
 * Single source of truth for all authentication phone normalization in Jugnu.
 * NEVER import separate phone normalization logic elsewhere — always use this module.
 *
 * Canonical internal representation: exactly 10 digits, no prefix, no leading 0.
 * Example: "9876543210"
 *
 * Handled input forms:
 *   9876543210       → 9876543210
 *   09876543210      → 9876543210  (domestic 0 prefix)
 *   +919876543210    → 9876543210  (E.164 with country code)
 *   +91 98765 43210  → 9876543210  (formatted E.164)
 *   919876543210     → 9876543210  (country code without +)
 *   91 9876543210    → 9876543210  (country code with space)
 *
 * SECURITY RULES:
 *   - NEVER uses .slice(0, 10) to truncate — invalid if it would silently corrupt
 *   - Rejects ambiguous digit strings that cannot be safely resolved
 *   - Only accepts Indian mobile numbers starting with 6-9
 */

/** Regex for a valid Indian mobile number (10 digits, starting 6-9). */
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/

/**
 * Normalizes an Indian phone number to a canonical 10-digit string.
 *
 * @param raw - Any user-supplied phone string (may include country code, spaces, dashes, +, etc.)
 * @returns `{ ok: true, digits: "XXXXXXXXXX" }` on success,
 *          `{ ok: false, error: string }` if the number cannot be safely normalized.
 *
 * IMPORTANT: Never call `.slice(0, 10)` on the raw input. Strip non-digits first,
 * then remove the country code by structural rules, then validate.
 */
export function normalizeIndianPhone(raw: string): { ok: true; digits: string } | { ok: false; error: string } {
  // Step 1: Remove all non-digit characters (spaces, +, -, parentheses, etc.)
  const allDigits = raw.replace(/\D/g, '')

  if (allDigits.length === 0) {
    return { ok: false, error: 'Please enter a mobile number' }
  }

  let tenDigits: string

  if (allDigits.length === 10) {
    // Already 10 digits — use as-is (could be 9876543210 or 0987654321 — but 0 start handled below)
    tenDigits = allDigits
  } else if (allDigits.length === 11 && allDigits.startsWith('0')) {
    // Domestic 0 prefix: 09876543210 → 9876543210
    tenDigits = allDigits.slice(1)
  } else if (allDigits.length === 12 && allDigits.startsWith('91')) {
    // Country code without +: 919876543210 → 9876543210
    tenDigits = allDigits.slice(2)
  } else if (allDigits.length === 13 && allDigits.startsWith('091')) {
    // Rare: 0 + country code + number
    tenDigits = allDigits.slice(3)
  } else {
    // Any other length is unambiguously invalid — do NOT truncate
    return {
      ok: false,
      error: `Invalid mobile number (got ${allDigits.length} digits after stripping formatting). Please enter a valid 10-digit Indian mobile number.`,
    }
  }

  // Step 2: Validate the 10-digit result
  if (!INDIAN_MOBILE_REGEX.test(tenDigits)) {
    return {
      ok: false,
      error: 'Please enter a valid Indian mobile number (must start with 6, 7, 8, or 9)',
    }
  }

  return { ok: true, digits: tenDigits }
}

/**
 * Convenience wrapper — returns the canonical 10-digit string or null if invalid.
 * Use this only for display/non-critical paths. For auth flows, use normalizeIndianPhone()
 * and handle the error explicitly.
 */
export function tryNormalizeIndianPhone(raw: string): string | null {
  const result = normalizeIndianPhone(raw)
  return result.ok ? result.digits : null
}

/**
 * Sanitizes a raw phone input string for use as controlled input field value.
 * Strips all non-digit characters, enforces max 12 raw digits (to allow typing
 * "+91" prefix before the 10-digit number).
 *
 * This is safe for onChange handlers — it does NOT normalize or validate,
 * it only prevents garbage characters from being stored in state.
 * Normalization is done at submit time via normalizeIndianPhone().
 */
export function sanitizePhoneInput(raw: string): string {
  // Strip everything except digits — keep up to 12 digits to allow +91XXXXXXXXXX entry
  return raw.replace(/\D/g, '').slice(0, 12)
}

/**
 * Centralized Safe Error Sanitization Utility
 * Prevents leakage of SQLSTATE codes, table names, schema names, function names,
 * constraints, stack traces, and internal database/provider details to user-facing UI.
 */

// Patterns indicating raw database internals or SQL technical details
const SENSITIVE_PATTERNS = [
  /\b[0-9A-Z]{5}\b(?=.*(?:error|violation|exception|syntax|relation))/i, // SQLSTATE codes
  /P0001/i,
  /42501/i,
  /23505/i,
  /2BP01/i,
  /42P01/i,
  /\b(?:public|auth|storage|pg_catalog)\.[a-z0-9_]+/i, // Schema-qualified objects
  /\b(?:profiles|worker_profiles|worker_categories|worker_service_areas|bookings|reviews|notifications|complaints|admin_actions)\b/i,
  /\b(?:guard_[a-z0-9_]+|trg_[a-z0-9_]+|check_phone_registration|is_admin|is_super_admin)\b/i,
  /syntax error/i,
  /violates (?:check|foreign key|unique|not-null) constraint/i,
  /duplicate key value/i,
  /relation "[^"]+" does not exist/i,
  /column "[^"]+" does not exist/i,
  /permission denied/i,
  /at plpgsql function/i,
  /context: plpgsql/i,
  /stack trace/i,
  /postgrest/i,
  /\b(?:bearer|token|apikey|secret|jwt)\b/i,
]

// Recognized clean user-facing domain messages that are safe to present directly
const KNOWN_SAFE_SUBSTRINGS = [
  'invalid login credentials',
  'passwords do not match',
  'please enter a valid',
  'already registered',
  'no account found',
  'booking was not found',
  'only the super administrator can',
  'this worker is not available',
  'cannot book their own services',
  'booking customer cannot be changed',
  'assigned worker cannot be changed',
  'completed, cancelled, or rejected bookings cannot be modified',
  'you do not have permission',
]

/**
 * Sanitizes an error of any type (string, Error, or PostgREST error object)
 * into a safe, user-friendly message without internal system leaks.
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again or contact support.'
): string {
  if (!error) return fallbackMessage

  let rawMessage = ''

  if (typeof error === 'string') {
    rawMessage = error
  } else if (error instanceof Error) {
    rawMessage = error.message
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    rawMessage = String(obj.message || obj.error_description || obj.error || '')
  }

  rawMessage = rawMessage.trim()
  if (!rawMessage) return fallbackMessage

  const lower = rawMessage.toLowerCase()

  // 1. If it matches a known user-friendly business message, clean and return it
  for (const safeStr of KNOWN_SAFE_SUBSTRINGS) {
    if (lower.includes(safeStr)) {
      // If it has "Action prohibited: <message>", extract only the user message
      const prohibitedMatch = rawMessage.match(/Action prohibited:\s*([^.\n]+)/i)
      if (prohibitedMatch && prohibitedMatch[1]) {
        return prohibitedMatch[1].trim()
      }
      const unauthorizedMatch = rawMessage.match(/Unauthorized:\s*([^.\n]+)/i)
      if (unauthorizedMatch && unauthorizedMatch[1]) {
        return unauthorizedMatch[1].trim()
      }
      // If free of schema names, return as is
      if (!lower.includes('public.') && !lower.includes('auth.') && !lower.includes('plpgsql')) {
        return rawMessage.replace(/\(P0001\)/gi, '').trim()
      }
    }
  }

  // 2. Check if the message contains sensitive internal database / SQLSTATE patterns
  const containsSensitiveInfo = SENSITIVE_PATTERNS.some((pattern) => pattern.test(rawMessage))
  if (containsSensitiveInfo) {
    // If it's a domain exception raised via RAISE EXCEPTION 'Action prohibited: ...'
    const cleanException = rawMessage.match(/(?:Action prohibited|Unauthorized):\s*([^.\n]+)/i)
    if (cleanException && cleanException[1]) {
      const candidate = cleanException[1].trim()
      // Verify candidate itself does not leak schema or table names
      if (!SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate))) {
        return candidate
      }
    }

    return fallbackMessage
  }

  // 3. Fallback: If reasonably short and without code-like symbols, return safely
  if (rawMessage.length <= 150 && !rawMessage.includes('{') && !rawMessage.includes('}')) {
    return rawMessage
  }

  return fallbackMessage
}

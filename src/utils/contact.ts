/**
 * Contact utilities for phone numbers and WhatsApp deep links in Muzaffarnagar
 */

/**
 * Standardizes an Indian phone number into a 12-digit string starting with 91 (e.g. 919876543210).
 */
export function cleanIndianPhone(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `91${digits}`
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits
  }
  return digits
}

/**
 * Formats a phone number for human-friendly display (e.g. "+91 98765 43210").
 */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return ''
  const cleaned = cleanIndianPhone(phone)
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const raw10 = cleaned.slice(2)
    return `+91 ${raw10.slice(0, 5)} ${raw10.slice(5)}`
  }
  return phone
}

/**
 * Generates a WhatsApp deep link with optional pre-filled text.
 */
export function getWhatsAppUrl(phone?: string | null, message?: string): string {
  const cleaned = cleanIndianPhone(phone)
  if (!cleaned) return ''
  const baseUrl = `https://wa.me/${cleaned}`
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl
}

/**
 * Generates a standard telephone dialer URI.
 */
export function getTelUrl(phone?: string | null): string {
  const cleaned = cleanIndianPhone(phone)
  if (!cleaned) return ''
  return `tel:+${cleaned}`
}

/**
 * Constructs a friendly WhatsApp message from Customer to Worker.
 */
export function buildCustomerToWorkerWhatsAppMessage(params: {
  workerName?: string
  categoryName?: string
  date?: string
  time?: string
  address?: string
}): string {
  const name = params.workerName ? `${params.workerName} ji` : 'ji'
  const service = params.categoryName || 'home service'
  const when = params.date && params.time ? `on ${params.date} at ${params.time}` : ''
  const location = params.address ? `\nAddress: ${params.address}` : ''

  return `Namaste ${name}, I have booked your ${service} on Jugnu ${when}.${location}\nPlease let me know your estimated arrival time. Thank you!`
}

/**
 * Constructs a friendly WhatsApp message from Worker to Customer.
 */
export function buildWorkerToCustomerWhatsAppMessage(params: {
  customerName?: string
  workerName?: string
  categoryName?: string
  date?: string
  time?: string
}): string {
  const customer = params.customerName ? `${params.customerName} ji` : 'ji'
  const worker = params.workerName || 'your service professional'
  const service = params.categoryName || 'service'
  const when = params.date && params.time ? `on ${params.date} at ${params.time}` : ''

  return `Namaste ${customer}, I am ${worker} from Jugnu for your ${service} booking ${when}.\nPlease let me know if you have any location directions or special instructions before I arrive. Thank you!`
}

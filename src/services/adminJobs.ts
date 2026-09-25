import type { JobId } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'
import { getProblemImageSignedUrl } from '@/services/storage'
import { fetchBookingPaymentSummary, type BookingPaymentSummary } from '@/services/changeRequests'

export type AdminJobDetailStatus = 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'payment_pending' | 'completed' | 'cancelled' | 'disputed'
export type AdminJobQuoteRequestStatus = 'pending' | 'quoted' | 'rejected' | 'cancelled' | 'expired' | 'accepted'
export type AdminJobQuoteStatus = 'submitted' | 'accepted' | 'rejected' | 'cancelled'
export type AdminJobChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AdminJobPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'cancelled'

export interface AdminJobProfile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
}

export interface AdminJobWorkerCategory {
  id: string
  name_en: string
  name_hi: string
}

export interface AdminJobWorker extends AdminJobProfile {
  approval_status: 'pending' | 'approved' | 'rejected' | null
  categories: AdminJobWorkerCategory[]
}

export interface AdminJobBooking {
  id: JobId
  customer_id: string
  worker_id: string
  category_id: string
  service_area_id: string | null
  status: AdminJobDetailStatus
  scheduled_at: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface AdminJobServiceRequest {
  id: string
  customer_id: string
  category_id: string
  service_area_id: string
  pincode: string
  scheduled_for: string
  address: string
  notes: string | null
  status: 'open' | 'fulfilled' | 'cancelled' | 'closed'
  created_at: string
  updated_at: string
  attachments: Array<{ id: string; mime_type: string; created_at: string; signed_url: string | null }>
}

export interface AdminJobQuoteRequest {
  id: string
  service_request_id: string
  customer_id: string
  worker_id: string
  status: AdminJobQuoteRequestStatus
  requested_at: string
  response_deadline_at: string
  cancelled_at: string | null
  rejected_at: string | null
  responded_at: string | null
  created_at: string
}

export interface AdminJobQuote {
  id: string
  quote_request_id: string
  service_request_id: string
  worker_id: string
  booking_id: JobId | null
  amount: number
  details: string | null
  status: AdminJobQuoteStatus
  submitted_at: string
  accepted_at: string | null
  rejected_at: string | null
  created_at: string
}

export interface AdminJobChangeRequest {
  id: string
  booking_id: JobId
  worker_id: string
  amount: number
  reason: string
  status: AdminJobChangeStatus
  created_at: string
  decided_at: string | null
}

export interface AdminJobPayment {
  id: string
  booking_id: JobId
  customer_id: string
  worker_id: string
  amount: number
  currency: string
  status: AdminJobPaymentStatus
  payment_method: string | null
  customer_confirmed_at: string | null
  worker_confirmed_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminJobReceipt {
  id: string
  receipt_number: string
  booking_id: JobId
  payment_id: string
  customer_id: string
  worker_id: string
  category_id: string
  amount: number
  currency: string
  payment_method: string
  paid_at: string
  created_at: string
}

export interface AdminJobReview {
  id: string
  booking_id: JobId
  customer_id: string
  worker_id: string
  rating: number
  comment: string
  created_at: string
}

export interface AdminJobTimelineEvent {
  key: string
  label: string
  translationKey?: string
  timestamp: string
}

export interface AdminJobDetails {
  booking: AdminJobBooking
  customer: AdminJobProfile | null
  worker: AdminJobWorker | null
  category: { id: string; name_en: string; name_hi: string } | null
  serviceRequest: AdminJobServiceRequest | null
  quoteRequests: AdminJobQuoteRequest[]
  quotes: AdminJobQuote[]
  changeRequests: AdminJobChangeRequest[]
  payment: AdminJobPayment | null
  paymentSummary: BookingPaymentSummary | null
  receipt: AdminJobReceipt | null
  review: AdminJobReview | null
  timeline: AdminJobTimelineEvent[]
  errors: Partial<Record<'customer' | 'worker' | 'category' | 'serviceRequest' | 'quotes' | 'changeRequests' | 'payment' | 'receipt' | 'review' | 'workerCategories' | 'paymentSummary', string>>
}

async function read<T>(loader: () => Promise<{ data: T | null; error: { message?: string } | null }>): Promise<{ data: T | null; error: string | null }> {
  try {
    const result = await loader()
    return { data: result.data, error: result.error?.message || null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unable to load this section' }
  }
}

function addEvent(events: AdminJobTimelineEvent[], key: string, label: string, timestamp: string | null | undefined, translationKey?: string) {
  if (timestamp) events.push({ key, label, translationKey, timestamp })
}

export async function fetchAdminJobDetails(bookingId: JobId): Promise<AdminJobDetails> {
  const supabase = getSupabaseClient() as any
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, customer_id, worker_id, category_id, service_area_id, status, scheduled_at, address, notes, created_at, updated_at')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!booking) throw new Error('Job not found or unavailable')

  const [
    customerResult,
    workerResult,
    categoryResult,
    quotesResult,
    changesResult,
    paymentResult,
    receiptResult,
    reviewResult,
    workerCategoriesResult,
    paymentSummaryResult,
  ] = await Promise.all([
    read(() => supabase.from('profiles').select('id, full_name, phone, avatar_url').eq('id', booking.customer_id).maybeSingle()),
    read(() => supabase.from('profiles').select('id, full_name, phone, avatar_url, worker_profiles(approval_status)').eq('id', booking.worker_id).maybeSingle()),
    read(() => supabase.from('categories').select('id, name_en, name_hi').eq('id', booking.category_id).maybeSingle()),
    read(() => supabase.from('booking_quotes').select('id, quote_request_id, service_request_id, worker_id, booking_id, amount, details, status, submitted_at, accepted_at, rejected_at, created_at').eq('booking_id', bookingId).order('created_at', { ascending: true })),
    read(() => supabase.from('booking_change_requests').select('id, booking_id, worker_id, amount, reason, status, created_at, decided_at').eq('booking_id', bookingId).order('created_at', { ascending: true })),
    read(() => supabase.from('booking_payments').select('id, booking_id, customer_id, worker_id, amount, currency, status, payment_method, customer_confirmed_at, worker_confirmed_at, paid_at, created_at, updated_at').eq('booking_id', bookingId).maybeSingle()),
    read(() => supabase.from('booking_receipts').select('id, receipt_number, booking_id, payment_id, customer_id, worker_id, category_id, amount, currency, payment_method, paid_at, created_at').eq('booking_id', bookingId).maybeSingle()),
    read(() => supabase.from('reviews').select('id, booking_id, customer_id, worker_id, rating, comment, created_at').eq('booking_id', bookingId).maybeSingle()),
    read(() => supabase.from('worker_categories').select('category_id, categories(id, name_en, name_hi)').eq('worker_id', booking.worker_id)),
    read(async () => {
      const data = await fetchBookingPaymentSummary(bookingId)
      return { data, error: null }
    }),
  ])

  const quotes = ((quotesResult.data ?? []) as any[]).map(row => ({ ...row, amount: Number(row.amount) })) as AdminJobQuote[]
  const quoteRequestIds = [...new Set(quotes.map(quote => quote.quote_request_id).filter(Boolean))]
  const serviceRequestIds = [...new Set(quotes.map(quote => quote.service_request_id).filter(Boolean))]
  const quoteRequestsResult = quoteRequestIds.length
    ? await read(() => supabase.from('booking_quote_requests').select('id, service_request_id, customer_id, worker_id, status, requested_at, response_deadline_at, cancelled_at, rejected_at, responded_at, created_at').in('id', quoteRequestIds).order('created_at', { ascending: true }))
    : { data: [], error: null }
  const serviceRequestId = serviceRequestIds[0] || (quoteRequestsResult.data as any[] | null)?.[0]?.service_request_id
  const serviceRequestResult = serviceRequestId
    ? await read(() => supabase.from('service_requests').select('id, customer_id, category_id, service_area_id, pincode, scheduled_for, address, notes, status, created_at, updated_at').eq('id', serviceRequestId).maybeSingle())
    : { data: null, error: null }

  let serviceRequest: AdminJobServiceRequest | null = serviceRequestResult.data
    ? { ...(serviceRequestResult.data as AdminJobServiceRequest), attachments: [] }
    : null
  if (serviceRequest) {
    const attachmentResult = await read(() => supabase.from('service_request_attachments').select('id, storage_path, mime_type, created_at').eq('service_request_id', serviceRequest!.id).order('created_at', { ascending: true }))
    if (attachmentResult.error) {
      // Attachments are optional; the source request remains usable.
    } else {
      const attachments = await Promise.all(((attachmentResult.data ?? []) as any[]).map(async attachment => {
        let signedUrl: string | null = null
        try {
          signedUrl = await getProblemImageSignedUrl(attachment.storage_path)
        } catch {
          signedUrl = null
        }
        return {
          id: attachment.id,
          mime_type: attachment.mime_type,
          created_at: attachment.created_at,
          signed_url: signedUrl,
        }
      }))
      serviceRequest = { ...serviceRequest, attachments }
    }
  }

  const categoryData = categoryResult.data as { id: string; name_en: string; name_hi: string } | null
  const workerCategoryRows = (workerCategoriesResult.data ?? []) as any[]
  const workerCategories: AdminJobWorkerCategory[] = workerCategoryRows.map(row => {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories
    const fallbackCat = categoryData && categoryData.id === row.category_id ? categoryData : null
    return {
      id: row.category_id,
      name_en: cat?.name_en || fallbackCat?.name_en || row.category_id,
      name_hi: cat?.name_hi || fallbackCat?.name_hi || row.category_id,
    }
  })

  const workerRow = workerResult.data as any
  const workerProfile = Array.isArray(workerRow?.worker_profiles) ? workerRow.worker_profiles[0] : workerRow?.worker_profiles
  const worker: AdminJobWorker | null = workerRow
    ? { ...workerRow, approval_status: workerProfile?.approval_status ?? null, categories: workerCategories }
    : null
  const errors: AdminJobDetails['errors'] = {}
  const results = {
    customer: customerResult,
    worker: workerResult,
    category: categoryResult,
    quotes: quotesResult,
    changeRequests: changesResult,
    payment: paymentResult,
    receipt: receiptResult,
    review: reviewResult,
    workerCategories: workerCategoriesResult,
    paymentSummary: paymentSummaryResult,
  }
  for (const [key, result] of Object.entries(results)) if (result.error) errors[key as keyof AdminJobDetails['errors']] = result.error
  if (quoteRequestsResult.error) errors.quotes = quoteRequestsResult.error
  if (serviceRequestResult.error) errors.serviceRequest = serviceRequestResult.error

  const payment = paymentResult.data ? { ...(paymentResult.data as any), amount: Number((paymentResult.data as any).amount) } as AdminJobPayment : null
  const receipt = receiptResult.data ? { ...(receiptResult.data as any), amount: Number((receiptResult.data as any).amount) } as AdminJobReceipt : null
  const changeRequests = ((changesResult.data ?? []) as any[]).map(row => ({ ...row, amount: Number(row.amount) })) as AdminJobChangeRequest[]
  const timeline: AdminJobTimelineEvent[] = []
  addEvent(timeline, 'service-request-created', 'Service request created', serviceRequest?.created_at)
  for (const request of (quoteRequestsResult.data ?? []) as AdminJobQuoteRequest[]) addEvent(timeline, `quote-request-${request.id}`, 'Quote requested', request.created_at || request.requested_at, 'quote-request-created')
  for (const quote of quotes) {
    addEvent(timeline, `quote-submitted-${quote.id}`, 'Quote submitted', quote.submitted_at || quote.created_at, 'quote-submitted')
    addEvent(timeline, `quote-accepted-${quote.id}`, 'Quote accepted', quote.accepted_at, 'quote-accepted')
  }
  addEvent(timeline, 'booking-created', 'Booking created', booking.created_at)
  addEvent(timeline, 'customer-cash-confirmed', 'Customer cash confirmation', payment?.customer_confirmed_at)
  addEvent(timeline, 'worker-cash-confirmed', 'Worker cash confirmation', payment?.worker_confirmed_at)
  addEvent(timeline, 'payment-paid', 'Payment paid', payment?.paid_at)
  addEvent(timeline, 'receipt-created', 'Receipt generated', receipt?.created_at)
  addEvent(timeline, 'review-created', 'Review submitted', (reviewResult.data as any)?.created_at)
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return {
    booking: booking as AdminJobBooking,
    customer: customerResult.data as AdminJobProfile | null,
    worker,
    category: categoryResult.data as { id: string; name_en: string; name_hi: string } | null,
    serviceRequest,
    quoteRequests: (quoteRequestsResult.data ?? []) as AdminJobQuoteRequest[],
    quotes,
    changeRequests,
    payment,
    paymentSummary: paymentSummaryResult.data as BookingPaymentSummary | null,
    receipt,
    review: reviewResult.data as AdminJobReview | null,
    timeline,
    errors,
  }
}

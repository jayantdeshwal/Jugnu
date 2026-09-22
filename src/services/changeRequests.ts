import type { JobId } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type PaymentMethod = 'upi' | 'cash'
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'cancelled'

export interface BookingChangeRequest {
  id: string
  booking_id: JobId
  worker_id: string
  amount: number
  reason: string
  status: ChangeRequestStatus
  created_at: string
  decided_at: string | null
}

export interface BookingPaymentSummary {
  booking_id: JobId
  initial_quote_amount: number
  approved_additional_amount: number
  final_payable_amount: number
  pending_additional_count: number
  has_initial_quote: boolean
  is_final: boolean
  payment_id: string | null
  payment_status: PaymentStatus | null
  currency: string | null
  is_frozen: boolean
  payment_method: PaymentMethod | null
  customer_confirmed_at: string | null
  worker_confirmed_at: string | null
  paid_at: string | null
}

export async function fetchBookingPaymentSummary(bookingId: JobId): Promise<BookingPaymentSummary | null> {
  const { data, error } = await (getSupabaseClient() as any).rpc('get_booking_payment_summary', {
    target_booking_id: bookingId,
  })

  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    ...row,
    initial_quote_amount: Number(row.initial_quote_amount ?? 0),
    approved_additional_amount: Number(row.approved_additional_amount ?? 0),
    final_payable_amount: Number(row.final_payable_amount ?? 0),
    pending_additional_count: Number(row.pending_additional_count ?? 0),
    payment_id: row.payment_id ?? null,
    payment_status: row.payment_status ?? null,
    currency: row.currency ?? null,
    is_frozen: Boolean(row.is_frozen),
    payment_method: row.payment_method ?? null,
    customer_confirmed_at: row.customer_confirmed_at ?? null,
    worker_confirmed_at: row.worker_confirmed_at ?? null,
    paid_at: row.paid_at ?? null,
  } as BookingPaymentSummary
}

export async function selectBookingPaymentMethod(bookingId: JobId, paymentMethod: PaymentMethod): Promise<PaymentMethod> {
  const { data, error } = await (getSupabaseClient() as any).rpc('select_booking_payment_method', {
    target_booking_id: bookingId,
    target_payment_method: paymentMethod,
  })

  if (error) throw error
  return data as PaymentMethod
}

export async function confirmCashPaymentByCustomer(bookingId: JobId): Promise<'pending' | 'paid'> {
  const { data, error } = await (getSupabaseClient() as any).rpc('confirm_cash_payment_by_customer', {
    target_booking_id: bookingId,
  })

  if (error) throw error
  return data as 'pending' | 'paid'
}

export async function confirmCashReceivedByWorker(bookingId: JobId): Promise<'paid'> {
  const { data, error } = await (getSupabaseClient() as any).rpc('confirm_cash_received_by_worker', {
    target_booking_id: bookingId,
  })

  if (error) throw error
  return data as 'paid'
}

export async function fetchBookingPaymentSummaries(bookingIds: JobId[]): Promise<BookingPaymentSummary[]> {
  const summaries = await Promise.all(bookingIds.map(bookingId => fetchBookingPaymentSummary(bookingId)))
  return summaries.filter((summary): summary is BookingPaymentSummary => Boolean(summary))
}

export async function fetchBookingChangeRequests(bookingIds: JobId[]): Promise<BookingChangeRequest[]> {
  if (bookingIds.length === 0) return []

  const { data, error } = await getSupabaseClient()
    .from('booking_change_requests')
    .select('id, booking_id, worker_id, amount, reason, status, created_at, decided_at')
    .in('booking_id', bookingIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BookingChangeRequest[]
}

export async function createBookingChangeRequest(params: {
  bookingId: JobId
  amount: number
  reason: string
}): Promise<string> {
  const { data, error } = await (getSupabaseClient() as any).rpc('create_booking_change_request', {
    target_booking_id: params.bookingId,
    target_amount: params.amount,
    target_reason: params.reason.trim(),
  })

  if (error) throw error
  return data as string
}

export async function decideBookingChangeRequest(requestId: string, decision: 'approved' | 'rejected'): Promise<void> {
  const { error } = await (getSupabaseClient() as any).rpc('decide_booking_change_request', {
    target_request_id: requestId,
    target_decision: decision,
  })

  if (error) throw error
}

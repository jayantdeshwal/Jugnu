import type { JobId } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

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

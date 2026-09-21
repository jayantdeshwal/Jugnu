import { getSupabaseClient } from '@/lib/supabase'
import type { JobId } from '@kaamgar/shared'

export interface ReviewItem {
  id: string
  booking_id: JobId
  customer_id: string
  worker_id: string
  rating: number
  comment: string
  created_at: string
  customer_name: string
  customer_avatar: string | null
}

function formatCustomerDisplayName(fullName?: string | null): string {
  if (!fullName) return 'Verified Customer'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

/**
 * Fetches all verified customer reviews for a given worker.
 */
export async function fetchWorkerReviews(workerId: string): Promise<ReviewItem[]> {
  if (!workerId) return []
  const supabase = getSupabaseClient()

  const { data: reviewsData, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, booking_id, customer_id, worker_id, rating, comment, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })

  if (reviewsError) {
    console.warn('Error fetching worker reviews:', reviewsError.message)
    return []
  }

  const reviews = (reviewsData ?? []).filter((review: any) => {
    const rating = Number(review.rating)
    return Number.isInteger(rating) && rating >= 1 && rating <= 5
  }) as any[]
  if (reviews.length === 0) return []

  const customerIds = [...new Set(reviews.map(r => r.customer_id))].filter(Boolean)
  let customerMap = new Map<string, { name: string; avatar: string | null }>()

  if (customerIds.length > 0) {
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', customerIds)

    if (!profError && profiles) {
      customerMap = new Map(
        profiles.map((p: any) => [
          p.id,
          {
            name: formatCustomerDisplayName(p.full_name),
            avatar: p.avatar_url || null,
          },
        ])
      )
    }
  }

  return reviews.map(r => {
    const cust = customerMap.get(r.customer_id) || { name: 'Verified Customer', avatar: null }
    return {
      id: r.id,
      booking_id: r.booking_id,
      customer_id: r.customer_id,
      worker_id: r.worker_id,
      rating: Number(r.rating),
      comment: r.comment ?? '',
      created_at: r.created_at,
      customer_name: cust.name,
      customer_avatar: cust.avatar,
    }
  })
}

/**
 * Fetches the set of booking IDs already reviewed by the logged-in customer.
 */
export async function fetchCustomerReviewedBookingIds(customerId?: string): Promise<Set<string>> {
  const supabase = getSupabaseClient()
  let targetId = customerId

  if (!targetId) {
    const { data: authData } = await supabase.auth.getUser()
    targetId = authData.user?.id
  }

  if (!targetId) return new Set()

  const { data, error } = await supabase
    .from('reviews')
    .select('booking_id')
    .eq('customer_id', targetId)

  if (error) {
    console.warn('Error fetching reviewed booking IDs:', error.message)
    return new Set()
  }

  return new Set((data ?? []).map((r: any) => r.booking_id).filter(Boolean))
}

/**
 * Submits a rating and comment review for a completed booking.
 */
export async function submitBookingReview(params: {
  bookingId: string
  workerId?: string
  rating: number
  comment: string
}): Promise<string> {
  const supabase = getSupabaseClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const customerId = authData.user?.id
  if (!customerId) throw new Error('Please sign in to submit a review')

  // 1. Attempt RPC submit_booking_review first
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc('submit_booking_review', {
    target_booking_id: params.bookingId,
    target_rating: params.rating,
    target_comment: params.comment.trim(),
  })

  if (!rpcError && rpcData) {
    return rpcData as string
  }

  // 2. Fallback to direct table insert if RPC is pending migration
  if (!params.workerId) {
    // Look up worker_id from booking
    const { data: booking, error: bError } = await (supabase as any)
      .from('bookings')
      .select('worker_id')
      .eq('id', params.bookingId)
      .maybeSingle()

    if (bError || !booking) throw new Error('Booking could not be verified')
    params.workerId = (booking as any).worker_id
  }

  const { data: insertData, error: insertError } = await (supabase as any)
    .from('reviews')
    .insert({
      booking_id: params.bookingId,
      customer_id: customerId,
      worker_id: params.workerId,
      rating: params.rating,
      comment: params.comment.trim(),
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  return (insertData as any).id
}

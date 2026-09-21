import type { JobId } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'
import { getProblemImageSignedUrl } from '@/services/storage'

export type QuoteRequestStatus = 'pending' | 'quoted' | 'rejected' | 'cancelled' | 'expired' | 'accepted'
export type QuoteStatus = 'submitted' | 'accepted' | 'rejected' | 'cancelled'

export interface ServiceRequest {
  id: string
  customer_id: string
  category_id: string
  service_area_id: string
  pincode: string
  scheduled_for: string
  address: string
  notes: string | null
  problem_image_path?: string | null
  problem_image_url?: string | null
  status: 'open' | 'fulfilled' | 'cancelled' | 'closed'
  created_at: string
  updated_at: string
}

export interface BookingQuoteRequest {
  id: string
  service_request_id: string
  customer_id: string
  worker_id: string
  status: QuoteRequestStatus
  requested_at: string
  response_deadline_at: string
  cancelled_at: string | null
  rejected_at: string | null
  responded_at: string | null
  created_at: string
  service_request?: ServiceRequest
}

export interface BookingQuote {
  id: string
  quote_request_id: string
  service_request_id: string
  worker_id: string
  booking_id: JobId | null
  amount: number
  details: string | null
  status: QuoteStatus
  submitted_at: string
  accepted_at: string | null
  created_at: string
  quote_request?: BookingQuoteRequest
}

export async function createServiceRequest(params: {
  categoryId: string
  pincode: string
  scheduledFor: string
  address: string
  notes?: string
}): Promise<string> {
  const { data, error } = await (getSupabaseClient() as any).rpc('create_service_request', {
    target_category_id: params.categoryId,
    target_pincode: params.pincode,
    target_scheduled_for: params.scheduledFor,
    target_address: params.address,
    target_notes: params.notes || null,
  })
  if (error) throw error
  return data as string
}

export async function createBookingQuoteRequest(params: {
  serviceRequestId: string
  workerId: string
  responseDeadlineAt: string
}): Promise<string> {
  const { data, error } = await (getSupabaseClient() as any).rpc('create_booking_quote_request', {
    target_service_request_id: params.serviceRequestId,
    target_worker_id: params.workerId,
    target_response_deadline_at: params.responseDeadlineAt,
  })
  if (error) throw error
  return data as string
}

export async function cancelBookingQuoteRequest(requestId: string, reason?: string): Promise<void> {
  const { error } = await (getSupabaseClient() as any).rpc('cancel_booking_quote_request', {
    target_quote_request_id: requestId,
    target_reason: reason || null,
  })
  if (error) throw error
}

export async function respondToBookingQuoteRequest(params: {
  requestId: string
  action: 'reject' | 'quote'
  amount?: number
  details?: string
}): Promise<string | null> {
  const { data, error } = await (getSupabaseClient() as any).rpc('respond_to_booking_quote_request', {
    target_quote_request_id: params.requestId,
    target_action: params.action,
    target_amount: params.amount ?? null,
    target_details: params.details || null,
  })
  if (error) throw error
  return data as string | null
}

export async function acceptBookingQuote(quoteId: string): Promise<JobId> {
  const { data, error } = await (getSupabaseClient() as any).rpc('accept_booking_quote', {
    target_quote_id: quoteId,
  })
  if (error) throw error
  return data as JobId
}

export async function fetchCustomerQuoteData(customerId: string): Promise<{ requests: BookingQuoteRequest[]; quotes: BookingQuote[] }> {
  const supabase = getSupabaseClient() as any
  const { data: requests, error: requestError } = await supabase
    .from('booking_quote_requests')
    .select('id, service_request_id, customer_id, worker_id, status, requested_at, response_deadline_at, cancelled_at, rejected_at, responded_at, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (requestError) throw requestError
  const requestRows = (requests ?? []) as BookingQuoteRequest[]
  const requestIds = requestRows.map(request => request.id)
  const serviceIds = [...new Set(requestRows.map(request => request.service_request_id))]
  const [serviceRes, quoteRes] = await Promise.all([
    serviceIds.length ? supabase.from('service_requests').select('*').in('id', serviceIds) : Promise.resolve({ data: [], error: null }),
    requestIds.length ? supabase.from('booking_quotes').select('*').in('quote_request_id', requestIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ])
  if (serviceRes.error) throw serviceRes.error
  if (quoteRes.error) throw quoteRes.error
  const attachmentRes = serviceIds.length
    ? await supabase.from('service_request_attachments').select('service_request_id, storage_path').in('service_request_id', serviceIds)
    : { data: [], error: null }
  if (attachmentRes.error) throw attachmentRes.error
  const attachmentUrls = await Promise.all((attachmentRes.data ?? []).map(async (attachment: any) => [
    attachment.service_request_id,
    await getProblemImageSignedUrl(attachment.storage_path),
  ] as const))
  const imageByServiceId = new Map(attachmentUrls)
  const services = new Map((serviceRes.data ?? []).map((service: ServiceRequest) => [
    service.id,
    { ...service, problem_image_url: imageByServiceId.get(service.id) ?? null },
  ]))
  const enrichedRequests = requestRows.map(request => ({ ...request, service_request: services.get(request.service_request_id) })) as BookingQuoteRequest[]
  const quoteRows = (quoteRes.data ?? []) as BookingQuote[]
  const requestMap = new Map(enrichedRequests.map(request => [request.id, request]))
  return { requests: enrichedRequests, quotes: quoteRows.map(quote => ({ ...quote, quote_request: requestMap.get(quote.quote_request_id) })) as BookingQuote[] }
}

export async function fetchWorkerQuoteData(workerId: string): Promise<{ requests: BookingQuoteRequest[]; services: ServiceRequest[]; quotes: BookingQuote[] }> {
  const supabase = getSupabaseClient() as any
  const { data: requests, error: requestError } = await supabase
    .from('booking_quote_requests')
    .select('id, service_request_id, customer_id, worker_id, status, requested_at, response_deadline_at, cancelled_at, rejected_at, responded_at, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
  if (requestError) throw requestError
  const requestRows = (requests ?? []) as BookingQuoteRequest[]
  const ids = [...new Set(requestRows.map(request => request.service_request_id))]
  const serviceRes = ids.length ? await supabase.from('service_requests').select('*').in('id', ids) : { data: [], error: null }
  if (serviceRes.error) throw serviceRes.error
  const quoteRes = requestRows.length ? await supabase.from('booking_quotes').select('*').in('quote_request_id', requestRows.map(request => request.id)) : { data: [], error: null }
  if (quoteRes.error) throw quoteRes.error
  const attachmentRes = ids.length
    ? await supabase.from('service_request_attachments').select('service_request_id, storage_path').in('service_request_id', ids)
    : { data: [], error: null }
  if (attachmentRes.error) throw attachmentRes.error
  const attachmentUrls = await Promise.all((attachmentRes.data ?? []).map(async (attachment: any) => [
    attachment.service_request_id,
    await getProblemImageSignedUrl(attachment.storage_path),
  ] as const))
  const imageByServiceId = new Map(attachmentUrls)
  const services = (serviceRes.data ?? []).map((service: ServiceRequest) => ({
    ...service,
    problem_image_url: imageByServiceId.get(service.id) ?? null,
  })) as ServiceRequest[]
  return { requests: requestRows, services, quotes: (quoteRes.data ?? []) as BookingQuote[] }
}

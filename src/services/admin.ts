import { getSupabaseClient } from '@/lib/supabase'

export interface AdminWorkerRow {
  id: string
  name: string
  phone: string
  avatar_url: string | null
  id_proof_url: string | null
  bio: string
  experience_years: number
  approval_status: 'pending' | 'approved' | 'rejected'
  is_available: boolean
  rating: number
  review_count: number
  rejection_reason: string | null
  created_at: string
  categories: string[]
  areas: string[]
  completed_jobs: number
  total_bookings: number
}

export interface AdminCustomerRow {
  id: string
  name: string
  phone: string
  avatar_url: string | null
  created_at: string
  total_bookings: number
  completed_bookings: number
  active_bookings: number
}

/**
 * Fetches all workers with full details, categories, service areas, and real job counts.
 */
export async function fetchAdminWorkers(): Promise<AdminWorkerRow[]> {
  const supabase = getSupabaseClient()

  // 1. Try get_admin_workers RPC first (efficient server-side aggregation)
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_admin_workers')

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((row: any) => ({
      id: row.id,
      name: row.name || 'Unnamed Worker',
      phone: row.phone || 'No phone',
      avatar_url: row.avatar_url || null,
      id_proof_url: row.id_proof_url || null,
      bio: row.bio || '',
      experience_years: Number(row.experience_years ?? 0),
      approval_status: row.approval_status || 'pending',
      is_available: Boolean(row.is_available),
      rating: Number(row.rating ?? 0),
      review_count: Number(row.review_count ?? 0),
      rejection_reason: row.rejection_reason || null,
      created_at: row.created_at,
      categories: Array.isArray(row.categories) ? row.categories : [],
      areas: Array.isArray(row.areas) ? row.areas : [],
      completed_jobs: Number(row.completed_jobs ?? 0),
      total_bookings: Number(row.total_bookings ?? 0),
    }))
  }

  // 2. Fallback to direct tables query if RPC migration is pending
  const [workersResult, bookingsResult] = await Promise.all([
    supabase
      .from('worker_profiles')
      .select(`
        id,
        bio,
        experience_years,
        approval_status,
        is_available,
        rating,
        review_count,
        rejection_reason,
        id_proof_url,
        created_at,
        profiles!inner(full_name, phone, avatar_url),
        worker_categories(category_id),
        worker_service_areas(service_areas(pincode))
      `)
      .order('created_at', { ascending: false }),
    supabase.from('bookings').select('id, worker_id, status'),
  ])

  if (workersResult.error) throw workersResult.error

  const bookings = (bookingsResult.data ?? []) as any[]
  const totalBookingsByWorker = new Map<string, number>()
  const completedBookingsByWorker = new Map<string, number>()

  for (const b of bookings) {
    if (!b.worker_id) continue
    totalBookingsByWorker.set(b.worker_id, (totalBookingsByWorker.get(b.worker_id) || 0) + 1)
    if (b.status === 'completed') {
      completedBookingsByWorker.set(
        b.worker_id,
        (completedBookingsByWorker.get(b.worker_id) || 0) + 1,
      )
    }
  }

  return (workersResult.data ?? []).map((w: any) => ({
    id: w.id,
    name: w.profiles?.full_name || 'Unnamed Worker',
    phone: w.profiles?.phone || 'No phone',
    avatar_url: w.profiles?.avatar_url || null,
    id_proof_url: w.id_proof_url || null,
    bio: w.bio || '',
    experience_years: Number(w.experience_years ?? 0),
    approval_status: w.approval_status || 'pending',
    is_available: Boolean(w.is_available),
    rating: Number(w.rating ?? 0),
    review_count: Number(w.review_count ?? 0),
    rejection_reason: w.rejection_reason || null,
    created_at: w.created_at,
    categories: (w.worker_categories ?? []).map((c: any) => c.category_id).filter(Boolean),
    areas: (w.worker_service_areas ?? [])
      .map((a: any) => a.service_areas?.pincode)
      .filter(Boolean),
    completed_jobs: completedBookingsByWorker.get(w.id) || 0,
    total_bookings: totalBookingsByWorker.get(w.id) || 0,
  }))
}

/**
 * Fetches all registered customers with profile details and booking metrics.
 */
export async function fetchAdminCustomers(): Promise<AdminCustomerRow[]> {
  const supabase = getSupabaseClient()

  // 1. Try get_admin_customers RPC first
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_admin_customers')

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((row: any) => ({
      id: row.id,
      name: row.name || 'Unnamed Customer',
      phone: row.phone || 'No phone',
      avatar_url: row.avatar_url || null,
      created_at: row.created_at,
      total_bookings: Number(row.total_bookings ?? 0),
      completed_bookings: Number(row.completed_bookings ?? 0),
      active_bookings: Number(row.active_bookings ?? 0),
    }))
  }

  // 2. Fallback to direct tables query if RPC migration is pending
  const [customersResult, bookingsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false }),
    supabase.from('bookings').select('id, customer_id, status'),
  ])

  if (customersResult.error) throw customersResult.error

  const bookings = (bookingsResult.data ?? []) as any[]
  const totalBookingsByCustomer = new Map<string, number>()
  const completedByCustomer = new Map<string, number>()
  const activeByCustomer = new Map<string, number>()

  for (const b of bookings) {
    if (!b.customer_id) continue
    totalBookingsByCustomer.set(b.customer_id, (totalBookingsByCustomer.get(b.customer_id) || 0) + 1)
    if (b.status === 'completed') {
      completedByCustomer.set(b.customer_id, (completedByCustomer.get(b.customer_id) || 0) + 1)
    } else if (['pending', 'accepted', 'in_progress'].includes(b.status)) {
      activeByCustomer.set(b.customer_id, (activeByCustomer.get(b.customer_id) || 0) + 1)
    }
  }

  return (customersResult.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.full_name || 'Unnamed Customer',
    phone: c.phone || 'No phone',
    avatar_url: c.avatar_url || null,
    created_at: c.created_at,
    total_bookings: totalBookingsByCustomer.get(c.id) || 0,
    completed_bookings: completedByCustomer.get(c.id) || 0,
    active_bookings: activeByCustomer.get(c.id) || 0,
  }))
}

export interface AdminNotificationItem {
  id: string
  user_id: string
  booking_id: string | null
  notification_type: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

/**
 * Fetches all notifications relevant to administrators:
 * - Worker registrations pending review
 * - ID proof uploads
 */
export async function fetchAdminNotifications(): Promise<AdminNotificationItem[]> {
  const supabase = getSupabaseClient()

  // 1. Try get_admin_notifications RPC
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_admin_notifications', {
    limit_count: 50,
  })

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as AdminNotificationItem[]
  }

  // 2. Fallback to direct notifications query
  const { data, error } = await (supabase.from('notifications') as any)
    .select('id, user_id, booking_id, notification_type, title, body, read_at, created_at')
    .in('notification_type', ['worker_registration_submitted', 'worker_document_uploaded'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.warn('Fallback fetchAdminNotifications error:', error.message)
    return []
  }

  return (data ?? []) as AdminNotificationItem[]
}

/**
 * Proactively dispatches admin notifications when a worker submits registration
 */
export async function notifyAdminsOfWorkerRegistration(params: {
  workerId: string
  workerName: string
  category: string
}): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const { data: admins } = await (supabase.from('profiles') as any)
      .select('id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    const notificationsToInsert = admins.map((adm: any) => ({
      user_id: adm.id,
      notification_type: 'worker_registration_submitted',
      title: 'New Worker Registration Pending Review',
      body: `${params.workerName} submitted registration for ${params.category} and is waiting for document verification and approval.`,
      created_at: new Date().toISOString(),
    }))

    await (supabase.from('notifications') as any).insert(notificationsToInsert)
  } catch (err) {
    console.warn('Error sending registration notification to admins:', err)
  }
}

/**
 * Permanently deletes a worker or customer profile from the platform,
 * cascading through bookings, reviews, notifications, complaints, and auth records.
 */
export async function deleteProfilePermanently(targetProfileId: string): Promise<{
  success: boolean
  deleted_bookings?: number
  deleted_reviews?: number
}> {
  const supabase = getSupabaseClient()

  const { data, error } = await (supabase as any).rpc('admin_delete_profile_permanently', {
    target_profile_id: targetProfileId,
  })

  if (error) {
    throw new Error(error.message || 'Failed to delete profile.')
  }

  return data || { success: true }
}

export interface AdminTeamMember {
  id: string
  full_name: string
  email: string
  phone: string
  avatar_url?: string | null
  created_at: string
}

export interface CreateAdminParams {
  email: string
  password: string
  fullName: string
  phone: string
}

export async function fetchAdminTeam(): Promise<AdminTeamMember[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await (supabase as any).rpc('get_admin_team')
  if (error) {
    const { data: directData, error: directError } = await (supabase.from('profiles') as any)
      .select('id, full_name, email, phone, avatar_url, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
    if (directError) throw directError
    return (directData || []).map((adm: any) => ({
      id: adm.id,
      full_name: adm.full_name || 'Admin User',
      email: adm.email || 'No email',
      phone: adm.phone || 'No phone',
      avatar_url: adm.avatar_url || null,
      created_at: adm.created_at,
    }))
  }
  return (data || []).map((adm: any) => ({
    id: adm.id,
    full_name: adm.full_name || 'Admin User',
    email: adm.email || 'No email',
    phone: adm.phone || 'No phone',
    avatar_url: adm.avatar_url || null,
    created_at: adm.created_at,
  }))
}

export async function createSubAdmin(params: CreateAdminParams): Promise<{ success: boolean; message?: string }> {
  const supabase = getSupabaseClient()
  const { data, error } = await (supabase as any).rpc('admin_create_sub_admin', {
    admin_email: params.email.trim(),
    admin_password: params.password,
    admin_full_name: params.fullName.trim(),
    admin_phone: params.phone.trim(),
  })
  if (error) {
    throw new Error(error.message || 'Failed to create administrator account.')
  }
  return data || { success: true }
}

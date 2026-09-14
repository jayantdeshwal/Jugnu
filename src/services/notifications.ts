import { getSupabaseClient } from '@/lib/supabase'

export interface DbNotification {
  id: string
  user_id: string
  booking_id: string | null
  notification_type: 'booking_created' | 'booking_accepted' | 'booking_in_progress' | 'booking_completed' | 'booking_rejected' | 'booking_cancelled' | 'profile_approved' | 'profile_rejected' | 'review_received' | string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

function isValidUuid(id?: string | null): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export async function fetchUserNotifications(userId?: string): Promise<DbNotification[]> {
  const supabase = getSupabaseClient()
  let targetId = isValidUuid(userId) ? userId : undefined

  if (!targetId) {
    const { data: authData } = await supabase.auth.getUser()
    targetId = authData.user?.id
  }

  if (!targetId || !isValidUuid(targetId)) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, booking_id, notification_type, title, body, read_at, created_at')
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Error fetching notifications from Supabase:', error.message)
    return []
  }

  return (data ?? []) as DbNotification[]
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isValidUuid(notificationId)) return
  const supabase = getSupabaseClient()

  // 1. Try RPC
  const { error: rpcError } = await (supabase as any).rpc('mark_notification_read', {
    target_notification_id: notificationId,
  })

  if (rpcError) {
    // 2. Fallback to direct table update
    const { error: updateError } = await (supabase.from('notifications') as any)
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (updateError) console.warn('Fallback markNotificationRead error:', updateError.message)
  }
}

export async function markAllNotificationsRead(userId?: string): Promise<void> {
  const supabase = getSupabaseClient()
  let targetId = isValidUuid(userId) ? userId : undefined

  if (!targetId) {
    const { data: authData } = await supabase.auth.getUser()
    targetId = authData.user?.id
  }

  // 1. Try RPC
  const { error: rpcError } = await (supabase as any).rpc('mark_all_notifications_read')

  if (rpcError && targetId && isValidUuid(targetId)) {
    // 2. Fallback to direct table update
    const { error: updateError } = await (supabase.from('notifications') as any)
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', targetId)
      .is('read_at', null)

    if (updateError) console.warn('Fallback markAllNotificationsRead error:', updateError.message)
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  if (!isValidUuid(notificationId)) return
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) console.warn('Error deleting notification:', error.message)
}

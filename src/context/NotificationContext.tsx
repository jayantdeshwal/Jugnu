import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import {
  DbNotification,
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/services/notifications'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationContextType {
  // Ephemeral toast alerts
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string

  // Persistent database notifications
  dbNotifications: DbNotification[]
  unreadCount: number
  isLoadingNotifications: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteDbNotification: (id: string) => Promise<void>
  refreshNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // 1. Ephemeral toasts
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newNotification = { ...notification, id }
    setNotifications(prev => [...prev, newNotification])

    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id)
      }, notification.duration ?? 5000)
    }

    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const helpers = {
    success: (title: string, message?: string) => addNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) => addNotification({ type: 'error', title, message, duration: 8000 }),
    warning: (title: string, message?: string) => addNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) => addNotification({ type: 'info', title, message }),
  }

  // 2. Database Notifications
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)

  const loadDbNotifications = useCallback(async () => {
    setIsLoadingNotifications(true)
    try {
      const items = await fetchUserNotifications(user?.id)
      setDbNotifications(items)
    } catch (err) {
      console.warn('Failed to load database notifications:', err)
    } finally {
      setIsLoadingNotifications(false)
    }
  }, [user?.id])

  // Sync on user change & register realtime + polling
  useEffect(() => {
    if (!user?.id) {
      setDbNotifications([])
      return
    }

    setIsLoadingNotifications(true)
    void loadDbNotifications()

    // Setup realtime subscription
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadDbNotifications()
        }
      )
      .subscribe()

    // 20-second polling fallback to guarantee fresh notifications even if websocket is closed
    const interval = setInterval(() => {
      void loadDbNotifications()
    }, 20000)

    return () => {
      clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [user?.id, loadDbNotifications])

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setDbNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
      await markNotificationRead(id)
    } catch (err) {
      console.warn('Failed to mark notification as read:', err)
      void loadDbNotifications()
    }
  }, [loadDbNotifications])

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const now = new Date().toISOString()
      setDbNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
      await markAllNotificationsRead(user?.id)
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err)
      void loadDbNotifications()
    }
  }, [user?.id, loadDbNotifications])

  const handleDeleteDbNotification = useCallback(async (id: string) => {
    try {
      setDbNotifications(prev => prev.filter(n => n.id !== id))
      await deleteNotification(id)
    } catch (err) {
      console.warn('Failed to delete notification:', err)
      void loadDbNotifications()
    }
  }, [loadDbNotifications])

  const unreadCount = dbNotifications.filter(n => !n.read_at).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
        ...helpers,

        dbNotifications,
        unreadCount,
        isLoadingNotifications,
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
        deleteDbNotification: handleDeleteDbNotification,
        refreshNotifications: loadDbNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
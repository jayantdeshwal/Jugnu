import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { useNotifications } from '@/context/NotificationContext'
import { useAuth } from '@/context/AuthContext'
import { Card, Badge, Button } from '@kaamgar/ui'
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Star,
  Play,
  RefreshCw,
  X,
  Check,
  UserCheck,
  FileText,
  ArrowLeft,
} from 'lucide-react'
import { DbNotification } from '@/services/notifications'

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  booking_created: {
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-950/60 border border-blue-800/40',
  },
  booking_accepted: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/60 border border-emerald-800/40',
  },
  booking_in_progress: {
    icon: Play,
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/60 border border-indigo-800/40',
  },
  booking_rejected: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-950/60 border border-red-800/40',
  },
  booking_cancelled: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bg: 'bg-amber-950/60 border border-amber-800/40',
  },
  booking_completed: {
    icon: Star,
    color: 'text-purple-400',
    bg: 'bg-purple-950/60 border border-purple-800/40',
  },
  review_received: {
    icon: Star,
    color: 'text-amber-400',
    bg: 'bg-amber-950/60 border border-amber-800/40',
  },
  profile_approved: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/60 border border-emerald-800/40',
  },
  profile_rejected: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-950/60 border border-red-800/40',
  },
  worker_registration_submitted: {
    icon: UserCheck,
    color: 'text-brand-400',
    bg: 'bg-brand-950/60 border border-brand-800/40',
  },
  worker_document_uploaded: {
    icon: FileText,
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/60 border border-indigo-800/40',
  },
  admin_new_booking: {
    icon: Calendar,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/60 border border-cyan-800/40',
  },
  admin_booking_cancelled: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bg: 'bg-amber-950/60 border border-amber-800/40',
  },
  system: {
    icon: Bell,
    color: 'text-semantic-text-secondary',
    bg: 'bg-surface-200 border border-semantic-border-light',
  },
}

function formatNotificationTime(isoString: string): string {
  const date = new Date(isoString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export default function Notifications() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isWorker, isAdmin } = useAuth()
  const {
    dbNotifications,
    unreadCount,
    isLoadingNotifications,
    markAsRead,
    markAllAsRead,
    deleteDbNotification,
    refreshNotifications,
  } = useNotifications()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshSuccess(false)
    try {
      await refreshNotifications()
      setRefreshSuccess(true)
      setTimeout(() => setRefreshSuccess(false), 2000)
    } catch (err) {
      console.error('Refresh error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getTypeConfig = (type: string) => typeConfig[type] || typeConfig.system

  const getNotificationAction = (item: DbNotification) => {
    if (
      item.notification_type === 'worker_registration_submitted' ||
      item.notification_type === 'worker_document_uploaded'
    ) {
      return {
        label: t('admin.dashboard', 'Admin Portal'),
        url: '/admin?tab=notifications',
      }
    }
    if (item.notification_type === 'booking_created' || (item.booking_id && isWorker)) {
      return {
        label: t('notifications.viewDashboard', 'Worker Dashboard'),
        url: '/worker/dashboard',
      }
    }
    if (item.booking_id) {
      return {
        label: t('notifications.viewBooking', 'My Bookings'),
        url: '/bookings',
      }
    }
    if (item.notification_type === 'profile_approved' || item.notification_type === 'profile_rejected') {
      return {
        label: t('notifications.viewDashboard', 'Worker Dashboard'),
        url: '/worker/dashboard',
      }
    }
    return null
  }

  const handleActionClick = (notification: DbNotification, url: string) => {
    if (!notification.read_at) {
      void markAsRead(notification.id)
    }
    navigate(url)
  }

  return (
    <div className="min-h-screen bg-semantic-bg-primary text-semantic-text-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-xs font-semibold text-semantic-text-secondary hover:text-white border border-semantic-border-light transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
            <span>{t('categoryPage.backToHome', 'Back to Home')}</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-semantic-text-primary flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-brand-400" />
              <span>{isAdmin ? t('notifications.title', 'Notifications') : t('notifications.alertsTitle', 'Your Alerts')}</span>
              {unreadCount > 0 && <Badge variant="danger">{unreadCount}</Badge>}
            </h1>
            <p className="text-semantic-text-secondary mt-1">
              {isAdmin
                ? t(
                    'notifications.adminSubtitle',
                    'Stay updated with worker registrations and verification alerts'
                  )
                : t(
                    'notifications.subtitle',
                    'Stay updated with your bookings and account activity'
                  )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingNotifications}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoadingNotifications ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? t('common.loading', 'Refreshing...') : refreshSuccess ? t('common.done', 'Updated') : t('common.refresh', 'Refresh')}</span>
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markAllAsRead()}
                className="flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('notifications.markAllRead', 'Mark all read')}</span>
              </Button>
            )}
          </div>
        </div>

        {isLoadingNotifications && dbNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-semantic-text-secondary">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-400 mb-3" />
            <p>{t('common.loading', 'Loading notifications...')}</p>
          </div>
        ) : dbNotifications.length === 0 ? (
          <div className="text-center py-16 bg-surface-100 border border-semantic-border-light rounded-2xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-200 rounded-full flex items-center justify-center text-semantic-text-tertiary">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-semantic-text-primary mb-1">
              {t('notifications.empty', 'No notifications')}
            </h3>
            <p className="text-semantic-text-secondary text-sm max-w-sm mx-auto">
              {t('notifications.noNotificationsDesc', "You'll see real-time alerts here when booking requests, status changes, or account approvals occur.")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dbNotifications.map(notification => {
              const isUnread = !notification.read_at
              const config = getTypeConfig(notification.notification_type)
              const Icon = config.icon
              const action = getNotificationAction(notification)

              return (
                <Card
                  key={notification.id}
                  onClick={() => {
                    if (isUnread) void markAsRead(notification.id)
                  }}
                  className={`p-4 transition-all duration-200 cursor-pointer ${
                    isUnread
                      ? 'bg-surface-100 border-brand-500/40 shadow-sm hover:border-brand-500/70'
                      : 'bg-surface-200/40 border-semantic-border-light opacity-90 hover:opacity-100 hover:bg-surface-200/70'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`font-semibold text-base ${
                              isUnread ? 'text-semantic-text-primary' : 'text-semantic-text-secondary'
                            }`}
                          >
                            {notification.title}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0" title="Unread" />
                          )}
                        </div>
                        <span className="text-xs text-semantic-text-tertiary whitespace-nowrap">
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-semantic-text-secondary leading-relaxed">
                        {notification.body}
                      </p>

                      {action && (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={e => {
                              e.stopPropagation()
                              handleActionClick(notification, action.url)
                            }}
                            className="text-xs py-1 px-3"
                          >
                            {action.label}
                          </Button>
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={e => {
                                e.stopPropagation()
                                void markAsRead(notification.id)
                              }}
                              className="text-xs text-semantic-text-tertiary hover:text-semantic-text-primary"
                            >
                              {t('notifications.markRead', 'Mark as read')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation()
                        void deleteDbNotification(notification.id)
                      }}
                      className="shrink-0 p-1 text-semantic-text-tertiary hover:text-danger-400 rounded-lg hover:bg-surface-200 transition-colors"
                      title={t('notifications.dismiss', 'Dismiss')}
                      aria-label="Dismiss notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

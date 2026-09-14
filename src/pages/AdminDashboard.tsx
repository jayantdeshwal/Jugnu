import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Card, Badge, Button, Modal, Avatar, RatingStars } from '@kaamgar/ui'
import {
  Users,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Search,
  Filter,
  Eye,
  Check,
  X,
  MapPin,
  Briefcase,
  Star,
  Calendar,
  Phone,
  RefreshCw,
  IdCard,
  ExternalLink,
  Camera,
  User,
  Bell,
  FileText,
  UserCheck,
  CheckCheck,
  Trash2,
} from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import {
  fetchAdminWorkers,
  fetchAdminCustomers,
  fetchAdminNotifications,
  deleteProfilePermanently,
  AdminWorkerRow,
  AdminCustomerRow,
  AdminNotificationItem,
} from '@/services/admin'
import { getIdProofSignedUrl } from '@/services/storage'

interface ReviewWorkerRpc {
  rpc: (
    functionName: 'review_worker',
    params: { target_worker_id: string; decision: 'approved' | 'rejected'; decision_reason?: string },
  ) => Promise<{ error: { message: string } | null }>
}

interface AdminBooking {
  id: string
  customer_id: string
  worker_id: string
  category_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
  scheduled_at: string | null
  created_at: string
  customerName: string
  workerName: string
}

interface AdminStats {
  workers: number
  customers: number
  bookings: number
  pendingApprovals: number
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const { user, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab') as
    | 'overview'
    | 'workers'
    | 'customers'
    | 'bookings'
    | 'notifications'
    | null

  const [activeTab, setActiveTab] = useState<
    'overview' | 'workers' | 'customers' | 'bookings' | 'notifications'
  >(
    tabParam &&
      ['overview', 'workers', 'customers', 'bookings', 'notifications'].includes(tabParam)
      ? tabParam
      : 'overview'
  )

  useEffect(() => {
    const tab = searchParams.get('tab') as any
    if (
      tab &&
      ['overview', 'workers', 'customers', 'bookings', 'notifications'].includes(tab)
    ) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Notifications state
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationFilter, setNotificationFilter] = useState<
    'all' | 'registrations' | 'documents' | 'unread'
  >('all')

  // Approval / Rejection action modal
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedWorkerForAction, setSelectedWorkerForAction] = useState<AdminWorkerRow | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Inspection modals
  const [inspectWorker, setInspectWorker] = useState<AdminWorkerRow | null>(null)
  const [inspectCustomer, setInspectCustomer] = useState<AdminCustomerRow | null>(null)

  // Permanent Delete state
  const [profileToDelete, setProfileToDelete] = useState<{
    id: string
    name: string
    phone: string
    role: 'worker' | 'customer'
    statsHint?: string
  } | null>(null)
  const [isDeletingProfile, setIsDeletingProfile] = useState(false)
  const [deleteProfileError, setDeleteProfileError] = useState('')
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('')

  // Data states
  const [allWorkers, setAllWorkers] = useState<AdminWorkerRow[]>([])
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true)
  const [workerError, setWorkerError] = useState('')

  const [customers, setCustomers] = useState<AdminCustomerRow[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [customerError, setCustomerError] = useState('')

  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(true)
  const [bookingError, setBookingError] = useState('')

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState('')

  // Filter & Search states
  const [workerSearch, setWorkerSearch] = useState('')
  const [workerStatusFilter, setWorkerStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [customerSearch, setCustomerSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')

  // Document inspection state
  const [loadingSignedDoc, setLoadingSignedDoc] = useState(false)
  const [signedDocError, setSignedDocError] = useState('')

  const handleViewIdDocument = async (path: string) => {
    setLoadingSignedDoc(true)
    setSignedDocError('')
    try {
      const signedUrl = await getIdProofSignedUrl(path, 3600)
      if (!signedUrl) {
        throw new Error('Unable to generate secure signed link for this document.')
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setSignedDocError(err instanceof Error ? err.message : 'Failed to open document')
    } finally {
      setLoadingSignedDoc(false)
    }
  }

  const loadWorkersData = async () => {
    setIsLoadingWorkers(true)
    setWorkerError('')
    try {
      const data = await fetchAdminWorkers()
      setAllWorkers(data)
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : 'Unable to load workers')
      setAllWorkers([])
    } finally {
      setIsLoadingWorkers(false)
    }
  }

  const loadCustomersData = async () => {
    setIsLoadingCustomers(true)
    setCustomerError('')
    try {
      const data = await fetchAdminCustomers()
      setCustomers(data)
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : 'Unable to load customers')
      setCustomers([])
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const loadBookings = async () => {
    setIsLoadingBookings(true)
    setBookingError('')

    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer_id, worker_id, category_id, status, scheduled_at, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data ?? []) as Omit<AdminBooking, 'customerName' | 'workerName'>[]
      const profileIds = [...new Set(rows.flatMap(row => [row.customer_id, row.worker_id]))]
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds)

      if (profilesError) throw profilesError

      const names = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.full_name || 'Unnamed user']))
      setBookings(
        rows.map(row => ({
          ...row,
          customerName: names.get(row.customer_id) || 'Unknown customer',
          workerName: names.get(row.worker_id) || 'Unknown worker',
        }))
      )
    } catch (loadError) {
      setBookingError(loadError instanceof Error ? loadError.message : 'Unable to load bookings')
      setBookings([])
    } finally {
      setIsLoadingBookings(false)
    }
  }

  const loadStats = async () => {
    setIsLoadingStats(true)
    setStatsError('')

    try {
      const supabase = getSupabaseClient()
      const [workersResult, customersResult, bookingsResult, pendingResult] = await Promise.all([
        supabase.from('worker_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('worker_profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
      ])

      const failedResult = [workersResult, customersResult, bookingsResult, pendingResult].find(result => result.error)
      if (failedResult?.error) throw failedResult.error

      setStats({
        workers: workersResult.count ?? 0,
        customers: customersResult.count ?? 0,
        bookings: bookingsResult.count ?? 0,
        pendingApprovals: pendingResult.count ?? 0,
      })
    } catch (loadError) {
      setStatsError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard totals')
      setStats(null)
    } finally {
      setIsLoadingStats(false)
    }
  }

  const loadNotificationsData = async () => {
    setIsLoadingNotifications(true)
    setNotificationsError('')
    try {
      const data = await fetchAdminNotifications()
      setAdminNotifications(data)
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : 'Unable to load notifications')
      setAdminNotifications([])
    } finally {
      setIsLoadingNotifications(false)
    }
  }

  const markNotificationRead = async (id: string) => {
    try {
      const supabase = getSupabaseClient()
      await (supabase.from('notifications') as any)
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)

      setAdminNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    } catch (err) {
      console.warn('Error marking notification read:', err)
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      const supabase = getSupabaseClient()
      const unreadIds = adminNotifications.filter(n => !n.read_at).map(n => n.id)
      if (unreadIds.length === 0) return

      await (supabase.from('notifications') as any)
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)

      setAdminNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
    } catch (err) {
      console.warn('Error marking all notifications read:', err)
    }
  }

  const handleInspectWorkerFromNotification = (notif: AdminNotificationItem) => {
    const foundWorker = allWorkers.find(w => {
      if (!w.name) return false
      return (
        notif.body.toLowerCase().includes(w.name.toLowerCase()) ||
        notif.title.toLowerCase().includes(w.name.toLowerCase())
      )
    })

    if (foundWorker) {
      setInspectWorker(foundWorker)
    } else {
      setWorkerStatusFilter('pending')
      setActiveTab('workers')
      setSearchParams({ tab: 'workers' })
    }
  }

  const handleExecutePermanentDelete = async () => {
    if (!profileToDelete) return
    setIsDeletingProfile(true)
    setDeleteProfileError('')
    try {
      await deleteProfilePermanently(profileToDelete.id)
      const roleLabel = profileToDelete.role === 'worker' ? 'Worker' : 'Customer'
      setDeleteSuccessMessage(`Successfully deleted ${roleLabel} "${profileToDelete.name}" permanently.`)
      setTimeout(() => setDeleteSuccessMessage(''), 5000)

      if (inspectWorker?.id === profileToDelete.id) setInspectWorker(null)
      if (inspectCustomer?.id === profileToDelete.id) setInspectCustomer(null)
      setProfileToDelete(null)

      if (profileToDelete.role === 'worker') {
        await loadWorkersData()
      } else {
        await loadCustomersData()
      }
      loadStats()
      loadNotificationsData()
    } catch (err) {
      setDeleteProfileError(err instanceof Error ? err.message : 'Failed to permanently delete profile.')
    } finally {
      setIsDeletingProfile(false)
    }
  }

  const refreshAll = async () => {
    await Promise.all([
      loadWorkersData(),
      loadCustomersData(),
      loadBookings(),
      loadStats(),
      loadNotificationsData(),
    ])
  }

  useEffect(() => {
    if (isAdmin) {
      void refreshAll()
    }
  }, [isAdmin])

  // Computed lists
  const unreadNotifsCount = useMemo(
    () => adminNotifications.filter(n => !n.read_at).length,
    [adminNotifications]
  )

  const filteredNotifications = useMemo(() => {
    return adminNotifications.filter(n => {
      if (notificationFilter === 'unread') return !n.read_at
      if (notificationFilter === 'registrations')
        return n.notification_type === 'worker_registration_submitted'
      if (notificationFilter === 'documents')
        return n.notification_type === 'worker_document_uploaded'
      return true
    })
  }, [adminNotifications, notificationFilter])

  const pendingWorkers = useMemo(
    () => allWorkers.filter(w => w.approval_status === 'pending'),
    [allWorkers]
  )

  const filteredWorkers = useMemo(() => {
    return allWorkers.filter(w => {
      const matchesStatus =
        workerStatusFilter === 'all' || w.approval_status === workerStatusFilter
      const q = workerSearch.toLowerCase().trim()
      const matchesSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.phone.toLowerCase().includes(q) ||
        w.categories.some(c => c.toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [allWorkers, workerStatusFilter, workerSearch])

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim()
    if (!q) return customers
    return customers.filter(
      c => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    )
  }, [customers, customerSearch])

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.toLowerCase().trim()
    if (!q) return bookings
    return bookings.filter(
      b =>
        b.id.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.workerName.toLowerCase().includes(q) ||
        b.category_id.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q)
    )
  }, [bookings, bookingSearch])

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-semantic-bg-primary">
        <Card className="w-full max-w-md p-8 text-center bg-surface-100 border border-semantic-border-light">
          <Shield className="w-16 h-16 mx-auto text-semantic-text-tertiary mb-4" />
          <h2 className="text-xl font-semibold text-semantic-text-primary mb-2">Access Denied</h2>
          <p className="text-semantic-text-secondary">You need admin privileges to view this page</p>
        </Card>
      </div>
    )
  }

  const handleOpenActionModal = (worker: AdminWorkerRow, type: 'approve' | 'reject') => {
    setSelectedWorkerForAction(worker)
    setActionType(type)
    setRejectionReason('')
    setShowActionModal(true)
  }

  const confirmAction = async () => {
    if (!selectedWorkerForAction) return

    setIsSubmittingReview(true)
    setWorkerError('')

    try {
      const supabase = getSupabaseClient() as unknown as ReviewWorkerRpc
      const { error } = await supabase.rpc('review_worker', {
        target_worker_id: selectedWorkerForAction.id,
        decision: actionType === 'approve' ? 'approved' : 'rejected',
        decision_reason: actionType === 'reject' ? rejectionReason.trim() || 'Registration requires additional review.' : undefined,
      })

      if (error) throw new Error(error.message)

      setShowActionModal(false)
      setSelectedWorkerForAction(null)
      if (inspectWorker?.id === selectedWorkerForAction.id) {
        setInspectWorker(null)
      }
      await refreshAll()
    } catch (reviewError) {
      setWorkerError(reviewError instanceof Error ? reviewError.message : 'Unable to review worker')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Live sync of worker profile picture & document if updated in background
  useEffect(() => {
    if (!inspectWorker?.id) return
    const fetchFreshMedia = async () => {
      try {
        const supabase = getSupabaseClient()
        const [pRes, wpRes] = await Promise.all([
          (supabase.from('profiles') as any).select('avatar_url').eq('id', inspectWorker.id).maybeSingle(),
          (supabase.from('worker_profiles') as any).select('id_proof_url').eq('id', inspectWorker.id).maybeSingle(),
        ])
        const freshAvatar = pRes?.data?.avatar_url
        const freshIdProof = wpRes?.data?.id_proof_url
        if (freshAvatar !== inspectWorker.avatar_url || freshIdProof !== inspectWorker.id_proof_url) {
          setInspectWorker(prev => (prev ? {
            ...prev,
            avatar_url: freshAvatar !== undefined ? freshAvatar : prev.avatar_url,
            id_proof_url: freshIdProof !== undefined ? freshIdProof : prev.id_proof_url,
          } : null))
        }
      } catch (err) {
        console.warn('Could not refresh worker media:', err)
      }
    }
    void fetchFreshMedia()
  }, [inspectWorker?.id])

  return (
    <div className="min-h-screen bg-semantic-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-semantic-text-primary">{t('admin.dashboard')}</h1>
            <p className="text-semantic-text-secondary mt-1">Live management of workers, customers, and bookings</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            className="self-start sm:self-auto flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>

        {/* Global Errors */}
        {workerError && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {workerError}
          </div>
        )}
        {customerError && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {customerError}
          </div>
        )}
        {bookingError && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {bookingError}
          </div>
        )}
        {statsError && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {statsError}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-surface-100 border border-semantic-border-light">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-semantic-text-secondary">{t('admin.stats.totalWorkers')}</p>
                <p className="text-3xl font-bold text-semantic-text-primary mt-1">
                  {isLoadingStats ? '...' : stats?.workers ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-brand-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-surface-100 border border-semantic-border-light">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-semantic-text-secondary">{t('admin.stats.totalCustomers')}</p>
                <p className="text-3xl font-bold text-semantic-text-primary mt-1">
                  {isLoadingStats ? '...' : stats?.customers ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-surface-100 border border-semantic-border-light">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-semantic-text-secondary">{t('admin.stats.totalBookings')}</p>
                <p className="text-3xl font-bold text-semantic-text-primary mt-1">
                  {isLoadingStats ? '...' : stats?.bookings ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-surface-100 border border-semantic-border-light">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-semantic-text-secondary">{t('admin.stats.pendingApprovals')}</p>
                <p className="text-3xl font-bold text-semantic-text-primary mt-1">
                  {isLoadingStats ? '...' : stats?.pendingApprovals ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Action / Deletion Feedback Banner */}
        {deleteSuccessMessage && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{deleteSuccessMessage}</span>
            </div>
            <button
              onClick={() => setDeleteSuccessMessage('')}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-semantic-border-light">
          {[
            { key: 'overview', label: 'Overview', icon: Shield },
            {
              key: 'workers',
              label: t('admin.allWorkers', 'Workers'),
              icon: Truck,
              badge: pendingWorkers.length,
            },
            { key: 'customers', label: t('admin.allCustomers'), icon: Users },
            { key: 'bookings', label: t('admin.allBookings'), icon: Calendar },
            {
              key: 'notifications',
              label: t('admin.notifications', 'Notifications'),
              icon: Bell,
              badge: unreadNotifsCount > 0 ? unreadNotifsCount : undefined,
            },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any)
                setSearchParams({ tab: tab.key })
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-semantic-text-secondary hover:text-semantic-text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <Badge variant="danger" size="sm" className="ml-1">
                  {tab.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-6 bg-surface-100 border border-semantic-border-light">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-semantic-text-primary">Pending Worker Approvals</h3>
                <span className="text-xs text-semantic-text-tertiary">
                  {pendingWorkers.length} pending
                </span>
              </div>
              <div className="space-y-3">
                {isLoadingWorkers ? (
                  <p className="text-sm text-semantic-text-secondary">Loading pending workers...</p>
                ) : pendingWorkers.length === 0 ? (
                  <p className="text-sm text-semantic-text-secondary">No pending worker registrations.</p>
                ) : (
                  pendingWorkers.slice(0, 5).map(worker => (
                    <div
                      key={worker.id}
                      className="flex items-center justify-between p-3 bg-surface-200/60 border border-semantic-border-light rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={worker.name} src={worker.avatar_url || undefined} size="sm" />
                        <div>
                          <p className="font-medium text-semantic-text-primary">{worker.name}</p>
                          <p className="text-xs text-semantic-text-secondary">
                            {worker.categories.join(', ') || 'No category'} • {worker.experience_years} yrs exp
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectWorker(worker)}
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenActionModal(worker, 'approve')}
                          title="Approve"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleOpenActionModal(worker, 'reject')}
                          title="Reject"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6 bg-surface-100 border border-semantic-border-light">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-semantic-text-primary">Recent Bookings</h3>
                <span className="text-xs text-semantic-text-tertiary">{bookings.length} total</span>
              </div>
              <div className="space-y-3">
                {isLoadingBookings ? (
                  <p className="text-sm text-semantic-text-secondary">Loading bookings...</p>
                ) : bookings.length === 0 ? (
                  <p className="text-sm text-semantic-text-secondary">No bookings yet.</p>
                ) : (
                  bookings.slice(0, 5).map(booking => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-3 bg-surface-200/60 border border-semantic-border-light rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-500/10 rounded-lg flex items-center justify-center">
                          <Truck className="w-4 h-4 text-brand-400" />
                        </div>
                        <div>
                          <p className="font-medium text-semantic-text-primary">
                            {booking.customerName} → {booking.workerName}
                          </p>
                          <p className="text-xs text-semantic-text-secondary">
                            {booking.category_id} •{' '}
                            {booking.scheduled_at
                              ? new Date(booking.scheduled_at).toLocaleDateString('en-IN')
                              : 'Date not set'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          booking.status === 'completed'
                            ? 'success'
                            : booking.status === 'accepted' || booking.status === 'in_progress'
                            ? 'info'
                            : booking.status === 'pending'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {booking.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* 2. WORKERS TAB (100% Real Supabase Data) */}
        {activeTab === 'workers' && (
          <Card className="p-0 overflow-hidden bg-surface-100 border border-semantic-border-light">
            {/* Controls Bar */}
            <div className="p-4 border-b border-semantic-border-light flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-200/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-semantic-text-secondary uppercase">Filter:</span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setWorkerStatusFilter(status)}
                    className={`px-3 py-1 text-xs font-medium rounded-full capitalize transition-colors ${
                      workerStatusFilter === status
                        ? 'bg-brand-500 text-surface-950 font-bold'
                        : 'bg-surface-200 text-semantic-text-secondary hover:text-semantic-text-primary'
                    }`}
                  >
                    {status} (
                    {status === 'all'
                      ? allWorkers.length
                      : allWorkers.filter(w => w.approval_status === status).length}
                    )
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search worker by name or phone..."
                  value={workerSearch}
                  onChange={e => setWorkerSearch(e.target.value)}
                  className="w-full bg-surface-200 border border-semantic-border-light text-semantic-text-primary rounded-lg pl-9 pr-3 py-1.5 text-xs placeholder:text-semantic-text-tertiary focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Workers Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-200/90 border-b border-semantic-border-light">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Worker
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Experience
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Jobs
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-semantic-border-light">
                  {isLoadingWorkers ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-semantic-text-secondary">
                        Loading workers directory...
                      </td>
                    </tr>
                  ) : filteredWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-semantic-text-secondary">
                        No workers found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkers.map(worker => (
                      <tr
                        key={worker.id}
                        className={`hover:bg-surface-200/40 transition-colors ${
                          worker.approval_status === 'pending' ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={worker.name} src={worker.avatar_url || undefined} size="sm" />
                            <div>
                              <p className="font-medium text-semantic-text-primary">{worker.name}</p>
                              <p className="text-xs text-semantic-text-secondary">{worker.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary capitalize">
                          {worker.categories.join(', ') || 'None'}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary">
                          {worker.experience_years} yrs
                        </td>
                        <td className="px-6 py-4">
                          {worker.rating > 0 ? (
                            <div className="flex items-center gap-1 text-sm text-amber-400">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{worker.rating.toFixed(1)}</span>
                              <span className="text-xs text-semantic-text-tertiary">
                                ({worker.review_count})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-semantic-text-tertiary">New</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary">
                          {worker.completed_jobs}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              worker.approval_status === 'approved'
                                ? 'success'
                                : worker.approval_status === 'pending'
                                ? 'warning'
                                : 'danger'
                            }
                          >
                            {worker.approval_status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectWorker(worker)}
                              title="View dossier"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {worker.approval_status === 'pending' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenActionModal(worker, 'approve')}
                                  title="Approve"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleOpenActionModal(worker, 'reject')}
                                  title="Reject"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            {worker.approval_status === 'rejected' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenActionModal(worker, 'approve')}
                                className="text-xs text-emerald-400 border-emerald-500/30"
                              >
                                Re-approve
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setProfileToDelete({
                                  id: worker.id,
                                  name: worker.name,
                                  phone: worker.phone,
                                  role: 'worker',
                                  statsHint: `${worker.completed_jobs} completed jobs, ${worker.total_bookings} total bookings`,
                                })
                              }
                              title="Permanently Delete Worker"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 3. CUSTOMERS TAB (100% Real Supabase Data) */}
        {activeTab === 'customers' && (
          <Card className="p-0 overflow-hidden bg-surface-100 border border-semantic-border-light">
            {/* Search Bar */}
            <div className="p-4 border-b border-semantic-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-200/50">
              <span className="text-xs font-semibold text-semantic-text-secondary uppercase">
                All Registered Customers ({customers.length})
              </span>
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full bg-surface-200 border border-semantic-border-light text-semantic-text-primary rounded-lg pl-9 pr-3 py-1.5 text-xs placeholder:text-semantic-text-tertiary focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-200/90 border-b border-semantic-border-light">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Total Bookings
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-semantic-border-light">
                  {isLoadingCustomers ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-semantic-text-secondary">
                        Loading customers...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-semantic-text-secondary">
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(customer => (
                      <tr key={customer.id} className="hover:bg-surface-200/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={customer.name} src={customer.avatar_url || undefined} size="sm" />
                            <p className="font-medium text-semantic-text-primary">{customer.name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary">{customer.phone}</td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary">
                          <Badge variant="outline">{customer.total_bookings} bookings</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-emerald-400 font-medium">
                          {customer.completed_bookings}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-secondary">
                          {new Date(customer.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectCustomer(customer)}
                              title="View Bookings"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setProfileToDelete({
                                  id: customer.id,
                                  name: customer.name,
                                  phone: customer.phone,
                                  role: 'customer',
                                  statsHint: `${customer.total_bookings} bookings (${customer.completed_bookings} completed)`,
                                })
                              }
                              title="Permanently Delete Customer"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 4. BOOKINGS TAB (100% Real Supabase Data) */}
        {activeTab === 'bookings' && (
          <Card className="p-0 overflow-hidden bg-surface-100 border border-semantic-border-light">
            {/* Search Bar */}
            <div className="p-4 border-b border-semantic-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-200/50">
              <span className="text-xs font-semibold text-semantic-text-secondary uppercase">
                All Bookings ({bookings.length})
              </span>
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search by customer, worker, or service..."
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  className="w-full bg-surface-200 border border-semantic-border-light text-semantic-text-primary rounded-lg pl-9 pr-3 py-1.5 text-xs placeholder:text-semantic-text-tertiary focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-200/90 border-b border-semantic-border-light">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Booking ID
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Worker
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-semantic-border-light">
                  {isLoadingBookings ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-semantic-text-secondary">
                        Loading bookings...
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-semantic-text-secondary">
                        No bookings found.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map(booking => (
                      <tr key={booking.id} className="hover:bg-surface-200/40 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-brand-400">
                          #{booking.id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary">
                          {booking.customerName}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary">
                          {booking.workerName}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-primary capitalize">
                          {booking.category_id}
                        </td>
                        <td className="px-6 py-4 text-sm text-semantic-text-secondary">
                          {booking.scheduled_at
                            ? new Date(booking.scheduled_at).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Not scheduled'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              booking.status === 'completed'
                                ? 'success'
                                : booking.status === 'accepted' || booking.status === 'in_progress'
                                ? 'info'
                                : booking.status === 'pending'
                                ? 'warning'
                                : 'danger'
                            }
                          >
                            {booking.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 5. NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Header / Actions Card */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-semantic-text-primary">
                      {t('admin.notifications', 'Admin Notifications & Alerts')}
                    </h2>
                    {unreadNotifsCount > 0 && (
                      <Badge variant="danger" size="sm">
                        {unreadNotifsCount} {t('admin.filterUnread', 'Unread')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-semantic-text-secondary mt-1">
                    {t(
                      'admin.noNotificationsDesc',
                      'Real-time alerts for worker registrations, document submissions, and platform events.'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadNotificationsData}
                    disabled={isLoadingNotifications}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingNotifications ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={markAllNotificationsRead}
                    disabled={unreadNotifsCount === 0 || isLoadingNotifications}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {t('admin.markAllRead', 'Mark all read')}
                  </Button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-semantic-border-light">
                {[
                  {
                    key: 'all',
                    label: t('admin.allNotifications', 'All Notifications'),
                    count: adminNotifications.length,
                  },
                  {
                    key: 'registrations',
                    label: t('admin.filterRegistrations', 'Worker Registrations'),
                    count: adminNotifications.filter(
                      n => n.notification_type === 'worker_registration_submitted'
                    ).length,
                  },
                  {
                    key: 'documents',
                    label: t('admin.filterDocuments', 'ID Documents'),
                    count: adminNotifications.filter(
                      n => n.notification_type === 'worker_document_uploaded'
                    ).length,
                  },
                  {
                    key: 'unread',
                    label: t('admin.filterUnread', 'Unread'),
                    count: unreadNotifsCount,
                  },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setNotificationFilter(f.key as any)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      notificationFilter === f.key
                        ? 'bg-brand-500 text-surface-950 font-semibold shadow-sm'
                        : 'bg-surface-200 text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-300'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                        notificationFilter === f.key
                          ? 'bg-surface-950/20 text-surface-950 font-bold'
                          : 'bg-surface-300 text-semantic-text-tertiary'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Notifications List Card */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light">
              {isLoadingNotifications ? (
                <div className="py-12 text-center text-semantic-text-secondary">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-400 mb-3" />
                  <p className="text-sm">Loading admin notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-surface-200 rounded-full flex items-center justify-center text-semantic-text-tertiary">
                    <Bell className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-semantic-text-primary">
                    {t('admin.noNotifications', 'No notifications yet')}
                  </h3>
                  <p className="text-sm text-semantic-text-secondary max-w-sm mx-auto mt-1">
                    {t(
                      'admin.noNotificationsDesc',
                      'System alerts, worker registration requests, and document uploads will appear here.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map(notif => {
                    const isUnread = !notif.read_at
                    const isWorkerEvent =
                      notif.notification_type === 'worker_registration_submitted' ||
                      notif.notification_type === 'worker_document_uploaded'

                    return (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                          isUnread
                            ? 'bg-surface-200/80 border-brand-500/40 shadow-sm'
                            : 'bg-surface-200/40 border-semantic-border-light hover:bg-surface-200/60'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Type Icon */}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              notif.notification_type === 'worker_registration_submitted'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : notif.notification_type === 'worker_document_uploaded'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {notif.notification_type === 'worker_registration_submitted' && (
                              <UserCheck className="w-5 h-5" />
                            )}
                            {notif.notification_type === 'worker_document_uploaded' && (
                              <FileText className="w-5 h-5" />
                            )}
                            {![
                              'worker_registration_submitted',
                              'worker_document_uploaded',
                            ].includes(notif.notification_type) && (
                              <Bell className="w-5 h-5" />
                            )}
                          </div>

                          {/* Text content */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm text-semantic-text-primary">
                                {notif.title}
                              </h4>
                              {isUnread && (
                                <Badge
                                  variant="warning"
                                  className="text-[10px] px-1.5 py-0.2 uppercase font-bold tracking-wider"
                                >
                                  NEW
                                </Badge>
                              )}
                              <span className="text-xs text-semantic-text-tertiary">
                                {new Date(notif.created_at).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-semantic-text-secondary leading-relaxed">
                              {notif.body}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 pt-2 sm:pt-0">
                          {isWorkerEvent && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleInspectWorkerFromNotification(notif)}
                              className="text-xs flex items-center gap-1.5 shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {t('admin.reviewWorker', 'Review Worker')}
                            </Button>
                          )}

                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markNotificationRead(notif.id)}
                              title="Mark as read"
                              className="text-xs text-semantic-text-tertiary hover:text-semantic-text-primary p-2"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* WORKER INSPECTION DOSSIER MODAL */}
      <Modal
        isOpen={Boolean(inspectWorker)}
        onClose={() => setInspectWorker(null)}
        title="Worker Dossier"
        description="Detailed background & activity record"
        size="lg"
      >
        {inspectWorker && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-4 border-b border-semantic-border-light pb-4">
              <div className="relative group">
                <Avatar
                  name={inspectWorker.name}
                  src={inspectWorker.avatar_url || undefined}
                  size="xl"
                  className="w-20 h-20 rounded-2xl shadow-lg border-2 border-brand-500/40 ring-4 ring-brand-500/10 object-cover"
                />
                {inspectWorker.avatar_url && (
                  <button
                    type="button"
                    onClick={() => window.open(inspectWorker.avatar_url!, '_blank')}
                    title="View full image in new tab"
                    className="absolute inset-0 bg-surface-950/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-semantic-text-primary">{inspectWorker.name}</h3>
                  {inspectWorker.avatar_url && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0.5 flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      Photo Uploaded
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-semantic-text-secondary mt-0.5">{inspectWorker.phone}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant={
                      inspectWorker.approval_status === 'approved'
                        ? 'success'
                        : inspectWorker.approval_status === 'pending'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    Status: {inspectWorker.approval_status}
                  </Badge>
                  <Badge variant={inspectWorker.is_available ? 'success' : 'outline'} dot>
                    {inspectWorker.is_available ? 'Available' : 'Offline'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Experience</p>
                <p className="text-lg font-bold text-semantic-text-primary mt-0.5">
                  {inspectWorker.experience_years} yrs
                </p>
              </div>
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Rating</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">
                  ★ {inspectWorker.rating > 0 ? inspectWorker.rating.toFixed(1) : 'New'}
                </p>
              </div>
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Completed Jobs</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">
                  {inspectWorker.completed_jobs}
                </p>
              </div>
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Total Bookings</p>
                <p className="text-lg font-bold text-semantic-text-primary mt-0.5">
                  {inspectWorker.total_bookings}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                Service Categories
              </p>
              <div className="flex flex-wrap gap-2">
                {inspectWorker.categories.length > 0 ? (
                  inspectWorker.categories.map(cat => (
                    <Badge key={cat} variant="primary" className="capitalize">
                      {cat}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-semantic-text-tertiary">None assigned</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                Service Area Pincodes
              </p>
              <div className="flex flex-wrap gap-2">
                {inspectWorker.areas.length > 0 ? (
                  inspectWorker.areas.map(area => (
                    <Badge key={area} variant="outline">
                      <MapPin className="w-3 h-3 mr-1" />
                      {area}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-semantic-text-tertiary">None specified</span>
                )}
              </div>
            </div>

            {/* Worker Photo & Identification Documents Section */}
            <div>
              <p className="text-xs font-semibold text-semantic-text-secondary uppercase mb-2">
                Worker Photo & Identification Documents
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Worker Profile Photo Card */}
                <div className="p-3.5 bg-surface-200/60 rounded-xl border border-semantic-border-light flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {inspectWorker.avatar_url ? (
                      <div
                        className="relative group cursor-pointer flex-shrink-0"
                        onClick={() => window.open(inspectWorker.avatar_url!, '_blank')}
                        title="Click to view full photo"
                      >
                        <img
                          src={inspectWorker.avatar_url}
                          alt={inspectWorker.name}
                          className="w-16 h-16 rounded-xl object-cover border border-semantic-border-medium shadow-sm hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-surface-950/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-surface-300 border border-semantic-border-medium flex items-center justify-center text-semantic-text-tertiary flex-shrink-0">
                        <User className="w-8 h-8 opacity-40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-semantic-text-primary">Worker Profile Photo</p>
                        {inspectWorker.avatar_url ? (
                          <Badge variant="success" className="text-[10px] px-1 py-0.5">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 py-0.5 text-amber-400">Missing</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                        {inspectWorker.avatar_url
                          ? 'Public profile avatar from Supabase Storage'
                          : 'No profile photograph uploaded yet.'}
                      </p>
                    </div>
                  </div>

                  {inspectWorker.avatar_url && (
                    <div className="pt-2 border-t border-semantic-border-light/60 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(inspectWorker.avatar_url!, '_blank')}
                        className="text-xs flex items-center gap-1.5 text-brand-400 border-brand-500/30 hover:bg-brand-500/10"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Full Photo
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2. Government ID Verification Document Card */}
                <div className="p-3.5 bg-surface-200/60 rounded-xl border border-semantic-border-light flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 flex-shrink-0">
                      <IdCard className="w-8 h-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-semantic-text-primary">Government ID Proof</p>
                        {inspectWorker.id_proof_url ? (
                          <Badge variant="success" className="text-[10px] px-1 py-0.5">Attached</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 py-0.5 text-amber-400">Missing</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-semantic-text-tertiary mt-0.5 truncate">
                        {inspectWorker.id_proof_url ? inspectWorker.id_proof_url.split('/').pop() : 'No ID document attached.'}
                      </p>
                    </div>
                  </div>

                  {inspectWorker.id_proof_url && (
                    <div className="pt-2 border-t border-semantic-border-light/60 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={loadingSignedDoc}
                        onClick={() => handleViewIdDocument(inspectWorker.id_proof_url!)}
                        className="flex items-center gap-1.5 text-xs text-brand-400 border-brand-500/30 hover:bg-brand-500/10"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View ID Document
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {signedDocError && (
                <p className="mt-1 text-xs text-red-400">{signedDocError}</p>
              )}
            </div>

            {inspectWorker.bio && (
              <div>
                <p className="text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                  Worker Bio
                </p>
                <p className="text-sm text-semantic-text-secondary p-3 bg-surface-200/60 rounded-lg border border-semantic-border-light whitespace-pre-line">
                  {inspectWorker.bio}
                </p>
              </div>
            )}

            {inspectWorker.rejection_reason && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <p className="font-semibold text-xs uppercase mb-1">Rejection Note</p>
                <p>{inspectWorker.rejection_reason}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-semantic-border-light">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setInspectWorker(null)}>
                  Close
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const w = inspectWorker
                    setProfileToDelete({
                      id: w.id,
                      name: w.name,
                      phone: w.phone,
                      role: 'worker',
                      statsHint: `${w.completed_jobs} completed jobs, ${w.total_bookings} total bookings`,
                    })
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Worker
                </Button>
              </div>
              <div className="flex gap-2">
                {inspectWorker.approval_status !== 'approved' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const w = inspectWorker
                      setInspectWorker(null)
                      handleOpenActionModal(w, 'approve')
                    }}
                  >
                    Approve Worker
                  </Button>
                )}
                {inspectWorker.approval_status !== 'rejected' && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      const w = inspectWorker
                      setInspectWorker(null)
                      handleOpenActionModal(w, 'reject')
                    }}
                  >
                    Reject Worker
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CUSTOMER INSPECTION MODAL */}
      <Modal
        isOpen={Boolean(inspectCustomer)}
        onClose={() => setInspectCustomer(null)}
        title="Customer Record"
        description="Booking history & details"
        size="lg"
      >
        {inspectCustomer && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-4 border-b border-semantic-border-light pb-4">
              <Avatar name={inspectCustomer.name} src={inspectCustomer.avatar_url || undefined} size="lg" />
              <div>
                <h3 className="text-lg font-bold text-semantic-text-primary">{inspectCustomer.name}</h3>
                <p className="text-sm text-semantic-text-secondary">{inspectCustomer.phone}</p>
                <p className="text-xs text-semantic-text-tertiary mt-1">
                  Registered:{' '}
                  {new Date(inspectCustomer.created_at).toLocaleDateString('en-IN', {
                    dateStyle: 'long',
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Total Bookings</p>
                <p className="text-xl font-bold text-semantic-text-primary mt-0.5">
                  {inspectCustomer.total_bookings}
                </p>
              </div>
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Completed</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">
                  {inspectCustomer.completed_bookings}
                </p>
              </div>
              <div className="p-3 bg-surface-200/60 rounded-xl border border-semantic-border-light">
                <p className="text-xs text-semantic-text-tertiary">Active / In Progress</p>
                <p className="text-xl font-bold text-brand-400 mt-0.5">
                  {inspectCustomer.active_bookings}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-semantic-text-secondary uppercase mb-2">
                Booking History with Muzaffarnagar Kaamgar
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {bookings.filter(b => b.customer_id === inspectCustomer.id).length === 0 ? (
                  <p className="text-sm text-semantic-text-tertiary italic p-3 bg-surface-200/40 rounded-lg">
                    No bookings recorded for this customer yet.
                  </p>
                ) : (
                  bookings
                    .filter(b => b.customer_id === inspectCustomer.id)
                    .map(b => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 bg-surface-200/60 rounded-lg border border-semantic-border-light text-sm"
                      >
                        <div>
                          <p className="font-medium text-semantic-text-primary">
                            {b.category_id} with {b.workerName}
                          </p>
                          <p className="text-xs text-semantic-text-tertiary">
                            {b.scheduled_at
                              ? new Date(b.scheduled_at).toLocaleDateString('en-IN')
                              : 'No date'}
                          </p>
                        </div>
                        <Badge
                          variant={
                            b.status === 'completed'
                              ? 'success'
                              : b.status === 'accepted' || b.status === 'in_progress'
                              ? 'info'
                              : b.status === 'pending'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {b.status}
                        </Badge>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-semantic-border-light">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const c = inspectCustomer
                  setProfileToDelete({
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    role: 'customer',
                    statsHint: `${c.total_bookings} bookings (${c.completed_bookings} completed)`,
                  })
                }}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Customer
              </Button>
              <Button variant="secondary" onClick={() => setInspectCustomer(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* APPROVE / REJECT ACTION CONFIRMATION MODAL */}
      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false)
          setSelectedWorkerForAction(null)
        }}
        title={actionType === 'approve' ? 'Approve Worker Registration' : 'Reject Worker Registration'}
        description={
          actionType === 'approve'
            ? `Are you sure you want to approve ${selectedWorkerForAction?.name}? They will immediately appear in the public worker directory.`
            : `Please specify why ${selectedWorkerForAction?.name} is being rejected so they can correct their registration.`
        }
      >
        <div className="space-y-4 pt-2">
          {actionType === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-semantic-text-secondary mb-1">
                Reason for Rejection
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete ID verification, invalid phone number, or mismatched service area."
                rows={3}
                className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-3 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowActionModal(false)
                setSelectedWorkerForAction(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'primary' : 'danger'}
              onClick={confirmAction}
              loading={isSubmittingReview}
            >
              {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(profileToDelete)}
        onClose={() => {
          if (!isDeletingProfile) {
            setProfileToDelete(null)
            setDeleteProfileError('')
          }
        }}
        title={`Permanently Delete ${profileToDelete?.role === 'worker' ? 'Worker' : 'Customer'}?`}
        size="md"
      >
        {profileToDelete && (
          <div className="space-y-4 pt-2">
            {/* Warning Box */}
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong className="block text-rose-400 font-semibold mb-0.5">
                  Warning: Irreversible Deletion
                </strong>
                This action will permanently purge this account from the platform database. This action cannot be undone.
              </div>
            </div>

            {/* Target Account Summary */}
            <div className="p-3.5 bg-surface-200/60 border border-semantic-border-light rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-semantic-text-tertiary">Full Name:</span>
                <span className="font-semibold text-semantic-text-primary">{profileToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-semantic-text-tertiary">Phone Number:</span>
                <span className="font-semibold text-semantic-text-primary">{profileToDelete.phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-semantic-text-tertiary">Account Role:</span>
                <Badge variant={profileToDelete.role === 'worker' ? 'primary' : 'outline'} className="capitalize">
                  {profileToDelete.role}
                </Badge>
              </div>
              {profileToDelete.statsHint && (
                <div className="flex justify-between items-center pt-1.5 border-t border-semantic-border-light/40">
                  <span className="text-semantic-text-tertiary">History:</span>
                  <span className="text-semantic-text-secondary">{profileToDelete.statsHint}</span>
                </div>
              )}
            </div>

            {/* Scope of removal */}
            <div className="text-xs text-semantic-text-secondary space-y-1">
              <p className="font-medium text-semantic-text-primary">The following will be completely purged:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-semantic-text-tertiary">
                <li>Profile details & login authentication credentials</li>
                <li>All past and active booking requests and appointments</li>
                <li>All customer ratings, reviews, and feedback records</li>
                {profileToDelete.role === 'worker' && (
                  <li>Service categories, assigned areas, and ID documents</li>
                )}
              </ul>
            </div>

            {deleteProfileError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteProfileError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-semantic-border-light">
              <Button
                variant="secondary"
                onClick={() => {
                  setProfileToDelete(null)
                  setDeleteProfileError('')
                }}
                disabled={isDeletingProfile}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleExecutePermanentDelete}
                loading={isDeletingProfile}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Yes, Permanently Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

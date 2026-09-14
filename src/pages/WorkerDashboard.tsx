import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, Briefcase, Check, CheckCircle, Clock3, MapPin, Play, Power, RefreshCw, ShieldAlert, X, AlertCircle, Phone, MessageSquare } from 'lucide-react'
import { Badge, Button, Card, Skeleton, Avatar } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import ContactModal from '@/components/ContactModal'
import { formatPhoneDisplay, buildWorkerToCustomerWhatsAppMessage } from '@/utils/contact'

interface WorkerProfileRow {
  bio: string
  experience_years: number
  approval_status: 'pending' | 'approved' | 'rejected'
  is_available: boolean
  rejection_reason: string | null
}

interface WorkerBookingRow {
  id: string
  category_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
  scheduled_at: string
  address: string
  notes: string | null
  created_at: string
  customer_id: string
  customer?: {
    name: string
    phone?: string | null
    avatar?: string | null
  }
}

interface BookingUpdateQuery {
  eq(column: string, value: string): BookingUpdateQuery
  select(columns: string): BookingUpdateQuery
  maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
}

const statusContent = {
  pending: {
    title: 'Profile under review',
    description: 'Our team will verify your details before your profile becomes visible to customers.',
    icon: Clock3,
    tone: 'warning' as const,
  },
  approved: {
    title: 'Profile approved',
    description: 'Your profile is visible to customers in your selected service areas.',
    icon: CheckCircle,
    tone: 'success' as const,
  },
  rejected: {
    title: 'Profile needs changes',
    description: 'Please review the reason below and update your registration details.',
    icon: ShieldAlert,
    tone: 'danger' as const,
  },
}

export default function WorkerDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [profile, setProfile] = useState<WorkerProfileRow | null>(null)
  const [bookings, setBookings] = useState<WorkerBookingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingBookingId, setUpdatingBookingId] = useState('')
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false)
  const [availabilitySuccessMsg, setAvailabilitySuccessMsg] = useState('')

  // Contact modal state
  const [contactModalData, setContactModalData] = useState<{
    isOpen: boolean
    name: string
    phone?: string | null
    avatar?: string | null
    roleLabel: string
    whatsappMessage?: string
    bookingContext?: {
      category?: string
      scheduledAt?: string
      address?: string
    }
  }>({
    isOpen: false,
    name: '',
    roleLabel: 'Customer',
  })

  const handleOpenContactModal = (booking: WorkerBookingRow) => {
    const formattedDate = new Date(booking.scheduled_at).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const formattedTime = new Date(booking.scheduled_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const message = buildWorkerToCustomerWhatsAppMessage({
      customerName: booking.customer?.name,
      workerName: user?.name || 'your service professional',
      categoryName: booking.category_id,
      date: formattedDate,
      time: formattedTime,
    })

    setContactModalData({
      isOpen: true,
      name: booking.customer?.name || 'Customer',
      phone: booking.customer?.phone,
      avatar: booking.customer?.avatar,
      roleLabel: 'Customer',
      whatsappMessage: message,
      bookingContext: {
        category: booking.category_id,
        scheduledAt: `${formattedDate} at ${formattedTime}`,
        address: booking.address,
      },
    })
  }

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const workerId = authData.user?.id
      if (!workerId) throw new Error('Please sign in with the worker account that received this booking')

      const { data, error: queryError } = await supabase
        .from('worker_profiles')
        .select('bio, experience_years, approval_status, is_available, rejection_reason')
        .eq('id', workerId)
        .maybeSingle()

      if (queryError) throw queryError
      setProfile(data as WorkerProfileRow | null)

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, category_id, status, scheduled_at, address, notes, created_at, customer_id')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })

      if (bookingError) throw bookingError
      const rawBookings = (bookingData ?? []) as any[]

      const customerIds = [...new Set(rawBookings.map(b => b.customer_id))].filter(Boolean)
      let customerById = new Map<string, { name: string; phone?: string | null; avatar?: string | null }>()

      if (customerIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, avatar_url')
          .in('id', customerIds)

        if (!profError && profiles) {
          customerById = new Map(
            (profiles as any[]).map(p => [
              p.id,
              {
                name: p.full_name || 'Customer',
                phone: p.phone || null,
                avatar: p.avatar_url || null,
              },
            ])
          )
        }
      }

      setBookings(
        rawBookings.map(b => ({
          ...b,
          customer: customerById.get(b.customer_id) || { name: 'Customer', phone: null, avatar: null },
        }))
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load worker dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [user?.name])

  useEffect(() => {
    if (user?.id) void loadDashboardData()
    else setIsLoading(false)
  }, [loadDashboardData, user?.id])

  const updateBookingStatus = async (
    bookingId: string,
    status: 'accepted' | 'rejected' | 'in_progress' | 'completed'
  ) => {
    setUpdatingBookingId(bookingId)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const workerId = authData.user?.id
      if (!workerId) throw new Error('Please sign in with the worker account')

      // Attempt RPC update_booking_status first
      const { error: rpcError } = await (supabase as any).rpc('update_booking_status', {
        target_booking_id: bookingId,
        target_status: status,
      })

      if (rpcError) {
        // Fallback to direct table update if RPC is unavailable
        const { error: updateError } = await (supabase.from('bookings') as any)
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', bookingId)
          .eq('worker_id', workerId)

        if (updateError) throw updateError
      }

      setBookings(current => current.map(booking => booking.id === bookingId ? { ...booking, status } : booking))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update booking')
    } finally {
      setUpdatingBookingId('')
    }
  }

  const handleToggleAvailability = async () => {
    if (!profile) return
    const newStatus = !profile.is_available
    setIsUpdatingAvailability(true)
    setError('')
    setAvailabilitySuccessMsg('')

    try {
      const supabase = getSupabaseClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const workerId = authData.user?.id
      if (!workerId) throw new Error('Please sign in to manage availability')

      // 1. Try RPC update_worker_availability
      const { error: rpcError } = await (supabase as any).rpc('update_worker_availability', {
        target_available: newStatus,
      })

      if (rpcError) {
        // 2. Direct table update fallback
        const { error: directError } = await (supabase.from('worker_profiles') as any)
          .update({ is_available: newStatus, updated_at: new Date().toISOString() })
          .eq('id', workerId)

        if (directError) throw directError
      }

      setProfile(prev => (prev ? { ...prev, is_available: newStatus } : null))
      setAvailabilitySuccessMsg(
        newStatus
          ? 'You are now Online and ready to accept bookings!'
          : 'You are now Off-duty. Customers cannot book you until you go online again.'
      )
      setTimeout(() => setAvailabilitySuccessMsg(''), 5000)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update availability status')
    } finally {
      setIsUpdatingAvailability(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-semantic-bg-secondary">
        <div className="container-app py-10 space-y-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  const status = profile?.approval_status ?? 'pending'
  const content = statusContent[status]
  const StatusIcon = content.icon

  return (
    <div className="min-h-screen bg-semantic-bg-secondary">
      <div className="bg-semantic-bg-primary border-b border-semantic-border-light">
        <div className="container-app py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-semantic-text-secondary hover:text-semantic-text-primary text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>

      <main className="container-app py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <p className="text-sm text-brand-500 font-medium">Worker workspace</p>
            <h1 className="mt-2 text-3xl font-bold text-semantic-text-primary">Welcome, {user?.name}</h1>
            <p className="mt-2 text-semantic-text-secondary">Manage your worker profile and booking requests here.</p>
          </div>

          {error && <div className="p-4 rounded-lg border border-danger-200 bg-danger-50 text-danger-700">{error}</div>}

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
                <StatusIcon className="w-6 h-6 text-brand-600" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-semantic-text-primary">{content.title}</h2>
                  <Badge variant={content.tone}>{status}</Badge>
                </div>
                <p className="mt-2 text-semantic-text-secondary">{content.description}</p>
                {status === 'rejected' && profile?.rejection_reason && (
                  <p className="mt-3 text-sm text-danger-700">Reason: {profile.rejection_reason}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Interactive Availability Control Card */}
          <Card className={`p-6 border transition-all duration-200 ${
            profile?.is_available 
              ? 'border-emerald-500/40 bg-emerald-950/15 shadow-sm' 
              : 'border-amber-500/40 bg-amber-950/15 shadow-sm'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  profile?.is_available ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <Power className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-semantic-text-primary">
                      {t('workerDashboard.availability', 'Availability Status')}
                    </h2>
                    <Badge variant={profile?.is_available ? 'success' : 'warning'}>
                      {profile?.is_available ? t('workerDashboard.available', 'Available') : t('workerDashboard.unavailable', 'Unavailable')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-semantic-text-secondary">
                    {profile?.is_available 
                      ? t('workerDashboard.acceptingBookings', 'Accepting new bookings from customers in Muzaffarnagar.') 
                      : t('workerDashboard.notAcceptingBookings', 'Off-duty (Customers cannot book you right now).')}
                  </p>
                  {availabilitySuccessMsg && (
                    <div className="mt-2.5 text-sm text-emerald-400 flex items-center gap-1.5 font-medium animate-in fade-in">
                      <CheckCircle className="w-4 h-4" />
                      <span>{availabilitySuccessMsg}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:self-center">
                <Button
                  variant={profile?.is_available ? 'outline' : 'primary'}
                  size="md"
                  onClick={handleToggleAvailability}
                  disabled={isUpdatingAvailability || isLoading}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 ${
                    profile?.is_available 
                      ? 'border-semantic-border-medium hover:bg-surface-200 text-semantic-text-primary' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isUpdatingAvailability ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('workerDashboard.updatingAvailability', 'Updating...')}</span>
                    </>
                  ) : profile?.is_available ? (
                    <>
                      <Power className="w-4 h-4 text-amber-400" />
                      <span>{t('workerDashboard.toggleUnavailable', 'Go Off-Duty')}</span>
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 text-white" />
                      <span>{t('workerDashboard.toggleAvailable', 'Go Online')}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="p-5">
              <Briefcase className="w-5 h-5 text-brand-500" />
              <p className="mt-3 text-sm text-semantic-text-tertiary">Experience</p>
              <p className="mt-1 text-lg font-semibold text-semantic-text-primary">{profile?.experience_years ?? 0} years</p>
            </Card>
            <Card className="p-5">
              <MapPin className="w-5 h-5 text-brand-500" />
              <p className="mt-3 text-sm text-semantic-text-tertiary">Service area</p>
              <p className="mt-1 text-lg font-semibold text-semantic-text-primary">Muzaffarnagar</p>
            </Card>
            <Card className="p-5">
              <CheckCircle className={`w-5 h-5 ${profile?.is_available ? 'text-emerald-500' : 'text-amber-500'}`} />
              <p className="mt-3 text-sm text-semantic-text-tertiary">Current Mode</p>
              <p className="mt-1 text-lg font-semibold text-semantic-text-primary">
                {profile?.is_available ? 'Online (Active)' : 'Off-Duty (Paused)'}
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-semibold text-semantic-text-primary">Booking requests</h2>
                <p className="mt-1 text-sm text-semantic-text-secondary">Review requests assigned to you.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadDashboardData()}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Badge variant="warning">{bookings.filter(booking => booking.status === 'pending').length} pending</Badge>
              </div>
            </div>

            {bookings.length === 0 ? (
              <p className="py-8 text-center text-semantic-text-secondary">No booking requests yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => (
                  <div
                    key={booking.id}
                    className={`rounded-xl border p-5 ${
                      booking.status === 'in_progress'
                        ? 'border-blue-500/50 bg-blue-950/20 shadow-sm'
                        : booking.status === 'completed'
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : booking.status === 'accepted'
                        ? 'border-success-400/60 bg-success-900/15'
                        : booking.status === 'rejected'
                        ? 'border-danger-400/40 bg-danger-900/10'
                        : booking.status === 'cancelled'
                        ? 'border-semantic-border-light bg-surface-200/40 opacity-85'
                        : 'border-semantic-border-medium bg-surface-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-semantic-text-primary">{booking.category_id}</h3>
                          <Badge
                            size="lg"
                            variant={
                              booking.status === 'pending' ? 'warning' :
                              booking.status === 'accepted' ? 'brand' :
                              booking.status === 'in_progress' ? 'brand' :
                              booking.status === 'completed' ? 'success' :
                              booking.status === 'rejected' ? 'danger' :
                              booking.status === 'cancelled' ? 'default' : 'default'
                            }
                          >
                            {booking.status === 'accepted' ? 'Accepted' :
                             booking.status === 'in_progress' ? 'In Progress' :
                             booking.status === 'completed' ? 'Completed' :
                             booking.status === 'rejected' ? 'Rejected' :
                             booking.status === 'cancelled' ? 'Cancelled' : booking.status}
                          </Badge>
                        </div>
                        {booking.status === 'accepted' && (
                          <p className="mt-3 text-sm font-semibold text-brand-300">
                            Booking accepted. Click "Start Job" when you begin the service.
                          </p>
                        )}
                        {booking.status === 'in_progress' && (
                          <p className="mt-3 text-sm font-semibold text-blue-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            Work is currently in progress. Click "Complete Job" when finished.
                          </p>
                        )}
                        {booking.status === 'completed' && (
                          <p className="mt-3 text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4" />
                            Service completed successfully.
                          </p>
                        )}
                        {booking.status === 'rejected' && (
                          <p className="mt-3 text-sm font-semibold text-danger-400">This booking request was rejected.</p>
                        )}
                        {booking.status === 'cancelled' && (
                          <p className="mt-3 text-sm font-semibold text-semantic-text-secondary">This booking was cancelled by the customer.</p>
                        )}
                        <p className="mt-3 text-sm font-medium text-semantic-text-primary">
                          <span className="text-semantic-text-tertiary">Scheduled:</span>{' '}
                          {new Date(booking.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        <p className="mt-1 text-sm font-medium text-semantic-text-primary">
                          <span className="text-semantic-text-tertiary">Address:</span> {booking.address}
                        </p>
                        {booking.notes && <p className="mt-3 text-sm text-semantic-text-secondary"><span className="font-medium text-semantic-text-primary">Notes:</span> {booking.notes}</p>}

                        {/* Customer Information & Contact Actions */}
                        <div className="mt-4 p-3 rounded-xl bg-surface-200/80 border border-semantic-border-light flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={booking.customer?.name || 'Customer'} size="md" src={booking.customer?.avatar || undefined} />
                            <div>
                              <p className="text-xs text-semantic-text-secondary font-medium">Customer</p>
                              <p className="text-sm font-semibold text-semantic-text-primary">{booking.customer?.name || 'Customer'}</p>
                              {booking.customer?.phone ? (
                                <p className="text-xs font-mono text-brand-400">{formatPhoneDisplay(booking.customer.phone)}</p>
                              ) : (
                                <p className="text-xs text-semantic-text-tertiary">No phone registered</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenContactModal(booking)}
                              className="flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenContactModal(booking)}
                              className="flex items-center gap-1.5 text-brand-300 border-brand-500/30 hover:bg-brand-500/10 hover:border-brand-500/50"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {booking.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            loading={updatingBookingId === booking.id}
                            onClick={() => void updateBookingStatus(booking.id, 'accepted')}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={updatingBookingId === booking.id}
                            onClick={() => void updateBookingStatus(booking.id, 'rejected')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {booking.status === 'accepted' && (
                        <div>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={updatingBookingId === booking.id}
                            onClick={() => void updateBookingStatus(booking.id, 'in_progress')}
                            className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
                          >
                            <Play className="w-4 h-4" />
                            Start Job
                          </Button>
                        </div>
                      )}

                      {booking.status === 'in_progress' && (
                        <div>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={updatingBookingId === booking.id}
                            onClick={() => void updateBookingStatus(booking.id, 'completed')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Complete Job
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Customer Contact Modal */}
      <ContactModal
        isOpen={contactModalData.isOpen}
        onClose={() => setContactModalData(prev => ({ ...prev, isOpen: false }))}
        name={contactModalData.name}
        roleLabel={contactModalData.roleLabel}
        phone={contactModalData.phone}
        avatar={contactModalData.avatar}
        whatsappMessage={contactModalData.whatsappMessage}
        bookingContext={contactModalData.bookingContext}
      />
    </div>
  )
}

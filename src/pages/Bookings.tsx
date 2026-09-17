import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Avatar, Badge, RatingStars, Modal } from '@kaamgar/ui'
import { CATEGORIES, getCategoryName } from '@kaamgar/shared'
import { Calendar, Clock, MapPin, Star, Truck, CheckCircle, XCircle, AlertCircle, Loader2, MessageSquare, Phone, RefreshCw, Play, Shield, Bot, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAiAssistant } from '@/context/AiAssistantContext'
import { getSupabaseClient } from '@/lib/supabase'
import ContactModal from '@/components/ContactModal'
import { buildCustomerToWorkerWhatsAppMessage } from '@/utils/contact'
import { fetchCustomerReviewedBookingIds, submitBookingReview } from '@/services/reviews'

interface BookingRow {
  id: string
  worker_id: string
  category_id: string
  status: keyof typeof statusConfig
  scheduled_at: string
  address: string
  notes: string | null
  worker?: { name: string; avatar: string | null; phone?: string | null }
  hasReview?: boolean
}

interface WorkerDirectoryRow {
  id: string
  name: string
  avatar: string | null
  phone?: string | null
}

const statusConfig = {
  pending: { label: 'Pending', icon: Loader2, color: 'warning', bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  accepted: { label: 'Accepted', icon: CheckCircle, color: 'info', bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  in_progress: { label: 'In Progress', icon: Play, color: 'info', bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'success', bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'danger', bg: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'default', bg: 'bg-surface-200 text-semantic-text-secondary border border-semantic-border-light' },
  disputed: { label: 'Disputed', icon: AlertCircle, color: 'warning', bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
}

export default function Bookings() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { openAssistant } = useAiAssistant()
  const [allBookings, setAllBookings] = useState<BookingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancellingBooking, setCancellingBooking] = useState<BookingRow | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

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
    roleLabel: 'Service Professional',
  })

  const handleOpenContactModal = (booking: BookingRow) => {
    const cat = CATEGORIES.find(c => c.id === booking.category_id)
    const categoryName = cat ? getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en') : booking.category_id
    const formattedDate = formatDate(booking.scheduled_at)
    const formattedTime = formatTime(booking.scheduled_at)
    const message = buildCustomerToWorkerWhatsAppMessage({
      workerName: booking.worker?.name,
      categoryName,
      date: formattedDate,
      time: formattedTime,
      address: booking.address,
    })

    setContactModalData({
      isOpen: true,
      name: booking.worker?.name || 'Worker',
      phone: booking.worker?.phone,
      avatar: booking.worker?.avatar,
      roleLabel: t('bookings.serviceProfessional', 'Service Professional'),
      whatsappMessage: message,
      bookingContext: {
        category: categoryName,
        scheduledAt: `${formattedDate} at ${formattedTime}`,
        address: booking.address,
      },
    })
  }

  const loadBookings = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const supabase = getSupabaseClient()
      let customerId = user?.id
      if (!customerId) {
        const { data: authData } = await supabase.auth.getUser()
        customerId = authData?.user?.id
      }
      if (!customerId) throw new Error('Please sign in to view your bookings')

      const { data, error } = await supabase
        .from('bookings')
        .select('id, worker_id, category_id, status, scheduled_at, address, notes')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      const bookings = (data ?? []) as BookingRow[]
      const workerIds = [...new Set(bookings.map(booking => booking.worker_id))].filter(Boolean)
      let workerById = new Map<string, WorkerDirectoryRow>()

      if (workerIds.length > 0) {
        const [{ data: workers, error: workersError }, { data: profiles, error: profError }] = await Promise.all([
          supabase.from('approved_worker_directory').select('id, name, avatar').in('id', workerIds),
          supabase.from('profiles').select('id, full_name, phone, avatar_url').in('id', workerIds),
        ])

        if (!workersError && workers) {
          const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]))
          workerById = new Map(
            (workers as any[]).map(worker => {
              const prof = profileById.get(worker.id)
              return [
                worker.id,
                {
                  id: worker.id,
                  name: worker.name || prof?.full_name || 'Worker',
                  avatar: worker.avatar || prof?.avatar_url || null,
                  phone: prof?.phone || null,
                },
              ]
            })
          )
        }
      }

      const reviewedIds = await fetchCustomerReviewedBookingIds(customerId)

      setAllBookings(
        bookings.map(booking => ({
          ...booking,
          worker: workerById.get(booking.worker_id),
          hasReview: reviewedIds.has(booking.id),
        }))
      )
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load bookings')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  // Real-time updates when worker accepts, starts, or completes customer booking
  useEffect(() => {
    const customerId = user?.id
    if (!customerId) return

    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`customer-bookings-realtime-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          void loadBookings()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, loadBookings])
  
  const upcomingBookings = allBookings.filter(b => ['pending', 'accepted', 'in_progress'].includes(b.status))
  const pastBookings = allBookings.filter(b => ['completed', 'rejected', 'cancelled', 'disputed'].includes(b.status))
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  
  const handleReviewSubmit = async () => {
    if (!selectedBooking) return
    setIsSubmittingReview(true)
    setReviewError('')
    try {
      await submitBookingReview({
        bookingId: selectedBooking.id,
        workerId: selectedBooking.worker_id,
        rating: reviewRating,
        comment: reviewComment,
      })

      // Update local state: mark hasReview as true
      setAllBookings(current =>
        current.map(b => (b.id === selectedBooking.id ? { ...b, hasReview: true } : b))
      )

      setShowReviewModal(false)
      setSelectedBooking(null)
      setReviewRating(5)
      setReviewComment('')
      setActionSuccess('Thank you! Your review has been submitted successfully.')
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to submit review')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleOpenCancelModal = (booking: BookingRow) => {
    setCancellingBooking(booking)
    setCancellationReason('')
    setCancelError('')
    setShowCancelModal(true)
  }

  const handleCancelBooking = async () => {
    if (!cancellingBooking) return
    setIsCancelling(true)
    setCancelError('')
    try {
      const supabase = getSupabaseClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const customerId = authData.user?.id
      if (!customerId) throw new Error('Please sign in to cancel your booking')

      const reasonText = cancellationReason.trim()

      // 1. Try RPC cancel_booking
      const { error: rpcError } = await (supabase as any).rpc('cancel_booking', {
        target_booking_id: cancellingBooking.id,
        cancellation_reason: reasonText || undefined,
      })

      if (rpcError) {
        // 2. Fallback to direct table update if RPC is not yet loaded
        const updatedNotes = reasonText
          ? cancellingBooking.notes
            ? `${cancellingBooking.notes}\n[Cancelled by customer: ${reasonText}]`
            : `[Cancelled by customer: ${reasonText}]`
          : cancellingBooking.notes

        const { data: updatedBooking, error: updateError } = await (supabase.from('bookings') as any)
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
            notes: updatedNotes,
          })
          .eq('id', cancellingBooking.id)
          .eq('customer_id', customerId)
          .in('status', ['pending', 'accepted'])
          .select('id')
          .maybeSingle()

        if (updateError) throw updateError
        if (!updatedBooking) throw new Error('Booking could not be cancelled. It may have already been updated.')
      }

      // Update local state: change status to cancelled
      setAllBookings(current =>
        current.map(b => (b.id === cancellingBooking.id ? { ...b, status: 'cancelled' } : b))
      )
      setShowCancelModal(false)
      setCancellingBooking(null)
      setCancellationReason('')
      setActionSuccess(t('bookings.cancelSuccess'))
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Unable to cancel booking')
    } finally {
      setIsCancelling(false)
    }
  }
  
  const bookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings
  
  return (
    <div className="min-h-screen bg-semantic-bg-primary text-semantic-text-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-semantic-text-primary">{t('bookings.title')}</h1>
            <p className="text-semantic-text-secondary mt-1">{t('bookings.subtitle', 'Manage your service bookings')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadBookings()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>

        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {loadError && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-950/40 text-red-300">
            {loadError}
          </div>
        )}

        {isLoading && (
          <div className="py-12 text-center text-semantic-text-secondary">{t('bookings.loading', 'Loading bookings...')}</div>
        )}
        
        {/* 2 Customer AI Assistants Support Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-500/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner shrink-0">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  {i18n.language === 'hi' ? 'कामगार AI सहायता (24x7)' : 'Kaamgar AI Assistants (24x7)'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {i18n.language === 'hi' ? 'त्वरित सहायता' : 'Fast Support'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {i18n.language === 'hi'
                  ? 'कारीगर खोजने के लिए "बुकिंग मित्र" या शिकायत/देरी के लिए "समाधान मित्र" चुनें'
                  : 'Select an assistant for service recommendations or post-booking resolution'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => openAssistant('customer_booking')}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <span>🛠️</span>
              <span>{i18n.language === 'hi' ? 'बुकिंग मित्र' : 'Booking Mitra'}</span>
            </button>
            <button
              onClick={() => openAssistant('customer_care')}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>{i18n.language === 'hi' ? 'समाधान मित्र' : 'Care & Support'}</span>
            </button>
          </div>
        </div>

        {!isLoading && (
          <div className="flex gap-2 mb-6 bg-surface-200/80 border border-semantic-border-light rounded-xl p-1">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'upcoming' ? 'bg-surface-100 text-brand-400 font-semibold shadow-sm border border-semantic-border-medium' : 'text-semantic-text-secondary hover:text-semantic-text-primary'
              }`}
            >
              {t('bookings.upcoming')} ({upcomingBookings.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'past' ? 'bg-surface-100 text-brand-400 font-semibold shadow-sm border border-semantic-border-medium' : 'text-semantic-text-secondary hover:text-semantic-text-primary'
              }`}
            >
              {t('bookings.past')} ({pastBookings.length})
            </button>
          </div>
        )}
        
        {!isLoading && bookings.length === 0 ? (
          <div className="text-center py-16 bg-surface-100 border border-semantic-border-light rounded-2xl p-8">
            <Truck className="w-16 h-16 mx-auto text-semantic-text-tertiary mb-4" />
            <h3 className="text-lg font-medium text-semantic-text-primary mb-2">
              {activeTab === 'upcoming' ? t('bookings.noUpcoming') : t('bookings.noPast')}
            </h3>
            <p className="text-semantic-text-secondary mb-6">
              {activeTab === 'upcoming' 
                ? t('bookings.bookServicePrompt', 'Book a service to see upcoming appointments')
                : t('bookings.pastEmptyPrompt', 'Completed or cancelled bookings will appear here')}
            </p>
            <Link to="/search">
              <Button variant="primary">
                <Truck className="w-4 h-4 mr-2" />
                {t('common.searchWorkers') || 'Find Workers'}
              </Button>
            </Link>
          </div>
        ) : !isLoading && (
          <div className="space-y-4">
            {bookings.map(booking => {
              const config = statusConfig[booking.status as keyof typeof statusConfig] || statusConfig.pending
              const Icon = config.icon
              const cat = CATEGORIES.find(c => c.id === booking.category_id)
              const canCancel = booking.status === 'pending' || booking.status === 'accepted'
              
              return (
                <Card
                  key={booking.id}
                  className={`p-0 overflow-hidden bg-surface-100 border border-semantic-border-light ${
                    booking.status === 'in_progress'
                      ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/30'
                      : booking.status === 'accepted'
                      ? 'border-success-400/60'
                      : booking.status === 'completed'
                      ? 'border-emerald-500/40'
                      : ''
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar name={booking.worker?.name || 'Worker'} size="lg" src={booking.worker?.avatar || undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-semantic-text-primary truncate">{booking.worker?.name || 'Worker'}</h3>
                          <Badge variant={config.color as any} className="whitespace-nowrap text-sm px-3 py-1">
                            <Icon className="w-3 h-3 mr-1" />
                            {t(`booking.status.${booking.status === 'in_progress' ? 'inProgress' : booking.status}`, config.label)}
                          </Badge>
                        </div>

                        {booking.status === 'accepted' && (
                          <p className="mt-3 text-sm font-semibold text-success-300">{t('bookings.acceptedMsg', 'Your booking request was accepted by the worker.')}</p>
                        )}
                        {booking.status === 'in_progress' && (
                          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-sm font-medium">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span>{t('bookings.inProgressMsg', 'Worker has started the service. Job is currently in progress.')}</span>
                          </div>
                        )}
                        {booking.status === 'completed' && (
                          <p className="mt-3 text-sm font-semibold text-emerald-400">{t('bookings.completedMsg', 'Service has been completed successfully.')}</p>
                        )}
                        {booking.status === 'rejected' && (
                          <p className="mt-3 text-sm font-semibold text-danger-400">{t('bookings.rejectedMsg', 'This booking request was declined by the worker.')}</p>
                        )}
                        {booking.status === 'cancelled' && (
                          <p className="mt-3 text-sm font-semibold text-semantic-text-secondary">{t('bookings.cancelledByCustomer')}</p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-semantic-text-primary">
                          <span className="flex items-center gap-1 text-brand-300">
                            {cat ? getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en') : booking.category_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-semantic-text-tertiary" />
                            <span><span className="text-semantic-text-tertiary">{t('common.date')}:</span> {formatDate(booking.scheduled_at)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-semantic-text-tertiary" />
                            <span><span className="text-semantic-text-tertiary">{t('common.time')}:</span> {formatTime(booking.scheduled_at)}</span>
                          </span>
                        </div>
                        <div className="mt-2 flex items-start gap-2 text-sm font-medium text-semantic-text-primary">
                          <MapPin className="w-3.5 h-3.5 text-semantic-text-tertiary mt-0.5" />
                          <span><span className="text-semantic-text-tertiary">{t('common.address')}:</span> {booking.address}</span>
                        </div>
                      </div>
                    </div>
                    
                    {booking.notes && (
                      <div className="mt-4 p-3 bg-surface-200/60 border border-semantic-border-light rounded-lg">
                        <p className="text-sm text-semantic-text-secondary whitespace-pre-line">
                          <span className="font-medium text-semantic-text-primary">{t('common.notes')}:</span> {booking.notes}
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-5 pt-4 border-t border-semantic-border-light flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {(booking.status === 'accepted' || booking.status === 'in_progress' || booking.status === 'completed') && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenContactModal(booking)}
                              className="flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                            >
                              <Phone className="w-4 h-4" />
                              {t('common.call')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenContactModal(booking)}
                              className="flex items-center gap-1.5 text-brand-300 border-brand-500/30 hover:bg-brand-500/10 hover:border-brand-500/50"
                            >
                              <MessageSquare className="w-4 h-4" />
                              {t('common.whatsapp', 'WhatsApp')}
                            </Button>
                          </>
                        )}
                        
                        {booking.status === 'completed' && !booking.hasReview && (
                          <Button variant="primary" size="sm" onClick={() => { setSelectedBooking(booking); setShowReviewModal(true) }}>
                            <Star className="w-4 h-4 mr-1" />
                            {t('bookings.rateWorker')}
                          </Button>
                        )}
                        
                        {booking.status === 'completed' && booking.hasReview && (
                          <Badge variant="success" className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {t('bookings.reviewSubmitted')}
                          </Badge>
                        )}
                        
                        {booking.status === 'pending' && (
                          <span className="flex items-center gap-1 text-sm font-medium text-semantic-text-secondary">
                            <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                            {t('bookings.waitingForWorker', 'Waiting for worker response...')}
                          </span>
                        )}
                      </div>

                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCancelModal(booking)}
                          className="flex items-center gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                        >
                          <XCircle className="w-4 h-4" />
                          {t('bookings.cancelBooking')}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          if (!isCancelling) {
            setShowCancelModal(false)
            setCancellingBooking(null)
          }
        }}
        title={t('bookings.cancelConfirmTitle')}
        description={t('bookings.cancelConfirmDesc')}
        size="md"
      >
        <div className="space-y-4">
          {cancelError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {cancelError}
            </div>
          )}

          {cancellingBooking && (
            <div className="p-3.5 bg-surface-200/80 border border-semantic-border-light rounded-xl text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-semantic-text-primary">
                  {cancellingBooking.worker?.name || 'Worker'}
                </span>
                <Badge variant={cancellingBooking.status === 'pending' ? 'warning' : 'info'}>
                  {t(`booking.status.${cancellingBooking.status === 'in_progress' ? 'inProgress' : cancellingBooking.status}`, cancellingBooking.status)}
                </Badge>
              </div>
              <p className="text-xs text-semantic-text-secondary mt-1">
                {t('bookings.scheduled', 'Scheduled')} {formatDate(cancellingBooking.scheduled_at)} {t('common.at', 'at')} {formatTime(cancellingBooking.scheduled_at)}
              </p>
            </div>
          )}

          <div>
            <label className="label text-semantic-text-secondary mb-2 block">{t('bookings.cancelReasonPlaceholder')}</label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                { label: t('bookings.reasonChangePlans', 'Change of plans'), value: 'Change of plans' },
                { label: t('bookings.reasonFoundAnother', 'Found another service'), value: 'Found another service' },
                { label: t('bookings.reasonWrongDateTime', 'Wrong date/time selected'), value: 'Wrong date/time selected' },
                { label: t('bookings.reasonEmergency', 'Emergency'), value: 'Emergency' },
              ].map(quickReason => (
                <button
                  key={quickReason.value}
                  type="button"
                  onClick={() => setCancellationReason(quickReason.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    cancellationReason === quickReason.value
                      ? 'bg-brand-500/20 border-brand-500/50 text-brand-300 font-medium'
                      : 'bg-surface-200 border-semantic-border-light text-semantic-text-secondary hover:text-semantic-text-primary hover:border-semantic-border-medium'
                  }`}
                >
                  {quickReason.label}
                </button>
              ))}
            </div>
            <textarea
              value={cancellationReason}
              onChange={e => setCancellationReason(e.target.value)}
              placeholder={t('bookings.cancelReasonPlaceholder')}
              rows={3}
              className="input bg-surface-200 border-semantic-border-light text-semantic-text-primary placeholder:text-semantic-text-tertiary"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCancelModal(false)
                setCancellingBooking(null)
              }}
              disabled={isCancelling}
            >
              {t('bookings.keepBooking')}
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelBooking}
              loading={isCancelling}
            >
              {t('bookings.confirmCancel')}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Rate/Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => {
          if (!isSubmittingReview) {
            setShowReviewModal(false)
            setSelectedBooking(null)
            setReviewRating(5)
            setReviewComment('')
            setReviewError('')
          }
        }}
        title={t('review.title')}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-semantic-text-secondary">{t('review.title')} - {selectedBooking?.worker?.name}</p>
          
          {reviewError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {reviewError}
            </div>
          )}

          <div>
            <label className="label text-semantic-text-secondary">{t('review.title')}</label>
            <RatingStars
              rating={reviewRating}
              interactive
              onChange={setReviewRating}
              size="lg"
              showValue
            />
          </div>
          
          <div>
            <label className="label text-semantic-text-secondary">{t('review.placeholder')}</label>
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder={t('review.placeholder')}
              rows={4}
              className="input bg-surface-200 border-semantic-border-light text-semantic-text-primary placeholder:text-semantic-text-tertiary"
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              disabled={isSubmittingReview}
              onClick={() => {
                setShowReviewModal(false)
                setSelectedBooking(null)
                setReviewRating(5)
                setReviewComment('')
                setReviewError('')
              }}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={isSubmittingReview}
              onClick={handleReviewSubmit}
              className="flex-1"
            >
              {isSubmittingReview ? t('common.submitting', 'Submitting...') : t('review.submit')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Contact Actions Modal */}
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

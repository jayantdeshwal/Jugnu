import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES, formatJobReference, getCategoryName, JobId } from '@kaamgar/shared'
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle,
  Clock,
  Clock3,
  MapPin,
  Play,
  Power,
  RefreshCw,
  ShieldAlert,
  X,
  AlertCircle,
  Phone,
  MessageSquare,
  Star,
  Calendar,
  ClipboardList,
  Headphones,
  UserCheck,
  PhoneCall,
  MessageCircle,
  ChevronRight,
  Sparkles,
  Shield,
  Edit,
  Zap,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { Badge, Button, Card, Skeleton, Avatar, Modal } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { useAiAssistant } from '@/context/AiAssistantContext'
import { getSupabaseClient } from '@/lib/supabase'
import ContactModal from '@/components/ContactModal'
import { formatPhoneDisplay, buildWorkerToCustomerWhatsAppMessage } from '@/utils/contact'
import { BookingChangeRequest, BookingPaymentSummary, confirmCashReceivedByWorker, createBookingChangeRequest, fetchBookingChangeRequests, fetchBookingPaymentSummaries } from '@/services/changeRequests'
import { BookingQuoteRequest, fetchWorkerQuoteData, respondToBookingQuoteRequest, ServiceRequest } from '@/services/quotes'
import { buildGoogleMapsDirectionsUrl } from '@/utils/maps'

interface WorkerProfileRow {
  bio: string
  experience_years: number
  approval_status: 'pending' | 'approved' | 'rejected'
  is_available: boolean
  rejection_reason: string | null
  rating?: number
  review_count?: number
  service_areas: string[]
}

interface WorkerBookingRow {
  id: JobId
  category_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'payment_pending' | 'completed' | 'cancelled' | 'disputed'
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
  changeRequests?: BookingChangeRequest[]
  paymentSummary?: BookingPaymentSummary
}

type TabFilter = 'all' | 'pending' | 'active' | 'completed'

export default function WorkerDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { openAssistant } = useAiAssistant()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [profile, setProfile] = useState<WorkerProfileRow | null>(null)
  const [categoriesList, setCategoriesList] = useState<string[]>([])
  const [bookings, setBookings] = useState<WorkerBookingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingBookingId, setUpdatingBookingId] = useState('')
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false)
  const [availabilitySuccessMsg, setAvailabilitySuccessMsg] = useState('')
  const [changeRequestBooking, setChangeRequestBooking] = useState<WorkerBookingRow | null>(null)
  const [changeAmount, setChangeAmount] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [changeRequestError, setChangeRequestError] = useState('')
  const [isSubmittingChangeRequest, setIsSubmittingChangeRequest] = useState(false)
  const [quoteRequests, setQuoteRequests] = useState<BookingQuoteRequest[]>([])
  const [quoteServices, setQuoteServices] = useState<Map<string, ServiceRequest>>(new Map())
  const [quoteRequestToRespond, setQuoteRequestToRespond] = useState<BookingQuoteRequest | null>(null)
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteDetails, setQuoteDetails] = useState('')
  const [quoteError, setQuoteError] = useState('')
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false)
  const [paymentActionBookingId, setPaymentActionBookingId] = useState('')
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    const target = window.location.hash.slice(1)
    if (!target) return
    const timer = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => window.clearTimeout(timer)
  }, [])
  
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabFilter>(
    tabParam === 'leads' || tabParam === 'pending'
      ? 'pending'
      : tabParam === 'active'
      ? 'active'
      : tabParam === 'completed'
      ? 'completed'
      : 'all'
  )

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'leads' || tab === 'pending') {
      setActiveTab('pending')
    } else if (tab === 'active') {
      setActiveTab('active')
    } else if (tab === 'completed') {
      setActiveTab('completed')
    } else if (tab === 'all') {
      setActiveTab('all')
    }
  }, [searchParams])
  const [showSupportModal, setShowSupportModal] = useState(false)

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
    const formattedDate = new Date(booking.scheduled_at).toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const formattedTime = new Date(booking.scheduled_at).toLocaleTimeString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const cat = CATEGORIES.find(c => c.id === booking.category_id)
    const categoryName = cat ? getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en') : booking.category_id

    const message = buildWorkerToCustomerWhatsAppMessage({
      customerName: booking.customer?.name,
      workerName: user?.name || 'your service professional',
      categoryName,
      date: formattedDate,
      time: formattedTime,
    })

    setContactModalData({
      isOpen: true,
      name: booking.customer?.name || 'Customer',
      phone: booking.customer?.phone,
      avatar: booking.customer?.avatar,
      roleLabel: t('bookings.customer', 'Customer'),
      whatsappMessage: message,
      bookingContext: {
        category: categoryName,
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
      let workerId = user?.id
      if (!workerId) {
        const { data: authData } = await supabase.auth.getUser()
        workerId = authData?.user?.id
      }
      if (!workerId) throw new Error(t('workerDashboard.signInRequired', 'Please sign in to access your worker workspace'))

      // Fetch worker profile and categories
      const [wpRes, wcRes, bookingsRes, areasRes] = await Promise.all([
        (supabase.from('worker_profiles') as any)
          .select('bio, experience_years, approval_status, is_available, rejection_reason, rating, review_count')
          .eq('id', workerId)
          .maybeSingle(),
        (supabase.from('worker_categories') as any)
          .select('category_id')
          .eq('worker_id', workerId),
        (supabase.from('bookings') as any)
          .select('id, category_id, status, scheduled_at, address, notes, created_at, customer_id')
          .eq('worker_id', workerId)
          .order('created_at', { ascending: false }),
        (supabase.from('approved_worker_directory') as any)
          .select('areas')
          .eq('id', workerId)
          .maybeSingle(),
      ])

      if (wpRes.error) throw wpRes.error
      setProfile(wpRes.data ? {
        ...wpRes.data,
        service_areas: (areasRes.data?.areas ?? []).filter(Boolean),
      } as WorkerProfileRow : null)

      const userCats = (wcRes.data ?? []).map((c: any) => c.category_id).filter(Boolean)
      setCategoriesList(userCats)

      if (bookingsRes.error) throw bookingsRes.error
      const rawBookings = (bookingsRes.data ?? []) as any[]
      const changeRequests = await fetchBookingChangeRequests(rawBookings.map(booking => booking.id as JobId))
      let paymentSummaries: BookingPaymentSummary[] = []
      try {
        paymentSummaries = await fetchBookingPaymentSummaries(rawBookings.map(booking => booking.id as JobId))
      } catch (summaryError) {
        console.warn('Booking payment summary unavailable:', summaryError)
      }
      const summaryByBooking = new Map(paymentSummaries.map(summary => [summary.booking_id, summary]))
      const requestsByBooking = new Map<string, BookingChangeRequest[]>()
      changeRequests.forEach(request => {
        const existing = requestsByBooking.get(request.booking_id) ?? []
        existing.push(request)
        requestsByBooking.set(request.booking_id, existing)
      })

      // Fetch customer details
      const customerIds = [...new Set(rawBookings.map(b => b.customer_id))].filter(Boolean)
      let customerById = new Map<string, { name: string; phone?: string | null; avatar?: string | null }>()

      if (customerIds.length > 0) {
        const { data: profiles, error: profError } = await (supabase.from('profiles') as any)
          .select('id, full_name, phone, avatar_url')
          .in('id', customerIds)

        if (!profError && profiles) {
          customerById = new Map(
            (profiles as any[]).map(p => [
              p.id,
              {
                name: p.full_name || t('bookings.customer', 'Customer'),
                phone: p.phone,
                avatar: p.avatar_url,
              },
            ])
          )
        }
      }

      const completeBookings: WorkerBookingRow[] = rawBookings.map(b => ({
        ...b,
        customer: customerById.get(b.customer_id) || { name: t('bookings.customer', 'Customer') },
        changeRequests: requestsByBooking.get(b.id) ?? [],
        paymentSummary: summaryByBooking.get(b.id),
      }))

      setBookings(completeBookings)

      const quoteData = await fetchWorkerQuoteData(workerId)
      setQuoteRequests(quoteData.requests)
      setQuoteServices(new Map(quoteData.services.map(service => [service.id, service])))
    } catch (err) {
      console.warn('Dashboard load error:', err)
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message) : ''
      setError(message || t('workerDashboard.loadError', 'Unable to load your worker workspace'))
    } finally {
      setIsLoading(false)
    }
  }, [t, user?.id])

  const handleCreateChangeRequest = async () => {
    if (!changeRequestBooking) return
    const amount = Number(changeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setChangeRequestError(t('workerDashboard.additionalAmountError', 'Enter an additional amount greater than zero.'))
      return
    }
    if (!changeReason.trim()) {
      setChangeRequestError(t('workerDashboard.additionalReasonError', 'Enter a reason for the additional charge.'))
      return
    }

    setIsSubmittingChangeRequest(true)
    setChangeRequestError('')
    try {
      await createBookingChangeRequest({ bookingId: changeRequestBooking.id, amount, reason: changeReason })
      setChangeRequestBooking(null)
      setChangeAmount('')
      setChangeReason('')
      await loadDashboardData()
    } catch (err) {
      setChangeRequestError(err instanceof Error ? err.message : t('workerDashboard.changeRequestError', 'Unable to create the additional-charge request'))
    } finally {
      setIsSubmittingChangeRequest(false)
    }
  }

  const handleQuoteResponse = async (action: 'reject' | 'quote') => {
    if (!quoteRequestToRespond) return
    const amount = Number(quoteAmount)
    if (action === 'quote' && (!Number.isFinite(amount) || amount <= 0)) {
      setQuoteError(t('workerDashboard.quoteAmountError', 'Enter the quote amount submitted by you.'))
      return
    }
    setIsSubmittingQuote(true)
    setQuoteError('')
    try {
      await respondToBookingQuoteRequest({
        requestId: quoteRequestToRespond.id,
        action,
        amount: action === 'quote' ? amount : undefined,
        details: quoteDetails,
      })
      setQuoteRequestToRespond(null)
      setQuoteAmount('')
      setQuoteDetails('')
      await loadDashboardData()
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : t('workerDashboard.quoteResponseError', 'Unable to respond to quote request'))
    } finally {
      setIsSubmittingQuote(false)
    }
  }

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  // Real-time synchronization for worker jobs, status changes, and approvals
  useEffect(() => {
    const workerId = user?.id
    if (!workerId) return

    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`worker-dashboard-realtime-${workerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `worker_id=eq.${workerId}`,
        },
        () => {
          void loadDashboardData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_profiles',
          filter: `id=eq.${workerId}`,
        },
        () => {
          void loadDashboardData()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, loadDashboardData])

  const handleUpdateStatus = async (bookingId: string, status: WorkerBookingRow['status']) => {
    setUpdatingBookingId(bookingId)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { error: rpcError } = await (supabase as any).rpc('update_booking_status', {
        target_booking_id: bookingId,
        target_status: status,
      })

      if (rpcError) throw new Error(rpcError.message)

      setBookings(current =>
        current.map(booking => (booking.id === bookingId ? { ...booking, status } : booking))
      )
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('workerDashboard.updateBookingError', 'Unable to update booking'))
    } finally {
      setUpdatingBookingId('')
    }
  }

  const handleConfirmCashReceived = async (booking: WorkerBookingRow) => {
    setPaymentActionBookingId(booking.id)
    setPaymentError('')
    try {
      await confirmCashReceivedByWorker(booking.id)
      await loadDashboardData()
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : t('bookings.paymentActionFailed', 'Unable to update the payment. Please try again.'))
    } finally {
      setPaymentActionBookingId('')
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
      let workerId = user?.id
      if (!workerId) {
        const { data: authData } = await supabase.auth.getUser()
        workerId = authData?.user?.id
      }
      if (!workerId) throw new Error(t('workerDashboard.signInRequired', 'Please sign in to access your worker workspace'))

      const { error: rpcError } = await (supabase as any).rpc('update_worker_availability', {
        target_available: newStatus,
      })

      if (rpcError) {
        const { error: directError } = await (supabase.from('worker_profiles') as any)
          .update({ is_available: newStatus, updated_at: new Date().toISOString() })
          .eq('id', workerId)

        if (directError) throw directError
      }

      setProfile(prev => (prev ? { ...prev, is_available: newStatus } : null))
      setAvailabilitySuccessMsg(
        newStatus
          ? t('workerDashboard.onlineSuccess', 'You are now Online and ready to accept bookings!')
          : t('workerDashboard.offlineSuccess', 'You are now Off-Duty.')
      )
      setTimeout(() => setAvailabilitySuccessMsg(''), 4000)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : t('workerDashboard.availabilityError', 'Unable to update availability status'))
    } finally {
      setIsUpdatingAvailability(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    )
  }

  const approvalStatus = profile?.approval_status ?? 'pending'
  const isOnline = Boolean(profile?.is_available)
  const isLeadsTab = searchParams.get('tab') === 'leads'
  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const activeCount = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress' || b.status === 'payment_pending').length
  const completedCount = bookings.filter(b => b.status === 'completed').length

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'pending') return b.status === 'pending'
    if (activeTab === 'active') return b.status === 'accepted' || b.status === 'in_progress' || b.status === 'payment_pending'
    if (activeTab === 'completed') return b.status === 'completed'
    return true
  })

  const primaryCategoryObj = CATEGORIES.find(c => categoriesList.includes(c.id))
  const primaryCategoryName = primaryCategoryObj
    ? getCategoryName(primaryCategoryObj, i18n.language === 'hi' ? 'hi' : 'en')
    : t('workerDashboard.artisanSpecialist', 'Artisan Specialist')

  return (
    <div className="min-h-screen bg-semantic-bg-primary pb-24 text-semantic-text-primary">
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-5">
        {/* ===================================================================== */}
        {/* 1. TOP BAR WITH BACK BUTTON & AVAILABILITY STATUS PILL                */}
        {/* ===================================================================== */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-surface-100/90 hover:bg-surface-200 border border-semantic-border-light flex items-center justify-center text-semantic-text-primary transition-colors active:scale-95 shadow-sm"
            aria-label={t('common.back', 'Back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {isLeadsTab ? t('worker.newLeads', 'Incoming Leads') : t('nav.workerDashboard', 'Worker Workspace')}
          </span>

          {/* Quick Online / Offline Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 border border-semantic-border-light text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className={isOnline ? 'text-emerald-400' : 'text-amber-400'}>
              {isOnline ? t('workerDashboard.online', 'Online') : t('workerDashboard.offDuty', 'Off-Duty')}
            </span>
          </div>
        </div>

        {/* Notifications & Alerts */}
        {availabilitySuccessMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{availabilitySuccessMsg}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. WORKER IDENTITY HEADER (Exact layout of uc2.jpeg / Profile.tsx)    */}
        {/* ===================================================================== */}
        <div className={`mb-6 px-1 items-start justify-between gap-3 ${isLeadsTab ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex-1 min-w-0">
            {/* Status indicator tag */}
            <div className="flex items-center gap-1.5 mb-1.5">
              {approvalStatus === 'approved' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t('profile.verifiedWorker', 'Verified Partner')}</span>
                </span>
              ) : approvalStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <Clock3 className="w-3 h-3" />
                  <span>{t('workerDashboard.underReview', 'Under Review')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                  <AlertCircle className="w-3 h-3" />
                  <span>{t('workerDashboard.needsChanges', 'Needs Changes')}</span>
                </span>
              )}

              <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/30 capitalize">
                {primaryCategoryName}
              </span>
            </div>

            {/* Bold Worker Full Name */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {user?.name || t('workerDashboard.verifiedProfessional', 'Verified Professional')}
            </h1>

            {/* Trade details & experience */}
            <p className="text-xs text-semantic-text-secondary mt-0.5">
              {profile?.experience_years ? t('workerDashboard.yearsExperience', '{{count}} years experience', { count: profile.experience_years }) : t('workerDashboard.localProfessional', 'Local Professional')} • Muzaffarnagar
            </p>
          </div>

          {/* Top Right Action Button: Edit Profile */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="shrink-0 px-4 py-1.5 rounded-full border border-semantic-border-medium hover:border-brand-500 text-xs font-semibold text-semantic-text-primary hover:text-brand-400 transition-colors shadow-sm active:scale-95"
          >
            {t('common.edit', 'Edit Profile')}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 3. THREE QUICK ACTION TILES (Matching Profile.tsx & UC2)              */}
        {/* ===================================================================== */}
        <div className={`grid-cols-3 gap-2.5 sm:gap-3 mb-6 ${isLeadsTab ? 'hidden md:grid' : 'grid'}`}>
          {/* Tile 1: Availability Toggle */}
          <button
            type="button"
            onClick={handleToggleAvailability}
            disabled={isUpdatingAvailability}
            className={`
              p-3 sm:p-4 rounded-2xl border transition-all flex flex-col items-center justify-center text-center shadow-sm active:scale-95
              ${isOnline
                ? 'bg-emerald-950/20 border-emerald-500/40 hover:bg-emerald-950/30'
                : 'bg-surface-100 border-semantic-border-light hover:bg-surface-200'
              }
            `}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
              isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-200 text-amber-400'
            }`}>
              <Power className={`w-5 h-5 ${isOnline ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <span className={`text-xs font-bold leading-tight ${isOnline ? 'text-emerald-400' : 'text-slate-900 dark:text-zinc-200'}`}>
              {isOnline ? t('workerDashboard.onlineReady', 'Online (Ready)') : t('workerDashboard.offDuty', 'Off-Duty')}
            </span>
          </button>

          {/* Tile 2: Active Bookings */}
          <button
            type="button"
            onClick={() => setActiveTab(pendingCount > 0 ? 'pending' : 'active')}
            className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-brand-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-200 group-hover:bg-brand-500/15 flex items-center justify-center text-brand-400 mb-2 transition-colors relative">
              <ClipboardList className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-brand-400 leading-tight">
              {pendingCount > 0 ? t('workerDashboard.newRequests', '{{count}} new requests', { count: pendingCount }) : t('workerDashboard.jobRequests', 'Job Requests')}
            </span>
          </button>

          {/* Tile 3: Artisan Helpline */}
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-blue-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-200 group-hover:bg-blue-500/15 flex items-center justify-center text-blue-400 mb-2 transition-colors">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-200 group-hover:text-blue-500 dark:group-hover:text-blue-400 leading-tight">
              {t('workerDashboard.artisanHelpline', 'Artisan Helpline')}
            </span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 3.5 JUGNU SARATHI AI ASSISTANT CARD                                   */}
        {/* ===================================================================== */}
        <div className={`mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-surface-100 to-surface-100 border border-amber-500/30 shadow-md flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isLeadsTab ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner shrink-0">
              💼
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                  {i18n.language === 'hi' ? 'जुगनू सारथी AI (कारीगर साथी)' : 'Jugnu Sarathi AI (Artisan Coach)'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  24x7 AI
                </span>
              </div>
              <p className="text-[11px] text-semantic-text-secondary">
                {i18n.language === 'hi'
                  ? 'ग्राहक को व्हाट्सऐप मैसेज, अधिक काम पाने के तरीके और 0% कमीशन नियम जानें'
                  : 'WhatsApp reply templates, earning tips & zero-commission policy guide'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openAssistant('worker_sarathi')}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{i18n.language === 'hi' ? 'सारथी से पूछें' : 'Ask Sarathi AI'}</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 4. WORKER METRICS STRIP                                               */}
        {/* ===================================================================== */}
        <div className={`grid-cols-4 gap-2 mb-6 p-3 rounded-2xl bg-surface-100 border border-semantic-border-light text-center ${isLeadsTab ? 'hidden md:grid' : 'grid'}`}>
          <div>
            <p className="text-base font-extrabold text-emerald-400">{completedCount}</p>
            <p className="text-[10px] text-semantic-text-secondary mt-0.5">{t('workerDashboard.completed', 'Completed')}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {profile?.rating && profile.rating > 0 ? profile.rating.toFixed(1) : t('workerDashboard.noRatings', 'No ratings yet')}
              </span>
            </div>
            <p className="text-[10px] text-semantic-text-secondary mt-0.5">{t('workerDashboard.rating', 'Rating')}</p>
          </div>
          <div>
            <p className="text-base font-extrabold text-brand-400">{profile?.review_count ?? 0}</p>
            <p className="text-[10px] text-semantic-text-secondary mt-0.5">{t('workerDashboard.reviews', 'Reviews')}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-1">
              {profile?.service_areas?.length ? profile.service_areas.join(', ') : t('workerDashboard.noAreas', 'No areas listed')}
            </p>
            <p className="text-[10px] text-semantic-text-secondary mt-0.5">{t('workerDashboard.coverage', 'Coverage')}</p>
          </div>
        </div>

        {/* Divider line */}
        <div className={`border-t border-semantic-border-light/60 my-4 ${isLeadsTab ? 'hidden md:block' : 'block'}`} />

        {/* Dedicated Mobile Leads Header */}
        {isLeadsTab && (
          <div className="md:hidden mb-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Zap className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {t('workerDashboard.newLeads', 'New Job Leads')}
                </h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950">
                    {t('workerDashboard.newCount', '{{count}} new', { count: pendingCount })}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                {t('workerDashboard.leadsSubtitle', 'New customer service requests in Muzaffarnagar')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboardData()}
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PROVIDER QUOTE REQUESTS                                                */}
        {/* ===================================================================== */}
        {quoteRequests.length > 0 && (
          <section id="quote-requests" className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 scroll-mt-24">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                {t('workerDashboard.quoteRequests', 'Quote Requests')}
              </h3>
              <Badge variant="warning">{t('workerDashboard.pendingCount', '{{count}} pending', { count: quoteRequests.filter(request => request.status === 'pending').length })}</Badge>
            </div>
            <div className="space-y-3">
              {quoteRequests.filter(request => request.status === 'pending').map(request => {
                const service = quoteServices.get(request.service_request_id)
                return (
                  <div key={request.id} className="rounded-xl bg-white/70 dark:bg-zinc-900/50 border border-amber-500/20 p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{service ? getCategoryName(CATEGORIES.find(category => category.id === service.category_id) || CATEGORIES[0], i18n.language === 'hi' ? 'hi' : 'en') : t('workerDashboard.serviceRequest', 'Service request')}</p>
                        {service && <p className="text-xs text-semantic-text-secondary mt-1">{new Date(service.scheduled_for).toLocaleString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN')} · {service.pincode}</p>}
                        <p className="text-xs text-semantic-text-secondary mt-1">{t('workerDashboard.respondBy', 'Respond by')} {new Date(request.response_deadline_at).toLocaleString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN')}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setQuoteRequestToRespond(request); setQuoteError('') }}>
                          {t('workerDashboard.sendQuote', 'Send Quote')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => void (async () => { try { await respondToBookingQuoteRequest({ requestId: request.id, action: 'reject' }); await loadDashboardData() } catch (err) { setError(err instanceof Error ? err.message : t('workerDashboard.rejectQuoteError', 'Unable to reject quote request')) } })()}>
                          {t('workerDashboard.reject', 'Reject')}
                        </Button>
                      </div>
                    </div>
                    {service?.notes && (
                      <div className="mt-3 rounded-lg bg-surface-100/80 p-2.5">
                        <p className="text-[11px] font-semibold text-semantic-text-primary">{t('workerDashboard.problemDescription', 'Problem Description')}</p>
                        <p className="mt-1 text-xs text-semantic-text-secondary">{service.notes}</p>
                      </div>
                    )}
                    {service?.problem_image_url && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-semantic-text-primary mb-1.5">{t('workerDashboard.problemImage', 'Problem Image')}</p>
                        <a href={service.problem_image_url} target="_blank" rel="noreferrer">
                          <img src={service.problem_image_url} alt={t('workerDashboard.problemImage', 'Problem Image')} className="h-28 w-28 rounded-xl object-cover border border-semantic-border-light" />
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* 5. JOB REQUESTS FEED WITH CLEAN TABS                                  */}
        {/* ===================================================================== */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-400" />
              <span>{t('workerDashboard.customerJobRequests', 'Customer Job Requests')}</span>
            </h3>
            <button
              type="button"
              onClick={() => void loadDashboardData()}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('common.refresh', 'Refresh')}</span>
            </button>
          </div>

          {/* Filter Tab Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-surface-100 text-semantic-text-secondary hover:text-slate-900 dark:hover:text-white border border-semantic-border-light'
              }`}
            >
              {t('common.all', 'All')} ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-surface-100 text-semantic-text-secondary hover:text-slate-900 dark:hover:text-white border border-semantic-border-light'
              }`}
            >
              <span>{t('workerDashboard.pending', 'Pending')}</span>
              {pendingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 text-[10px] flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'active'
                  ? 'bg-blue-500 text-white font-bold'
                  : 'bg-surface-100 text-semantic-text-secondary hover:text-slate-900 dark:hover:text-white border border-semantic-border-light'
              }`}
            >
              {t('workerDashboard.activeInProgress', 'Active / In Progress')} ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'completed'
                  ? 'bg-emerald-500 text-white font-bold'
                  : 'bg-surface-100 text-semantic-text-secondary hover:text-slate-900 dark:hover:text-white border border-semantic-border-light'
              }`}
            >
              {t('workerDashboard.completed', 'Completed')} ({completedCount})
            </button>
          </div>
        </div>

        {/* Job Cards Feed */}
        <div className="space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface-100/60 border border-semantic-border-light text-center">
              <ClipboardList className="w-10 h-10 text-semantic-text-tertiary mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-semantic-text-primary">
                {t('workerDashboard.noBookingsCategory', 'No bookings in this category')}
              </p>
              <p className="text-xs text-semantic-text-secondary mt-1">
                {isOnline
                  ? t('workerDashboard.onlineEmpty', 'Your profile is online and visible to customers in Muzaffarnagar. New requests will appear here.')
                  : t('workerDashboard.offDutyEmpty', 'You are currently Off-Duty. Turn Online above to receive customer bookings.')}
              </p>
            </div>
          ) : (
            filteredBookings.map(booking => {
              const catObj = CATEGORIES.find(c => c.id === booking.category_id)
              const catName = catObj ? getCategoryName(catObj, i18n.language === 'hi' ? 'hi' : 'en') : booking.category_id

              const formattedDate = new Date(booking.scheduled_at).toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              const formattedTime = new Date(booking.scheduled_at).toLocaleTimeString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })

              const isUpdating = updatingBookingId === booking.id

              return (
                <div
                  key={booking.id}
                  id={`booking-${booking.id}`}
                  className="p-4 rounded-2xl bg-surface-100 border border-semantic-border-light shadow-sm hover:border-brand-500/30 transition-all space-y-3"
                >
                  {/* Top line: Customer name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs">
                        {booking.customer?.name ? booking.customer.name.charAt(0) : 'C'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {booking.customer?.name || t('bookings.customer', 'Customer')}
                        </p>
                        <p className="text-[10px] text-semantic-text-tertiary capitalize">
                          {catName} {t('workerDashboard.service', 'Service')}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-surface-200 text-semantic-text-secondary border border-semantic-border-light whitespace-nowrap">
                      {formatJobReference(booking.id)}
                    </span>

                    <Badge
                      variant={
                        booking.status === 'completed'
                          ? 'success'
                          : booking.status === 'in_progress' || booking.status === 'accepted'
                          ? 'info'
                          : booking.status === 'pending'
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {booking.status === 'in_progress'
                        ? t('workerDashboard.inProgress', 'In Progress')
                        : booking.status === 'payment_pending'
                        ? t('bookings.paymentPending', 'Payment Pending')
                        : booking.status === 'accepted'
                        ? t('workerDashboard.accepted', 'Accepted')
                        : booking.status}
                    </Badge>
                  </div>

                  {/* Scheduled time & Locality address */}
                  <div className="space-y-1 text-xs text-semantic-text-secondary bg-surface-200/50 p-2.5 rounded-xl border border-semantic-border-light/60">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                      <span>{formattedDate} at {formattedTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{booking.address || t('workerDashboard.muzaffarnagar', 'Muzaffarnagar')}</span>
                    </div>
                    {booking.notes && (
                      <p className="text-[11px] text-semantic-text-tertiary italic pt-1 border-t border-semantic-border-light/40">
                        "{booking.notes}"
                      </p>
                    )}
                  </div>

                  {/* Contact Customer Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenContactModal(booking)}
                      className="flex-1 text-xs flex items-center justify-center gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 py-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{t('workerDashboard.whatsappCall', 'WhatsApp / Call')}</span>
                    </Button>

                    {booking.customer?.phone && (
                      <a
                        href={`tel:${booking.customer.phone}`}
                        className="px-3 py-1.5 rounded-xl border border-semantic-border-medium hover:border-brand-500 text-xs font-semibold text-semantic-text-secondary hover:text-white transition-colors flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t('workerDashboard.call', 'Call')}</span>
                      </a>
                    )}
                  </div>

                  {buildGoogleMapsDirectionsUrl(booking.address) ? (
                    <a
                      href={buildGoogleMapsDirectionsUrl(booking.address) as string}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-xl border border-blue-500/40 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t('bookings.openInGoogleMaps', 'Open in Google Maps')}</span>
                    </a>
                  ) : (
                    <p className="text-xs text-semantic-text-tertiary">
                      {t('bookings.customerLocationUnavailable', 'Customer location is not available for this booking.')}
                    </p>
                  )}

                  {booking.paymentSummary?.has_initial_quote && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">{t('bookings.paymentSummary', 'Payment Summary')}</p>
                      <div className="mt-2 space-y-1 text-semantic-text-secondary">
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('bookings.initialServiceCharge', 'Initial service charge')}</span>
                          <span className="font-semibold text-slate-900 dark:text-zinc-200">₹{booking.paymentSummary.initial_quote_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('bookings.approvedAdditionalCharges', 'Approved additional charges')}</span>
                          <span className="font-semibold text-slate-900 dark:text-zinc-200">₹{booking.paymentSummary.approved_additional_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-emerald-500/20 pt-2 font-bold text-slate-900 dark:text-white">
                          <span>{booking.paymentSummary.is_final || booking.paymentSummary.is_frozen
                            ? t('bookings.finalPayableAmount', 'Final payable amount')
                            : t('bookings.currentPayableAmount', 'Current payable amount')}</span>
                          <span>₹{booking.paymentSummary.final_payable_amount.toFixed(2)}</span>
                        </div>
                      </div>
                      {booking.paymentSummary.pending_additional_count > 0 && (
                        <p className="mt-2 text-amber-700 dark:text-amber-300">{t('bookings.pendingAdditionalCharges', 'Additional charges are awaiting approval.')}</p>
                      )}
                      {booking.status === 'payment_pending' && booking.paymentSummary.pending_additional_count === 0 && (
                        <>
                          <p className="mt-2 text-amber-700 dark:text-amber-300">{t('bookings.paymentPendingMsg', 'Service is finished. Payment is pending.')}</p>
                          {booking.paymentSummary.payment_method === 'cash' && booking.paymentSummary.payment_status === 'pending' && (
                            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
                              <p className="text-amber-700 dark:text-amber-300">{t('bookings.customerCashConfirmed', 'Customer says the cash was paid.')}</p>
                              <Button
                                variant="primary"
                                size="sm"
                                className="mt-2"
                                loading={paymentActionBookingId === booking.id}
                                disabled={Boolean(paymentActionBookingId)}
                                onClick={() => void handleConfirmCashReceived(booking)}
                              >
                                {t('bookings.confirmCashReceived', 'Confirm Cash Received')}
                              </Button>
                            </div>
                          )}
                          {paymentError && paymentActionBookingId === '' && (
                            <p className="mt-2 text-rose-600 dark:text-rose-400">{paymentError}</p>
                          )}
                        </>
                      )}
                      {booking.paymentSummary.is_frozen && (
                        <p className="mt-1 font-semibold text-slate-600 dark:text-zinc-300">
                          {t('bookings.paymentStatus', 'Payment status')}: {t(`bookings.paymentStatuses.${booking.paymentSummary.payment_status ?? 'unpaid'}`, 'Unpaid')}
                        </p>
                      )}
                      {booking.status === 'completed' && booking.paymentSummary.payment_status === 'paid' && booking.paymentSummary.receipt_number && (
                        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-sm">
                          <p className="font-bold text-emerald-700 dark:text-emerald-300">{t('bookings.paymentPaid', 'Payment Paid')}</p>
                          <p className="mt-1">₹{booking.paymentSummary.final_payable_amount.toFixed(2)} · {t('bookings.paymentMethodCash', 'Cash')}</p>
                          <p className="mt-2 text-xs text-semantic-text-secondary">{t('bookings.serviceCategory', 'Service')}: {getCategoryName(CATEGORIES.find(c => c.id === booking.category_id), i18n.language === 'hi' ? 'hi' : 'en')}</p>
                          <p className="text-xs text-semantic-text-secondary">{t('bookings.customer', 'Customer')}: {booking.customer?.name || '—'}</p>
                          <p className="text-xs text-semantic-text-secondary">{t('bookings.paidAt', 'Paid at')}: {booking.paymentSummary.receipt_paid_at || booking.paymentSummary.paid_at ? new Date(booking.paymentSummary.receipt_paid_at || booking.paymentSummary.paid_at || '').toLocaleString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN') : '—'}</p>
                          <p className="mt-1 text-xs text-semantic-text-secondary">{t('bookings.receiptNumber', 'Receipt')}: {booking.paymentSummary.receipt_number}</p>
                          <p className="text-xs text-semantic-text-secondary">{t('bookings.jobId', 'Job ID')}: {formatJobReference(booking.id)}</p>
                        </div>
                      )}
                      {!booking.paymentSummary.is_final && booking.paymentSummary.pending_additional_count === 0 && booking.status !== 'completed' && booking.status !== 'payment_pending' && (
                        <p className="mt-2 text-semantic-text-tertiary">{t('bookings.finalAmountAfterCompletion', 'The final amount will be shown after the service is completed.')}</p>
                      )}
                    </div>
                  )}

                  {booking.changeRequests?.map(request => (
                    <div key={request.id} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{t('workerDashboard.additionalChargeRequest', 'Additional charge request')}</span>
                        <Badge variant={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                          {request.status === 'pending' ? t('workerDashboard.pendingCustomerApproval', 'Pending customer approval') : request.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-semantic-text-secondary">Job {formatJobReference(booking.id)} • ₹{request.amount.toFixed(2)}</p>
                      <p className="mt-1 text-semantic-text-secondary">Reason: {request.reason}</p>
                    </div>
                  ))}

                  {['accepted', 'in_progress'].includes(booking.status) && !(booking.changeRequests ?? []).some(request => request.status === 'pending') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChangeRequestBooking(booking)
                        setChangeAmount('')
                        setChangeReason('')
                        setChangeRequestError('')
                      }}
                      className="w-full text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    >
                      {t('workerDashboard.requestAdditionalCharge', 'Request Additional Charge')}
                    </Button>
                  )}

                  {/* Status Action Buttons */}
                  {booking.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-1 border-t border-semantic-border-light/40">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(booking.id, 'accepted')}
                        disabled={isUpdating}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 shadow-sm"
                      >
                        Accept Booking
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                        disabled={isUpdating}
                        className="flex-1 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 py-1.5"
                      >
                        Decline
                      </Button>
                    </div>
                  )}

                  {booking.status === 'accepted' && (
                    <div className="pt-1 border-t border-semantic-border-light/40">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(booking.id, 'in_progress')}
                        disabled={isUpdating}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{t('workerDashboard.startService', 'Start Service')}</span>
                      </Button>
                    </div>
                  )}

                  {booking.status === 'in_progress' && !(booking.changeRequests ?? []).some(request => request.status === 'pending') && (
                    <div className="pt-1 border-t border-semantic-border-light/40">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(booking.id, 'payment_pending')}
                        disabled={isUpdating}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('workerDashboard.serviceFinishedAwaitingPayment', 'Service Completed — Awaiting Payment')}</span>
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Contact Modal */}
      <ContactModal
        isOpen={contactModalData.isOpen}
        onClose={() => setContactModalData(prev => ({ ...prev, isOpen: false }))}
        name={contactModalData.name}
        phone={contactModalData.phone}
        avatar={contactModalData.avatar}
        roleLabel={contactModalData.roleLabel}
        whatsappMessage={contactModalData.whatsappMessage}
        bookingContext={contactModalData.bookingContext}
      />

      <Modal
        isOpen={Boolean(quoteRequestToRespond)}
        onClose={() => { if (!isSubmittingQuote) setQuoteRequestToRespond(null) }}
        title={t('workerDashboard.sendProviderQuote', 'Send Provider Quote')}
        description={t('workerDashboard.quoteDescriptionHint', 'Enter the amount and details you choose to offer. Jugnu does not calculate or suggest this amount.')}
      >
        <div className="space-y-4">
          {quoteError && <p className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500">{quoteError}</p>}
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
            {t('workerDashboard.estimatedAmount', 'Estimated Amount')}
            <input type="number" min="0.01" step="0.01" value={quoteAmount} onChange={event => setQuoteAmount(event.target.value)} className="mt-1.5 w-full rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none" placeholder={t('workerDashboard.amountPlaceholder', 'Enter your amount')} />
          </label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
            {t('workerDashboard.description', 'Description')}
            <textarea value={quoteDetails} onChange={event => setQuoteDetails(event.target.value)} rows={4} maxLength={2000} className="mt-1.5 w-full rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none" placeholder={t('workerDashboard.quoteDetailsPlaceholder', 'Explain what your quote includes')} />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={isSubmittingQuote} onClick={() => setQuoteRequestToRespond(null)}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" className="flex-1" loading={isSubmittingQuote} onClick={() => void handleQuoteResponse('quote')}>{t('workerDashboard.submitQuote', 'Submit Quote')}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(changeRequestBooking)}
        onClose={() => {
          if (!isSubmittingChangeRequest) setChangeRequestBooking(null)
        }}
        title={t('workerDashboard.requestAdditionalCharge', 'Request Additional Charge')}
        description={changeRequestBooking ? `${t('workerDashboard.job', 'Job')} ${formatJobReference(changeRequestBooking.id)} — ${t('workerDashboard.customerApprovalRequired', 'customer approval is required.')}` : undefined}
      >
        <div className="space-y-4">
          {changeRequestError && <p className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500">{changeRequestError}</p>}
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
            {t('workerDashboard.additionalAmount', 'Additional amount')}
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={changeAmount}
              onChange={event => setChangeAmount(event.target.value)}
              className="mt-1.5 w-full rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none"
              placeholder="0.00"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
            {t('workerDashboard.reason', 'Reason')}
            <textarea
              value={changeReason}
              onChange={event => setChangeReason(event.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1.5 w-full rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none"
              placeholder={t('workerDashboard.additionalReasonPlaceholder', 'Explain why this additional charge is needed')}
            />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={isSubmittingChangeRequest} onClick={() => setChangeRequestBooking(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" className="flex-1" loading={isSubmittingChangeRequest} onClick={() => void handleCreateChangeRequest()}>
              {t('workerDashboard.sendRequest', 'Send Request')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Artisan Helpline Modal */}
      <Modal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        title={t('workerDashboard.supportTitle', 'Artisan Support & Coordination')}
        description={t('workerDashboard.supportDescription', 'Connect with our administrator team for verification, payment queries, or assistance.')}
      >
        <div className="space-y-3 pt-2">
          <a
            href="https://api.whatsapp.com/send?phone=918077362606&text=Hello%20Admin%2C%20I%20am%20a%20registered%20Jugnu%20artisan%20and%20need%20assistance"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-300">
                  {t('workerDashboard.whatsappDesk', 'WhatsApp Artisan Desk')}
                </p>
                <p className="text-[11px] text-semantic-text-secondary">
                  {t('workerDashboard.directSupport', 'Direct support for Muzaffarnagar artisans')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </a>

          <a
            href="tel:+918077362606"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-200 border border-semantic-border-light hover:bg-surface-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-brand-300">
                  Call Helpline
                </p>
                <p className="text-[11px] text-semantic-text-secondary">
                  +91 8077362606
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-semantic-text-tertiary" />
          </a>
        </div>
      </Modal>
    </div>
  )
}

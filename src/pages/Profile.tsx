import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Button, Card, Avatar, Badge, Input, Modal } from '@kaamgar/ui'
import { CATEGORIES, MUZAFFARNAGAR_PINCODES, getCategoryName } from '@kaamgar/shared'
import {
  Star,
  Calendar,
  Phone,
  Edit,
  LogOut,
  Bell,
  Camera,
  CheckCircle,
  AlertCircle,
  Briefcase,
  Globe,
  MapPin,
  Clock,
  Shield,
  UploadCloud,
  Check,
  X,
  FileText,
  Lock,
  ChevronRight,
  UserCheck,
  Mail,
  Smartphone,
  ArrowLeft,
  Headphones,
  ClipboardList,
  Gift,
  Share2,
  HelpCircle,
  Info,
  PhoneCall,
  MessageCircle,
  Power,
  Sparkles,
  Bot,
} from 'lucide-react'
import { useAiAssistant } from '../context/AiAssistantContext'
import { getSupabaseClient } from '@/lib/supabase'
import { uploadAvatar, uploadIdProof, validateFile } from '@/services/storage'
import { triggerPWAInstall } from '@/components/PWAInstallPrompt'

interface LiveWorkerDetails {
  bio: string
  experience_years: number
  approval_status: 'pending' | 'approved' | 'rejected'
  is_available: boolean
  rating: number
  review_count: number
  rejection_reason: string | null
  categories: string[]
  areas: string[]
  completedJobsCount: number
  id_proof_url: string | null
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, updateUser, updateEmail, logout, isWorker, isAdmin, isLoading: authLoading } = useAuth()
  const { language, setLanguage, toggleLanguage } = useLanguage()
  const { openAssistant } = useAiAssistant()

  const [editMode, setEditMode] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')
  const [saveErrorMsg, setSaveErrorMsg] = useState('')

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailModalInput, setEmailModalInput] = useState('')
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [emailModalError, setEmailModalError] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    language: (user?.language || language || 'en') as 'en' | 'hi',
    avatar_url: user?.avatar_url || '',
    bio: '',
    experience_years: 0,
    category: '',
    areas: [] as string[],
    is_available: true,
    id_proof_url: '',
  })

  const [workerDetails, setWorkerDetails] = useState<LiveWorkerDetails | null>(null)
  const [completedBookingsCount, setCompletedBookingsCount] = useState(0)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState('')

  // ID proof upload
  const idProofInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingIdProof, setIsUploadingIdProof] = useState(false)
  const [idProofUploadError, setIdProofUploadError] = useState('')

  const loadProfileData = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingProfile(false)
      return
    }

    setIsLoadingProfile(true)
    setSaveErrorMsg('')

    try {
      const supabase = getSupabaseClient()

      // 1. Fetch user profile row
      const { data: profileRow } = await (supabase.from('profiles') as any)
        .select('full_name, phone, email, language, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      // 2. If worker, fetch worker details
      let workerInfo: LiveWorkerDetails | null = null
      if (user.role === 'worker' || isWorker) {
        const [wpResult, wcResult, wsaResult, bookingsResult] = await Promise.all([
          (supabase.from('worker_profiles') as any)
            .select('bio, experience_years, approval_status, is_available, rating, review_count, rejection_reason, id_proof_url')
            .eq('id', user.id)
            .maybeSingle(),
          (supabase.from('worker_categories') as any)
            .select('category_id')
            .eq('worker_id', user.id),
          (supabase.from('worker_service_areas') as any)
            .select('service_areas(pincode)')
            .eq('worker_id', user.id),
          (supabase.from('bookings') as any)
            .select('id, status')
            .eq('worker_id', user.id),
        ])

        const wp = wpResult?.data
        const completedCount = (bookingsResult?.data ?? []).filter((b: any) => b.status === 'completed').length
        setCompletedBookingsCount(completedCount)
        const userCategories = (wcResult?.data ?? []).map((c: any) => c.category_id).filter(Boolean)
        const userAreas = (wsaResult?.data ?? [])
          .map((a: any) => a.service_areas?.pincode)
          .filter(Boolean)

        workerInfo = {
          bio: wp?.bio || '',
          experience_years: Number(wp?.experience_years ?? 0),
          approval_status: wp?.approval_status || 'pending',
          is_available: Boolean(wp?.is_available ?? true),
          rating: Number(wp?.rating ?? 0),
          review_count: Number(wp?.review_count ?? 0),
          rejection_reason: wp?.rejection_reason || null,
          categories: userCategories,
          areas: userAreas,
          completedJobsCount: completedCount,
          id_proof_url: wp?.id_proof_url || null,
        }
      } else {
        // Customer completed bookings
        const { data: custBookings } = await (supabase.from('bookings') as any)
          .select('id, status')
          .eq('customer_id', user.id)
        const completedCount = (custBookings ?? []).filter((b: any) => b.status === 'completed').length
        setCompletedBookingsCount(completedCount)
      }

      setWorkerDetails(workerInfo)
      setFormData({
        name: profileRow?.full_name || user.name || '',
        phone: profileRow?.phone || user.phone || '',
        email: profileRow?.email || user.email || '',
        language: (profileRow?.language || user.language || language || 'en') as 'en' | 'hi',
        avatar_url: profileRow?.avatar_url || user.avatar_url || '',
        bio: workerInfo?.bio || '',
        experience_years: workerInfo?.experience_years || 0,
        category: workerInfo?.categories?.[0] || '',
        areas: workerInfo?.areas || [],
        is_available: workerInfo?.is_available ?? true,
        id_proof_url: workerInfo?.id_proof_url || '',
      })
    } catch (err) {
      console.warn('Error loading profile data:', err)
    } finally {
      setIsLoadingProfile(false)
    }
  }, [user?.id, user?.name, user?.phone, user?.email, user?.language, user?.avatar_url, user?.role, isWorker, language])

  useEffect(() => {
    void loadProfileData()
  }, [loadProfileData])

  // Direct toggle availability for worker
  const handleToggleAvailability = async () => {
    if (!user?.id || !workerDetails) return
    const newStatus = !workerDetails.is_available
    try {
      const supabase = getSupabaseClient()
      const { error } = await (supabase.from('worker_profiles') as any)
        .update({ is_available: newStatus, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (error) throw error
      setWorkerDetails(prev => (prev ? { ...prev, is_available: newStatus } : null))
      setFormData(prev => ({ ...prev, is_available: newStatus }))
      setSaveSuccessMsg(
        newStatus
          ? (language === 'hi' ? 'अब आप काम के लिए उपलब्ध हैं' : 'You are now marked as Available for jobs')
          : (language === 'hi' ? 'अब आप ऑफ़लाइन हैं' : 'You are now marked as Offline')
      )
      setTimeout(() => setSaveSuccessMsg(''), 3500)
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Failed to update availability')
      setTimeout(() => setSaveErrorMsg(''), 4000)
    }
  }

  // Avatar upload
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setAvatarUploadError('')
    const validation = validateFile(file, { maxSizeMb: 5 })
    if (!validation.valid) {
      setAvatarUploadError(validation.error || 'Invalid photo format')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const publicUrl = await uploadAvatar(file, user.id)
      setFormData(prev => ({ ...prev, avatar_url: publicUrl }))

      const supabase = getSupabaseClient()
      const { error } = await (supabase.from('profiles') as any)
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (error) throw error
      updateUser({ avatar_url: publicUrl })
      setSaveSuccessMsg(t('profile.avatarUpdated', 'Profile photo updated!'))
      setTimeout(() => setSaveSuccessMsg(''), 3500)
    } catch (err) {
      setAvatarUploadError(err instanceof Error ? err.message : 'Unable to upload photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // ID proof upload
  const handleIdProofFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setIdProofUploadError('')
    const validation = validateFile(file, {
      maxSizeMb: 10,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    })
    if (!validation.valid) {
      setIdProofUploadError(validation.error || 'Invalid document file')
      return
    }

    setIsUploadingIdProof(true)
    try {
      const filePath = await uploadIdProof(file, user.id)
      setFormData(prev => ({ ...prev, id_proof_url: filePath }))

      const supabase = getSupabaseClient()
      const { error } = await (supabase.from('worker_profiles') as any)
        .update({ id_proof_url: filePath, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (error) throw error
      setWorkerDetails(prev => (prev ? { ...prev, id_proof_url: filePath } : null))
      setSaveSuccessMsg(t('profile.idUploaded', 'ID proof document uploaded securely'))
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    } catch (err) {
      setIdProofUploadError(err instanceof Error ? err.message : 'Unable to upload document')
    } finally {
      setIsUploadingIdProof(false)
    }
  }

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user?.id) return

    setIsSaving(true)
    setSaveErrorMsg('')
    setSaveSuccessMsg('')

    try {
      const supabase = getSupabaseClient()
      const trimmedName = formData.name.trim()
      const trimmedPhone = formData.phone.trim()

      if (!trimmedName) {
        throw new Error(t('errors.required', 'Name cannot be empty'))
      }

      // Update profiles
      const { error: profileError } = await (supabase.from('profiles') as any)
        .update({
          full_name: trimmedName,
          phone: trimmedPhone || null,
          email: formData.email?.trim() || null,
          language: formData.language,
          avatar_url: formData.avatar_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Update worker details if worker
      if (user.role === 'worker' || isWorker) {
        const { error: workerError } = await (supabase.from('worker_profiles') as any)
          .update({
            bio: formData.bio.trim(),
            experience_years: Number(formData.experience_years),
            is_available: formData.is_available,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (workerError) throw workerError

        if (formData.category) {
          await (supabase.from('worker_categories') as any).delete().eq('worker_id', user.id)
          await (supabase.from('worker_categories') as any).insert({
            worker_id: user.id,
            category_id: formData.category,
          })
        }

        if (formData.areas.length > 0) {
          const { data: areaRows } = await (supabase.from('service_areas') as any)
            .select('id, pincode')
            .in('pincode', formData.areas)

          if (areaRows && areaRows.length > 0) {
            await (supabase.from('worker_service_areas') as any).delete().eq('worker_id', user.id)
            await (supabase.from('worker_service_areas') as any).insert(
              areaRows.map((ar: any) => ({
                worker_id: user.id,
                service_area_id: ar.id,
              }))
            )
          }
        }
      }

      updateUser({
        name: trimmedName,
        phone: trimmedPhone,
        email: formData.email?.trim() || null,
        language: formData.language,
        avatar_url: formData.avatar_url,
      })

      if (formData.language !== language) {
        setLanguage(formData.language)
        void i18n.changeLanguage(formData.language)
      }

      setEditMode(false)
      setSaveSuccessMsg(t('profile.saveSuccess', 'Profile updated successfully!'))
      setTimeout(() => setSaveSuccessMsg(''), 4000)
      await loadProfileData()
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  // Native share / WhatsApp referral
  const handleShareApp = () => {
    const shareText = language === 'hi'
      ? 'मुजफ्फरनगर कामगार: बिना किसी कमीशन के सीधे मुजफ्फरनगर के सत्यापित इलेक्ट्रीशियन, प्लंबर व एसी कारीगर बुक करें! देखें: https://muzaffarnagar-kaamgar.in'
      : 'Muzaffarnagar Kaamgar: Hire verified local Electricians, Plumbers, Cleaning & AC technicians with 0% commission! Visit: https://muzaffarnagar-kaamgar.in'

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Muzaffarnagar Kaamgar',
        text: shareText,
        url: window.location.origin,
      }).catch(() => {})
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank')
    }
  }

  if (authLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    )
  }

  const isProfileComplete = Boolean(formData.name && formData.phone)
  const userDisplayName = formData.name || (user?.role === 'worker' ? 'Verified Kaamgar' : 'Verified Customer')
  const userDisplayPhone = formData.phone
    ? (formData.phone.startsWith('+91') ? formData.phone : `+91 ${formData.phone}`)
    : 'No phone number set'

  return (
    <div className="min-h-screen bg-semantic-bg-primary pb-24 text-semantic-text-primary">
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-5">
        {/* ===================================================================== */}
        {/* 1. TOP BAR WITH BACK BUTTON (Matching uc2.jpeg)                        */}
        {/* ===================================================================== */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-surface-100/90 hover:bg-surface-200 border border-semantic-border-light flex items-center justify-center text-semantic-text-primary transition-colors active:scale-95 shadow-sm"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-semantic-text-primary uppercase tracking-wider">
            {t('profile.title', 'My Account')}
          </span>

          <div className="w-10" />
        </div>

        {/* Notifications & Alerts */}
        {saveSuccessMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {saveErrorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. PROFILE IDENTITY HEADER (Exact layout of uc2.jpeg)                  */}
        {/* ===================================================================== */}
        <div className="mb-6 px-1 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Status indicator tag */}
            <div className="flex items-center gap-1.5 mb-1.5">
              {!isProfileComplete ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                  <AlertCircle className="w-3 h-3" />
                  <span>{t('profile.incompleteProfile', 'Incomplete profile')}</span>
                </span>
              ) : isWorker ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t('profile.verifiedWorker', 'Verified Kaamgar')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t('profile.verifiedCustomer', 'Verified Customer')}</span>
                </span>
              )}

              {isAdmin && (
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                  ADMIN
                </span>
              )}
            </div>

            {/* Bold User Name */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
              {userDisplayName}
            </h1>

            {/* User Phone */}
            <p className="text-xs sm:text-sm text-semantic-text-secondary mt-0.5">
              {userDisplayPhone}
            </p>
          </div>

          {/* Top Right Action Button (Complete / Edit Profile pill) */}
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="shrink-0 px-4 py-1.5 rounded-full border border-semantic-border-medium hover:border-brand-500 text-xs font-semibold text-semantic-text-primary hover:text-brand-400 transition-colors shadow-sm active:scale-95"
          >
            {!isProfileComplete ? t('profile.completeProfile', 'Complete') : t('profile.editProfile', 'Edit')}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 3. THREE QUICK ACTION CARDS ROW (Exact 3-card layout of uc2.jpeg)     */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-6">
          {isAdmin ? (
            <>
              {/* Admin Card 1: Admin Dashboard */}
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-rose-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-400 mb-2 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-semantic-text-primary group-hover:text-rose-400 leading-tight">
                  Admin Dashboard
                </span>
              </button>

              {/* Admin Card 2: Worker Approvals */}
              <button
                type="button"
                onClick={() => navigate('/admin?tab=workers')}
                className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-amber-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-semantic-text-primary group-hover:text-amber-400 leading-tight">
                  Worker Approvals
                </span>
              </button>

              {/* Admin Card 3: Platform Alerts */}
              <button
                type="button"
                onClick={() => navigate('/admin?tab=notifications')}
                className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-brand-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400 mb-2 group-hover:scale-105 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-semantic-text-primary group-hover:text-brand-400 leading-tight">
                  Platform Alerts
                </span>
              </button>
            </>
          ) : (
            <>
              {/* Card 1: My Bookings */}
              <button
                type="button"
                onClick={() => navigate('/bookings')}
                className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-brand-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-200 group-hover:bg-brand-500/15 flex items-center justify-center text-brand-400 mb-2 transition-colors">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-semantic-text-primary group-hover:text-brand-400 leading-tight">
                  {t('profile.myBookings', 'My bookings')}
                </span>
              </button>

              {/* Card 2: Worker Mode / Become a Worker */}
              {isWorker ? (
                <button
                  type="button"
                  onClick={handleToggleAvailability}
                  className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-emerald-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 mb-2">
                    <Power className={`w-5 h-5 ${workerDetails?.is_available ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
                  </div>
                  <span className="text-xs font-bold text-semantic-text-primary leading-tight">
                    {workerDetails?.is_available ? 'Online / Ready' : 'Offline'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/register/worker')}
                  className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-emerald-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 mb-2">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-semantic-text-primary group-hover:text-emerald-400 leading-tight">
                    {t('profile.becomeWorker', 'Earn with Kaamgar')}
                  </span>
                </button>
              )}

              {/* Card 3: Help & Support (AI Assistant) */}
              <button
                type="button"
                onClick={() => openAssistant(isWorker ? 'worker_sarathi' : 'customer_care')}
                className="p-3 sm:p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-blue-500/40 hover:bg-surface-200/80 transition-all flex flex-col items-center justify-center text-center group shadow-sm active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-200 group-hover:bg-blue-500/15 flex items-center justify-center text-blue-400 mb-2 transition-colors">
                  <Bot className="w-5 h-5 text-brand-400" />
                </div>
                <span className="text-xs font-bold text-semantic-text-primary group-hover:text-brand-400 leading-tight">
                  {isWorker ? 'सारथी AI' : t('profile.helpSupport', 'AI Support')}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Divider line */}
        <div className="border-t border-semantic-border-light/60 my-4" />

        {/* ===================================================================== */}
        {/* 4. CLEAN MENU ROWS LIST                                               */}
        {/* ===================================================================== */}
        <div className="space-y-1">
          {isAdmin ? (
            /* Admin Specific Menu Rows */
            <>
              <div
                onClick={() => navigate('/admin')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Shield className="w-5 h-5 text-rose-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-rose-400">
                    Admin Management Portal
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div
                onClick={() => navigate('/admin?tab=workers')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <UserCheck className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    Pending Worker ID Approvals
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div
                onClick={() => navigate('/admin?tab=notifications')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Bell className="w-5 h-5 text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    Platform Notifications & Alerts
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div
                onClick={() => setShowAddressModal(true)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <MapPin className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    Service Localities (251001 & 251002)
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div
                onClick={() => {
                  setEmailModalInput(formData.email || user?.email || '')
                  setEmailModalError('')
                  setShowEmailModal(true)
                }}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Mail className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    Admin Email & Security
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-semantic-text-tertiary truncate max-w-[130px]">
                    {formData.email || 'Add Email'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              <div
                onClick={toggleLanguage}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Globe className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {language === 'en' ? 'App Language' : 'ऐप की भाषा'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm" className="font-semibold text-brand-400 border-brand-500/30">
                    {language === 'en' ? 'English' : 'हिंदी'}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              <div
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-red-500/10 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <LogOut className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    {t('nav.logout', 'Log out')}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400/60 group-hover:translate-x-0.5 transition-all" />
              </div>
            </>
          ) : (
            /* Customer & Worker Menu Rows */
            <>
              {/* Row: My Bookings / Orders */}
              <div
                onClick={() => navigate('/bookings')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Calendar className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {t('profile.myBookings', 'My bookings')}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Row: Worker Dashboard (Worker only) */}
              {isWorker && (
                <div
                  onClick={() => navigate('/worker/dashboard')}
                  className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3.5">
                    <Briefcase className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-medium text-semantic-text-primary group-hover:text-emerald-400">
                      {t('nav.workerDashboard', 'Worker Dashboard')}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              )}

              {/* Row: My Rating & Reviews */}
              <div
                onClick={() => navigate('/bookings')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Star className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {t('profile.reviewsRatings', 'My rating & reviews')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {workerDetails && workerDetails.rating > 0 && (
                    <span className="text-xs font-bold text-amber-400">
                      ★ {workerDetails.rating.toFixed(1)}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Row: Manage Addresses & Localities */}
              <div
                onClick={() => setShowAddressModal(true)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <MapPin className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {t('profile.manageAddresses', 'Manage addresses & localities')}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-semantic-text-tertiary">
                  <span>Muzaffarnagar</span>
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Row: Email & Notifications */}
              <div
                onClick={() => {
                  setEmailModalInput(formData.email || user?.email || '')
                  setEmailModalError('')
                  setShowEmailModal(true)
                }}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Mail className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {t('profile.emailReceipts', 'Email & notifications')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-semantic-text-tertiary truncate max-w-[130px]">
                    {formData.email || 'Add Email'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Row: App Language Toggle */}
              <div
                onClick={toggleLanguage}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Globe className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {language === 'en' ? 'App Language' : 'ऐप की भाषा'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm" className="font-semibold text-brand-400 border-brand-500/30">
                    {language === 'en' ? 'English' : 'हिंदी'}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Row: Dedicated PWA Install Button (Strictly in Profile section as instructed) */}
              <div
                onClick={() => triggerPWAInstall()}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Smartphone className="w-5 h-5 text-brand-400" />
                  <span className="text-sm font-medium text-brand-400 font-semibold">
                    {t('pwa.installApp', 'Install Mobile App')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-brand-500/15 text-brand-300 font-bold px-2 py-0.5 rounded-full border border-brand-500/30">
                    Fast & Offline
                  </span>
                  <ChevronRight className="w-4 h-4 text-brand-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Row: Help Center & AI Assistant */}
              <div
                onClick={() => openAssistant(isWorker ? 'worker_sarathi' : 'customer_care')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <HelpCircle className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {t('profile.faqsHelp', 'Help Center & FAQs')}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Row: About Kaamgar */}
              <div
                onClick={() => navigate('/')}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Info className="w-5 h-5 text-semantic-text-secondary group-hover:text-brand-400" />
                  <span className="text-sm font-medium text-semantic-text-primary group-hover:text-brand-400">
                    {t('profile.aboutApp', 'About Muzaffarnagar Kaamgar')}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Row: Log Out */}
              <div
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-red-500/10 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <LogOut className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    {t('nav.logout', 'Log out')}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400/60 group-hover:translate-x-0.5 transition-all" />
              </div>
            </>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 5. REFER & SHARE CARD AT BOTTOM (Hidden for Admin)                     */}
        {/* ===================================================================== */}
        {!isAdmin && (
          <>
            <div className="border-t border-semantic-border-light/60 my-6" />
            <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-950/40 via-surface-100 to-brand-500/10 border border-purple-500/30 flex items-center justify-between gap-4 shadow-xl">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-white mb-1">
                  {t('profile.referTitle', 'Share Kaamgar & Earn Goodwill')}
                </h3>
                <p className="text-xs text-semantic-text-secondary leading-relaxed mb-3">
                  {t('profile.referDesc', 'Help your friends and family find verified local electricians, plumbers, and technicians without middlemen.')}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleShareApp}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-1.5 shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{t('profile.referNow', 'Refer now')}</span>
                </Button>
              </div>

              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
                <Gift className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 6. EDIT PROFILE MODAL / DRAWER (Clean focused form)                   */}
      {/* ===================================================================== */}
      <Modal
        isOpen={editMode}
        onClose={() => setEditMode(false)}
        title={t('profile.editProfile', 'Edit Profile Details')}
        description="Update your personal details, contact information, and preferences."
      >
        <div className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto px-1">
          {/* Avatar Photo Upload */}
          <div className="flex items-center gap-4 p-3 bg-surface-200/50 rounded-2xl border border-semantic-border-light">
            <div className="relative">
              <Avatar
                name={formData.name}
                src={formData.avatar_url || undefined}
                size="lg"
                className="shadow-sm"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-1 -right-1 p-1.5 bg-brand-500 text-surface-950 rounded-full shadow hover:bg-brand-400"
                title="Change photo"
              >
                {isUploadingAvatar ? (
                  <UploadCloud className="w-3.5 h-3.5 animate-bounce" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />
            </div>
            <div>
              <p className="text-xs font-bold text-semantic-text-primary">Profile Photo</p>
              <p className="text-[11px] text-semantic-text-tertiary">PNG, JPG or WebP (Max 5MB)</p>
            </div>
          </div>

          {avatarUploadError && (
            <p className="text-xs text-red-400">{avatarUploadError}</p>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
              Full Name
            </label>
            <Input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your full name"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
              Phone Number
            </label>
            <Input
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+919876543210"
              leftIcon={<Phone className="w-4 h-4 text-semantic-text-tertiary" />}
            />
          </div>

          {/* Email / Gmail */}
          <div>
            <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
              Email / Gmail Address
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="name@gmail.com"
              leftIcon={<Mail className="w-4 h-4 text-semantic-text-tertiary" />}
            />
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
              Language Preference
            </label>
            <select
              value={formData.language}
              onChange={e => setFormData(prev => ({ ...prev, language: e.target.value as 'en' | 'hi' }))}
              className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-2.5 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </div>

          {/* Worker Specific Fields */}
          {isWorker && (
            <div className="pt-3 border-t border-semantic-border-light space-y-3">
              <h4 className="font-bold text-xs text-brand-400 uppercase tracking-wider">
                Worker Trade & Details
              </h4>

              <div>
                <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                  Primary Trade
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-2.5 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500 capitalize"
                >
                  <option value="">Select Primary Trade</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryName(cat, language === 'hi' ? 'hi' : 'en')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                  Years of Experience
                </label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={formData.experience_years}
                  onChange={e => setFormData(prev => ({ ...prev, experience_years: Number(e.target.value) }))}
                  placeholder="5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                  About your work (Bio)
                </label>
                <textarea
                  value={formData.bio}
                  onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-2.5 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500"
                  placeholder="Describe your skills, tools, and specialty..."
                />
              </div>

              {/* ID Proof upload */}
              <div>
                <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                  ID Proof Document (Aadhaar / Voter ID)
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => idProofInputRef.current?.click()}
                    disabled={isUploadingIdProof}
                    className="text-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1 text-brand-400" />
                    {formData.id_proof_url ? 'Replace Document' : 'Upload ID Proof'}
                  </Button>
                  <input
                    type="file"
                    ref={idProofInputRef}
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleIdProofFileSelect}
                  />
                  {formData.id_proof_url && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                      <Check className="w-3 h-3" /> Attached
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-semantic-border-light">
            <Button
              variant="secondary"
              onClick={() => setEditMode(false)}
              className="flex-1 text-xs"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              loading={isSaving}
              className="flex-1 text-xs font-bold"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* 7. HELP & SUPPORT MODAL                                               */}
      {/* ===================================================================== */}
      <Modal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        title="Muzaffarnagar Kaamgar Helpline"
        description="Connect with our local support team for booking assistance, issues, or enquiries."
      >
        <div className="space-y-3 pt-2">
          {/* WhatsApp Direct Chat */}
          <a
            href="https://api.whatsapp.com/send?phone=918077362606&text=Hello%2C%20I%20need%20assistance%20with%20Muzaffarnagar%20Kaamgar%20services"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-emerald-300">
                  WhatsApp Support Chat
                </p>
                <p className="text-[11px] text-semantic-text-secondary">
                  Instant replies (8:00 AM - 9:00 PM)
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </a>

          {/* Emergency Phone Helpline */}
          <a
            href="tel:+918077362606"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-200 border border-semantic-border-light hover:bg-surface-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-brand-300">
                  Call Support Line
                </p>
                <p className="text-[11px] text-semantic-text-secondary">
                  +91 8077362606
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-semantic-text-tertiary" />
          </a>

          <div className="pt-2 text-center text-xs text-semantic-text-tertiary">
            <p>Official City Initiative for Muzaffarnagar, Uttar Pradesh</p>
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* 8. MANAGE ADDRESSES MODAL                                             */}
      {/* ===================================================================== */}
      <Modal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Muzaffarnagar Service Localities"
        description="Kaamgar currently provides rapid same-day artisan service in the following pincodes."
      >
        <div className="space-y-2.5 pt-2">
          {MUZAFFARNAGAR_PINCODES.map(pincode => (
            <div
              key={pincode}
              className="p-3.5 rounded-2xl bg-surface-200/70 border border-semantic-border-light flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {pincode === '251001' ? 'City / New Mandi' : 'Cantt / Civil Lines'}
                  </p>
                  <p className="text-[11px] text-semantic-text-tertiary">
                    Pincode: {pincode} • Active Coverage
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          ))}
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* 9. ADD / UPDATE EMAIL MODAL                                           */}
      {/* ===================================================================== */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false)
          setEmailModalError('')
        }}
        title="Email / Gmail Address"
        description="Link your email to receive official receipts and job notifications."
      >
        <form
          onSubmit={async e => {
            e.preventDefault()
            setEmailModalError('')
            const trimmed = emailModalInput.trim()
            if (!trimmed || !trimmed.includes('@')) {
              setEmailModalError('Please enter a valid email address')
              return
            }

            setIsSavingEmail(true)
            try {
              await updateEmail(trimmed)
              setFormData(prev => ({ ...prev, email: trimmed }))
              setShowEmailModal(false)
              setEmailModalInput('')
              setSaveSuccessMsg('Email updated successfully!')
              setTimeout(() => setSaveSuccessMsg(''), 4000)
            } catch (err) {
              setEmailModalError(err instanceof Error ? err.message : 'Failed to save email')
            } finally {
              setIsSavingEmail(false)
            }
          }}
          className="space-y-4 pt-2"
        >
          {emailModalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{emailModalError}</span>
            </div>
          )}
          <Input
            label="Email Address"
            type="email"
            value={emailModalInput}
            onChange={e => setEmailModalInput(e.target.value)}
            placeholder="yourname@gmail.com"
            leftIcon={<Mail className="w-4 h-4 text-semantic-text-tertiary" />}
            required
            autoFocus
          />
          <div className="flex gap-3 justify-end pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEmailModal(false)
                setEmailModalError('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSavingEmail}>
              Save Email
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* 10. LOGOUT CONFIRMATION MODAL                                         */}
      {/* ===================================================================== */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title={t('profile.logoutModalTitle', 'Logout Confirmation')}
        description={t('profile.logoutModalDesc', 'Are you sure you want to sign out of your account?')}
      >
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setShowLogoutModal(false)
              await logout()
              navigate('/login')
            }}
          >
            {t('profile.confirmLogout', 'Confirm Logout')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

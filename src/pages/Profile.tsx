import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Button, Card, Avatar, Badge, Input, Modal } from '@kaamgar/ui'
import { CATEGORIES, MUZAFFARNAGAR_PINCODES } from '@kaamgar/shared'
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
  FileCheck,
  ChevronRight,
  UserCheck,
  Mail,
} from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { uploadAvatar, uploadIdProof, validateFile } from '@/services/storage'

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

interface RecentActivityItem {
  id: string
  title: string
  desc: string
  time: string
  status: string
  category: string
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, updateUser, updateEmail, logout, isWorker, isLoading: authLoading } = useAuth()
  const { language, setLanguage, toggleLanguage } = useLanguage()

  const [editMode, setEditMode] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
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
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([])
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

      // 2. If worker, fetch worker profile, categories, areas, bookings
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
            .select('id, category_id, status, scheduled_at, created_at')
            .eq('worker_id', user.id)
            .order('created_at', { ascending: false }),
        ])

        const wp = wpResult?.data
        const completedCount = (bookingsResult?.data ?? []).filter((b: any) => b.status === 'completed').length
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

        // Map recent bookings for worker
        const activities: RecentActivityItem[] = (bookingsResult?.data ?? []).slice(0, 5).map((b: any) => ({
          id: b.id,
          title: `Booking ${b.status}`,
          desc: `${b.category_id} service`,
          time: new Date(b.created_at).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
            month: 'short',
            day: 'numeric',
          }),
          status: b.status,
          category: b.category_id,
        }))
        setRecentActivities(activities)
      } else if (user.role === 'admin') {
        // Administrator accounts do not participate in bookings
        setRecentActivities([])
      } else {
        // Customer bookings
        const { data: customerBookings } = await (supabase.from('bookings') as any)
          .select('id, category_id, status, scheduled_at, created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        const activities: RecentActivityItem[] = (customerBookings ?? []).map((b: any) => ({
          id: b.id,
          title: `Booking ${b.status}`,
          desc: `${b.category_id} booking`,
          time: new Date(b.created_at).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
            month: 'short',
            day: 'numeric',
          }),
          status: b.status,
          category: b.category_id,
        }))
        setRecentActivities(activities)
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

  const handleSaveEmailModal = async (e: React.FormEvent) => {
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
      setSaveSuccessMsg('Email address saved successfully!')
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    } catch (err) {
      setEmailModalError(err instanceof Error ? err.message : 'Failed to save email')
    } finally {
      setIsSavingEmail(false)
    }
  }

  useEffect(() => {
    void loadProfileData()
  }, [loadProfileData])

  // Direct toggle availability without opening edit mode
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
      setSaveErrorMsg(err instanceof Error ? err.message : 'Failed to update availability status')
      setTimeout(() => setSaveErrorMsg(''), 4000)
    }
  }

  // Avatar file upload handler
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
      setSaveSuccessMsg(t('profile.avatarUpdated', 'Profile photo updated successfully!'))
      setTimeout(() => setSaveSuccessMsg(''), 3500)
    } catch (err) {
      setAvatarUploadError(err instanceof Error ? err.message : 'Unable to upload photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // ID Proof document upload handler
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
      setSaveSuccessMsg(t('profile.idUploaded', 'ID proof document uploaded securely (Private for Admin review)'))
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    } catch (err) {
      setIdProofUploadError(err instanceof Error ? err.message : 'Unable to upload document')
    } finally {
      setIsUploadingIdProof(false)
    }
  }

  // Save changes handler
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

      // 1. Update profiles table
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

      // 2. If worker, update worker_profiles and related tables
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

        // Sync worker category
        if (formData.category) {
          await (supabase.from('worker_categories') as any).delete().eq('worker_id', user.id)
          await (supabase.from('worker_categories') as any).insert({
            worker_id: user.id,
            category_id: formData.category,
          })
        }

        // Sync worker service areas
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

      // 3. Update Auth Context & Language
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
      setSaveSuccessMsg(t('profile.saveSuccess', 'Profile changes saved successfully!'))
      setTimeout(() => setSaveSuccessMsg(''), 4000)
      await loadProfileData()
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Failed to save profile changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setSaveErrorMsg('')
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        language: (user.language || language || 'en') as 'en' | 'hi',
        avatar_url: user.avatar_url || '',
        bio: workerDetails?.bio || '',
        experience_years: workerDetails?.experience_years || 0,
        category: workerDetails?.categories?.[0] || '',
        areas: workerDetails?.areas || [],
        is_available: workerDetails?.is_available ?? true,
        id_proof_url: workerDetails?.id_proof_url || '',
      })
    }
  }

  const toggleAreaSelection = (pincode: string) => {
    setFormData(prev => {
      const exists = prev.areas.includes(pincode)
      if (exists) {
        return { ...prev, areas: prev.areas.filter(a => a !== pincode) }
      } else {
        return { ...prev, areas: [...prev.areas, pincode] }
      }
    })
  }

  if (authLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-semantic-bg-primary">
        <Card className="w-full max-w-md p-8 text-center bg-surface-100 border border-semantic-border-light">
          <Shield className="w-12 h-12 mx-auto text-brand-400 mb-3" />
          <h2 className="text-xl font-semibold text-semantic-text-primary mb-2">
            {t('errors.unauthorized', 'Please login first')}
          </h2>
          <p className="text-semantic-text-secondary text-sm mb-4">
            {t('profile.viewHint', 'You need to be logged in to view your profile settings.')}
          </p>
          <Button variant="primary" onClick={() => navigate('/login')} className="w-full">
            {t('nav.login', 'Go to Login')}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-semantic-bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-semantic-text-primary">{t('profile.title', 'Profile')}</h1>
            <p className="text-semantic-text-secondary mt-1">
              {t('profile.subtitle', 'Manage your personal details, preferences, and account')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Edit className="w-4 h-4" />
                {t('profile.editProfile', 'Edit Profile')}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="warning" className="px-3 py-1 text-xs">
                  {t('profile.editingMode', 'Editing Mode')}
                </Badge>
                <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Notifications & Alerts */}
        {saveSuccessMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {saveErrorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
        )}
        {avatarUploadError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{avatarUploadError}</span>
          </div>
        )}
        {idProofUploadError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{idProofUploadError}</span>
          </div>
        )}

        {/* Suggestion to add Gmail/Email if not added yet (Recommended for all roles) */}
        {!user.email && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand-500/15 via-surface-100 to-brand-500/5 border border-brand-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fadeIn">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0 text-brand-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-semantic-text-primary">
                    Add your Email / Gmail Address
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-semantic-text-secondary mt-1">
                  Add your email to receive official booking receipts, job updates, and account recovery options.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="flex-shrink-0 text-xs py-2 px-4 whitespace-nowrap"
              onClick={() => {
                setEmailModalInput('')
                setEmailModalError('')
                setShowEmailModal(true)
              }}
            >
              + Add Email Address
            </Button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Avatar card & Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 text-center bg-surface-100 border border-semantic-border-light relative overflow-hidden">
              {/* Avatar with Camera upload trigger */}
              <div className="relative inline-block mx-auto mb-3">
                <Avatar
                  name={formData.name}
                  src={formData.avatar_url || undefined}
                  size="2xl"
                  className="mx-auto shadow-md"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 p-2 bg-brand-500 text-surface-950 rounded-full shadow-lg hover:bg-brand-400 transition-colors focus:outline-none"
                  title="Upload profile photo"
                >
                  {isUploadingAvatar ? (
                    <UploadCloud className="w-4 h-4 animate-bounce" />
                  ) : (
                    <Camera className="w-4 h-4" />
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

              <h2 className="text-xl font-bold text-semantic-text-primary">{formData.name}</h2>
              <p className="text-semantic-text-secondary text-sm mt-0.5">
                {formData.phone || t('profile.noPhone', 'No phone set')}
              </p>
              {user.email ? (
                <div className="text-semantic-text-secondary text-xs mt-1.5 flex items-center justify-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-400" />
                  <span>{user.email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailModalInput(user.email || '')
                      setEmailModalError('')
                      setShowEmailModal(true)
                    }}
                    className="text-brand-400 hover:text-brand-300 text-[11px] underline ml-1"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEmailModalInput('')
                    setEmailModalError('')
                    setShowEmailModal(true)
                  }}
                  className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>+ Add Email</span>
                </button>
              )}

              {/* Role & Verification Badges with clean spacing */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'worker' ? 'primary' : 'info'}>
                  {user.role === 'admin'
                    ? t('profile.roles.admin', 'ADMIN')
                    : user.role === 'worker'
                    ? t('profile.roles.worker', 'WORKER')
                    : t('profile.roles.customer', 'CUSTOMER')}
                </Badge>
                {isWorker && workerDetails && (
                  <Badge
                    variant={
                      workerDetails.approval_status === 'approved'
                        ? 'success'
                        : workerDetails.approval_status === 'pending'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {workerDetails.approval_status === 'approved'
                      ? t('profile.status.approved', 'Verified & Approved')
                      : workerDetails.approval_status === 'pending'
                      ? t('profile.status.pending', 'Under Review')
                      : t('profile.status.rejected', 'Needs Changes')}
                  </Badge>
                )}
              </div>

              {/* Worker Availability Status Pill & Direct Switcher */}
              {isWorker && workerDetails && (
                <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200/80 border border-semantic-border-light text-xs">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      workerDetails.is_available ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-medium text-semantic-text-primary">
                    {workerDetails.is_available
                      ? t('profile.availableForJobs', 'Available for Jobs')
                      : t('profile.offlineUnavailable', 'Offline / Unavailable')}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAvailability}
                    className="ml-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 underline focus:outline-none"
                  >
                    {workerDetails.is_available
                      ? t('profile.goOffline', 'Go Offline')
                      : t('profile.goOnline', 'Go Online')}
                  </button>
                </div>
              )}

              {/* Worker Metrics (spacious 3-box design with zero text mixing/overflow) */}
              {isWorker && workerDetails && (
                <div className="mt-5 pt-4 border-t border-semantic-border-light grid grid-cols-3 gap-2 text-center">
                  {/* Rating box with single gold star */}
                  <div className="p-3 bg-surface-200/70 border border-semantic-border-light rounded-xl flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                      <span className="text-base font-bold text-semantic-text-primary">
                        {workerDetails.rating > 0 ? workerDetails.rating.toFixed(1) : '5.0'}
                      </span>
                    </div>
                    <p className="text-[11px] text-semantic-text-secondary mt-0.5">{t('common.rating', 'Rating')}</p>
                  </div>

                  {/* Reviews box */}
                  <div className="p-3 bg-surface-200/70 border border-semantic-border-light rounded-xl flex flex-col items-center justify-center">
                    <p className="text-base font-bold text-semantic-text-primary">{workerDetails.review_count}</p>
                    <p className="text-[11px] text-semantic-text-secondary mt-0.5">{t('common.reviews', 'Reviews')}</p>
                  </div>

                  {/* Completed Jobs box */}
                  <div className="p-3 bg-surface-200/70 border border-semantic-border-light rounded-xl flex flex-col items-center justify-center">
                    <p className="text-base font-bold text-emerald-400">{workerDetails.completedJobsCount}</p>
                    <p className="text-[11px] text-semantic-text-secondary mt-0.5">{t('profile.completed', 'Completed')}</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Quick Actions Panel — ALL BUTTONS FULLY FUNCTIONAL */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light">
              <h3 className="font-semibold text-semantic-text-primary mb-4 text-xs uppercase tracking-wider">
                {t('profile.quickActions', 'Quick Actions')}
              </h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-semantic-text-primary hover:bg-surface-200"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit className="w-4 h-4 mr-2.5 text-brand-400" />
                  {editMode ? t('profile.exitEditMode', 'Exit Edit Mode') : t('profile.editProfile', 'Edit Profile')}
                </Button>

                {user.role === 'admin' && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-brand-400 hover:bg-brand-500/10 border-brand-500/30 font-medium"
                      onClick={() => navigate('/admin')}
                    >
                      <Shield className="w-4 h-4 mr-2.5 text-brand-400" />
                      {t('admin.dashboard', 'Admin Dashboard')}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-semantic-text-primary hover:bg-surface-200"
                      onClick={() => navigate('/admin?tab=notifications')}
                    >
                      <Bell className="w-4 h-4 mr-2.5 text-amber-400" />
                      {t('admin.notifications', 'Admin Notifications')}
                    </Button>
                  </>
                )}

                {isWorker && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-semantic-text-primary hover:bg-surface-200"
                    onClick={() => navigate('/worker/dashboard')}
                  >
                    <Briefcase className="w-4 h-4 mr-2.5 text-emerald-400" />
                    {t('nav.workerDashboard', 'Worker Dashboard')}
                  </Button>
                )}

                {user.role !== 'admin' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-semantic-text-primary hover:bg-surface-200"
                    onClick={() => navigate('/bookings')}
                  >
                    <Calendar className="w-4 h-4 mr-2.5 text-blue-400" />
                    {t('nav.bookings', 'My Bookings')}
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start text-semantic-text-primary hover:bg-surface-200"
                  onClick={() => navigate('/notifications')}
                >
                  <Bell className="w-4 h-4 mr-2.5 text-purple-400" />
                  {t('nav.notifications', 'Notifications')}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-semantic-text-primary hover:bg-surface-200"
                  onClick={toggleLanguage}
                >
                  <Globe className="w-4 h-4 mr-2.5 text-amber-400" />
                  {language === 'en'
                    ? t('profile.switchToHindi', 'हिंदी में बदलें (Hindi)')
                    : t('profile.switchToEnglish', 'Switch to English')}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-red-400 hover:bg-red-500/10 border-red-500/30"
                  onClick={() => setShowLogoutModal(true)}
                >
                  <LogOut className="w-4 h-4 mr-2.5" />
                  {t('nav.logout', 'Logout')}
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Profile Details & Edit Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-surface-100 border border-semantic-border-light shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-semantic-border-light">
                <div>
                  <h3 className="text-lg font-semibold text-semantic-text-primary">
                    {t('profile.accountDetails', 'Account Details')}
                  </h3>
                  <p className="text-xs text-semantic-text-secondary mt-0.5">
                    {editMode
                      ? t('profile.editHint', 'Update your personal and work details below, then click Save Changes.')
                      : t('profile.viewHint', 'Your personal information and Kaamgar preferences.')}
                  </p>
                </div>
                {!editMode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 text-xs text-brand-400"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {t('profile.editProfile', 'Edit Profile')}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={handleCancelEdit} className="text-xs">
                    {t('common.cancel', 'Cancel')}
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                {/* Name & Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                      {t('auth.workerRegistration.fullName', 'Full Name')}
                    </label>
                    {editMode ? (
                      <Input
                        value={formData.name}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Your full name"
                        required
                      />
                    ) : (
                      <p className="text-semantic-text-primary font-medium p-2.5 bg-surface-200/50 rounded-lg border border-semantic-border-light text-sm">
                        {formData.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                      {t('auth.phoneLabel', 'Phone Number')}
                    </label>
                    {editMode ? (
                      <Input
                        value={formData.phone}
                        onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+919876543210"
                      />
                    ) : (
                      <p className="text-semantic-text-primary font-medium p-2.5 bg-surface-200/50 rounded-lg border border-semantic-border-light text-sm">
                        {formData.phone || t('profile.noPhoneSpecified', 'No phone specified')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email / Gmail Address & Language Preference */}
                <div className={`grid grid-cols-1 ${user?.role === 'admin' ? '' : 'md:grid-cols-2'} gap-4`}>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-semantic-text-secondary uppercase">
                        Email / Gmail Address
                      </label>
                      {!formData.email && !editMode && (
                        <span className="text-[10px] text-amber-400 font-semibold uppercase">
                          Recommended
                        </span>
                      )}
                    </div>
                    {editMode ? (
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="name@gmail.com"
                        leftIcon={<Mail className="w-4 h-4 text-semantic-text-tertiary" />}
                      />
                    ) : (
                      <div className="flex items-center justify-between p-2.5 bg-surface-200/50 rounded-lg border border-semantic-border-light text-sm min-h-[42px]">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-semantic-text-tertiary flex-shrink-0" />
                          <span
                            className={
                              formData.email
                                ? 'text-semantic-text-primary font-medium'
                                : 'text-semantic-text-tertiary italic text-xs'
                            }
                          >
                            {formData.email || 'No email added yet'}
                          </span>
                        </div>
                        {!formData.email ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEmailModalInput('')
                              setEmailModalError('')
                              setShowEmailModal(true)
                            }}
                            className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                          >
                            + Add
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle className="w-3 h-3" /> Linked
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Language Preference - Hidden for Admin profile */}
                  {user?.role !== 'admin' && (
                    <div>
                      <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                        {t('profile.languagePreference', 'Language Preference')}
                      </label>
                      {editMode ? (
                        <select
                          value={formData.language}
                          onChange={e => setFormData(prev => ({ ...prev, language: e.target.value as 'en' | 'hi' }))}
                          className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-2.5 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500"
                        >
                          <option value="en">English</option>
                          <option value="hi">हिंदी (Hindi)</option>
                        </select>
                      ) : (
                        <p className="text-semantic-text-primary font-medium p-2.5 bg-surface-200/50 rounded-lg border border-semantic-border-light text-sm min-h-[42px] flex items-center">
                          {formData.language === 'hi' ? 'हिंदी (Hindi)' : 'English'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Worker Specific Fields */}
                {isWorker && (
                  <>
                    <div className="pt-4 border-t border-semantic-border-light space-y-4">
                      <h4 className="font-semibold text-semantic-text-primary text-xs uppercase tracking-wider">
                        {t('profile.workDetailsTitle', 'Work & Service Details')}
                      </h4>

                      {/* Primary Category & Experience */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                            {t('profile.primaryCategory', 'Primary Category')}
                          </label>
                          {editMode ? (
                            <select
                              value={formData.category}
                              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                              className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-2.5 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500 capitalize"
                            >
                              <option value="">{t('profile.selectCategory', 'Select Category')}</option>
                              {CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {language === 'hi' ? cat.name_hi : cat.name_en}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 p-2 bg-surface-200/50 rounded-lg border border-semantic-border-light min-h-[42px] items-center">
                              {workerDetails?.categories && workerDetails.categories.length > 0 ? (
                                workerDetails.categories.map(cat => {
                                  const catObj = CATEGORIES.find(c => c.id === cat)
                                  const catName = language === 'hi' && catObj ? catObj.name_hi : catObj?.name_en || cat
                                  return (
                                    <Badge key={cat} variant="primary" className="capitalize text-xs">
                                      {catName}
                                    </Badge>
                                  )
                                })
                              ) : (
                                <span className="text-xs text-semantic-text-tertiary">
                                  {t('profile.noneAssigned', 'None assigned')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                            {t('profile.experienceYears', 'Experience (Years)')}
                          </label>
                          {editMode ? (
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={formData.experience_years}
                              onChange={e =>
                                setFormData(prev => ({
                                  ...prev,
                                  experience_years: Number(e.target.value),
                                }))
                              }
                            />
                          ) : (
                            <p className="text-semantic-text-primary font-medium p-2.5 bg-surface-200/50 rounded-lg border border-semantic-border-light text-sm">
                              {formData.experience_years} {t('common.years', 'years')}
                            </p>
                          )}
                        </div>

                        {/* Service Areas */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                            {t('profile.serviceAreasTitle', 'Service Area Pincodes')}
                          </label>
                          {editMode ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {MUZAFFARNAGAR_PINCODES.map(pincode => {
                                  const isSelected = formData.areas.includes(pincode)
                                  return (
                                    <button
                                      key={pincode}
                                      type="button"
                                      onClick={() => toggleAreaSelection(pincode)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                                          : 'bg-surface-200 border-semantic-border-medium text-semantic-text-secondary hover:bg-surface-300'
                                      }`}
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>
                                        {language === 'hi' ? 'मुजफ्फरनगर' : 'Muzaffarnagar'} ({pincode})
                                      </span>
                                      {isSelected && <Check className="w-3.5 h-3.5 ml-0.5 text-brand-400" />}
                                    </button>
                                  )
                                })}
                              </div>
                              <p className="text-[11px] text-semantic-text-tertiary">
                                {t(
                                  'profile.areasHint',
                                  'Select all pincodes where you can travel to provide services.',
                                )}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 p-2 bg-surface-200/50 rounded-lg border border-semantic-border-light min-h-[42px] items-center">
                              {workerDetails?.areas && workerDetails.areas.length > 0 ? (
                                workerDetails.areas.map(area => (
                                  <Badge key={area} variant="outline" className="text-xs">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {language === 'hi' ? 'मुजफ्फरनगर' : 'Muzaffarnagar'} ({area})
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-semantic-text-tertiary">
                                  {t('profile.noneSpecified', 'None specified')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bio */}
                      <div>
                        <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                          {t('profile.bioTitle', 'Professional Bio / Specialties')}
                        </label>
                        {editMode ? (
                          <textarea
                            value={formData.bio}
                            onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                            rows={3}
                            placeholder={t(
                              'profile.bioPlaceholder',
                              'Describe your specialties, tools, and background...',
                            )}
                            className="w-full bg-surface-200 border border-semantic-border-medium rounded-lg p-3 text-sm text-semantic-text-primary focus:outline-none focus:border-brand-500"
                          />
                        ) : (
                          <p className="text-semantic-text-secondary whitespace-pre-line p-3 bg-surface-200/50 rounded-lg border border-semantic-border-light text-sm leading-relaxed">
                            {formData.bio ||
                              t('profile.noBio', 'No bio written yet. Click Edit Profile to add one.')}
                          </p>
                        )}
                      </div>

                      {/* ID Proof Document Section (Phase 9 Storage Upload) */}
                      <div className="pt-4 border-t border-semantic-border-light">
                        <label className="block text-xs font-semibold text-semantic-text-secondary uppercase mb-1">
                          {t('profile.idProofTitle', 'ID Proof Document (Aadhaar / Voter ID / License)')}
                        </label>
                        <div className="p-3 bg-surface-200/50 border border-semantic-border-light rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-semantic-text-primary">
                                  {workerDetails?.id_proof_url
                                    ? t('profile.idDocOnFile', 'ID Document on File')
                                    : t('profile.noIdDoc', 'No ID Document Uploaded Yet')}
                                </p>
                                {workerDetails?.id_proof_url && (
                                  <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                                    {t('profile.encryptedPrivate', 'Encrypted & Private')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-semantic-text-tertiary">
                                {t(
                                  'profile.privateDocNote',
                                  'Stored in private storage. Visible only to verified administrators.',
                                )}
                              </p>
                            </div>
                          </div>

                          {editMode && (
                            <div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => idProofInputRef.current?.click()}
                                disabled={isUploadingIdProof}
                                className="text-xs whitespace-nowrap"
                              >
                                {isUploadingIdProof ? (
                                  <>
                                    <UploadCloud className="w-3.5 h-3.5 mr-1.5 animate-bounce" />
                                    {t('profile.uploading', 'Uploading...')}
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-brand-400" />
                                    {workerDetails?.id_proof_url
                                      ? t('profile.replaceDoc', 'Replace Document')
                                      : t('profile.uploadIdProof', 'Upload ID Proof')}
                                  </>
                                )}
                              </Button>
                              <input
                                type="file"
                                ref={idProofInputRef}
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={handleIdProofFileSelect}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Edit Mode Save & Cancel Actions */}
                {editMode && (
                  <div className="flex gap-3 pt-6 border-t border-semantic-border-light">
                    <Button variant="secondary" onClick={handleCancelEdit} className="flex-1" disabled={isSaving}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSaveProfile} loading={isSaving} className="flex-1">
                      {isSaving ? t('common.loading', 'Saving...') : t('profile.saveChanges', 'Save Changes')}
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Admin Controls & Overview (shown only for Administrator accounts) */}
            {user.role === 'admin' && (
              <Card className="p-6 bg-surface-100 border border-semantic-border-light">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-semantic-text-primary">
                        {t('admin.dashboard', 'Admin Controls & Overview')}
                      </h3>
                      <p className="text-xs text-semantic-text-secondary">
                        {t('admin.profileAdminRole', 'Platform Administrator')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/admin')}
                    className="text-xs"
                  >
                    {t('profile.goToAdminPortal', 'Go to Admin Portal')}
                  </Button>
                </div>
                <p className="text-sm text-semantic-text-secondary mb-5 leading-relaxed">
                  {t(
                    'admin.profileAdminDesc',
                    'Administrator accounts do not place or receive bookings. Use the administrative portal to review worker registrations, verify ID documents, and manage platform operations.'
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => navigate('/admin?tab=workers')}
                    className="p-4 rounded-xl bg-surface-200/60 hover:bg-surface-200 border border-semantic-border-light cursor-pointer transition-colors group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-semantic-text-primary group-hover:text-brand-400 transition-colors">
                          {t('admin.pendingWorkers', 'Pending Approvals')}
                        </p>
                        <p className="text-xs text-semantic-text-tertiary">
                          {t('admin.reviewPendingWorkers', 'Review Worker Registrations')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 transition-colors" />
                  </div>

                  <div
                    onClick={() => navigate('/admin?tab=notifications')}
                    className="p-4 rounded-xl bg-surface-200/60 hover:bg-surface-200 border border-semantic-border-light cursor-pointer transition-colors group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-semantic-text-primary group-hover:text-brand-400 transition-colors">
                          {t('admin.notifications', 'Admin Notifications')}
                        </p>
                        <p className="text-xs text-semantic-text-tertiary">
                          {t('admin.viewAlerts', 'Verification & ID Alerts')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 transition-colors" />
                  </div>
                </div>
              </Card>
            )}

            {/* Recent Booking Activity Card (Worker & Customer Accounts only) */}
            {user.role !== 'admin' && (
              <Card className="p-6 bg-surface-100 border border-semantic-border-light">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-semantic-text-primary">
                    {t('profile.recentBookings', 'Recent Booking Activity')}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/bookings')}
                    className="text-xs text-brand-400"
                  >
                    {t('common.viewAll', 'View All')}
                  </Button>
                </div>
                <div className="space-y-3">
                  {recentActivities.length === 0 ? (
                    <div className="text-center p-6 bg-surface-200/40 rounded-xl border border-semantic-border-light">
                      <p className="text-sm font-medium text-semantic-text-primary">
                        {t('profile.noRecentBookings', 'No recent booking activity recorded yet.')}
                      </p>
                      <p className="text-xs text-semantic-text-secondary mt-1">
                        {t('profile.noRecentBookingsDesc', 'Bookings you place or receive will be listed here.')}
                      </p>
                    </div>
                  ) : (
                    recentActivities.map(activity => {
                      const catObj = CATEGORIES.find(c => c.id === activity.category)
                      const catName =
                        language === 'hi' && catObj ? catObj.name_hi : catObj?.name_en || activity.category
                      const statusText =
                        activity.status === 'completed'
                          ? t('booking.status.completed', 'Completed')
                          : activity.status === 'accepted'
                          ? t('booking.status.accepted', 'Accepted')
                          : activity.status === 'in_progress'
                          ? t('booking.status.inProgress', 'In Progress')
                          : activity.status === 'pending'
                          ? t('booking.status.pending', 'Pending')
                          : t('booking.status.rejected', 'Rejected')

                      return (
                        <div
                          key={activity.id}
                          onClick={() => navigate('/bookings')}
                          className="flex items-center justify-between p-3 bg-surface-200/60 hover:bg-surface-200 border border-semantic-border-light rounded-lg transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-brand-500/10 rounded-lg flex items-center justify-center text-brand-400">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-semantic-text-primary capitalize group-hover:text-brand-400 transition-colors">
                                {catName} ({statusText})
                              </p>
                              <p className="text-xs text-semantic-text-tertiary">
                                {t('profile.recordedOn', 'Recorded on')} {activity.time}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                activity.status === 'completed'
                                  ? 'success'
                                  : activity.status === 'accepted' || activity.status === 'in_progress'
                                  ? 'info'
                                  : activity.status === 'pending'
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {statusText}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-semantic-text-tertiary group-hover:text-brand-400 transition-colors" />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Add / Update Email Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false)
          setEmailModalError('')
        }}
        title="Email / Gmail Address"
        description="Add or update your email to receive official booking receipts and account notices."
      >
        <form onSubmit={handleSaveEmailModal} className="space-y-4 pt-2">
          {emailModalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSavingEmail}
            >
              Save Email
            </Button>
          </div>
        </form>
      </Modal>

      {/* Logout Confirmation Modal */}
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

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { Button, Input, Card, Badge } from '@kaamgar/ui'
import {
  CATEGORIES,
  MUZAFFARNAGAR_PINCODES,
  getCategoryName,
  JUGNU_CATEGORIES,
  ALL_SERVICES,
  getServiceById,
  UserRole,
} from '@kaamgar/shared'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Image,
  IdCard,
  Briefcase,
  User,
  Info,
  UploadCloud,
  FileText,
  X,
  CheckCircle,
  ShieldCheck,
  Mail,
  Lock,
  Plus,
  Minus,
  Home as HomeIcon,
  Wrench,
  Sparkles,
  Truck,
  Zap,
  Hammer,
  Paintbrush,
  Snowflake,
  Settings,
  Droplets,
  Flame,
  Scissors,
  Palette,
  Shirt,
  Car,
  ShieldAlert,
  HardHat,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { uploadAvatar, uploadIdProof, validateFile } from '@/services/storage'
import { notifyAdminsOfWorkerRegistration } from '@/services/admin'
import { openOtpWidget } from '@/services/otp'
import { checkPhoneRegistration } from '@/services/authCheck'
import { sanitizeErrorMessage } from '@/utils/errors'

const categoryIconMap: Record<string, React.ElementType> = {
  home: HomeIcon,
  wrench: Wrench,
  sparkles: Sparkles,
  truck: Truck,
  zap: Zap,
  hammer: Hammer,
  brush: Paintbrush,
  paintbrush: Paintbrush,
  'hard-hat': HardHat,
  'brick-wall': Wrench,
  snowflake: Snowflake,
  cog: Settings,
  droplets: Droplets,
  flame: Flame,
  scissors: Scissors,
  palette: Palette,
  user: User,
  shirt: Shirt,
  car: Car,
  'shield-alert': ShieldAlert,
}

const STEPS = [
  { key: 'personal', labelKey: 'auth.workerRegistration.step1', fallback: 'Personal Info', icon: User },
  { key: 'work', labelKey: 'auth.workerRegistration.step2', fallback: 'Work Details', icon: Briefcase },
  { key: 'documents', labelKey: 'auth.workerRegistration.step3', fallback: 'Documents', icon: IdCard },
]

export default function WorkerRegistration() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, verifyAndLoginWithOtp, signInWithGoogle } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)

  // Initialize form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '',
    email: user?.email || '',
    category: '',
    experience: '',
    bio: '',
    avatar: null as File | null | undefined,
    idProof: null as File | null | undefined,
    areas: [] as string[],
  })

  // Track phone verification status
  const [phoneVerified, setPhoneVerified] = useState(
    !!(user?.phone && user.phone.trim().length >= 10)
  )
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [alreadyRegisteredNotice, setAlreadyRegisteredNotice] = useState<{
    phone: string
    role: UserRole
    message?: string
  } | null>(null)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [idProofPreview, setIdProofPreview] = useState<string | null>(null)
  const [idProofIsPdf, setIdProofIsPdf] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Category & multi-service selection state (Strict max 2 services within 1 parent category)
  const initialParentCategory = formData.category
    ? JUGNU_CATEGORIES.find(c => c.services.some(s => s.id === formData.category))?.id || null
    : null

  const [selectedServices, setSelectedServices] = useState<string[]>(
    formData.category ? [formData.category] : []
  )
  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>(initialParentCategory)
  const [serviceLimitMessage, setServiceLimitMessage] = useState<string | null>(null)
  const [categorySwitchedNotice, setCategorySwitchedNotice] = useState<string | null>(null)

  const toggleServiceSelection = (serviceId: string) => {
    setCategorySwitchedNotice(null)
    setSelectedServices(prev => {
      const exists = prev.includes(serviceId)
      if (exists) {
        // Removing a selected service
        const next = prev.filter(id => id !== serviceId)
        setServiceLimitMessage(null)
        setFormData(f => ({ ...f, category: next[0] || '' }))
        return next
      }

      // Check strict limit of 2 services
      if (prev.length >= 2) {
        setServiceLimitMessage(
          t(
            'auth.workerRegistration.maxTwoServicesError',
            'You can select a maximum of 2 services within this category. Please remove one service first to select another.'
          )
        )
        return prev
      }

      // Adding 1st or 2nd service
      setServiceLimitMessage(null)
      const next = [...prev, serviceId]
      setFormData(f => ({ ...f, category: next[0] || '' }))
      if (next.length > 0) {
        setErrors(err => {
          const updated = { ...err }
          delete updated.category
          return updated
        })
      }
      return next
    })
  }

  const handleSelectParentCategory = (categoryId: string) => {
    if (selectedParentCategory && selectedParentCategory !== categoryId) {
      if (selectedServices.length > 0) {
        const prevCat = JUGNU_CATEGORIES.find(c => c.id === selectedParentCategory)
        const newCat = JUGNU_CATEGORIES.find(c => c.id === categoryId)
        const prevName = prevCat?.name_en || selectedParentCategory
        const newName = newCat?.name_en || categoryId
        setCategorySwitchedNotice(
          `Switched trade to ${newName}. Previously selected services from ${prevName} were cleared.`
        )
      }
      // Worker changed parent category: clear previously selected services
      setSelectedServices([])
      setFormData(f => ({ ...f, category: '' }))
      setErrors(err => {
        const updated = { ...err }
        delete updated.category
        return updated
      })
    }
    setSelectedParentCategory(categoryId)
    setServiceLimitMessage(null)
  }

  // Sync with user if logged in via Google OAuth redirect
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        phone: prev.phone || (user.phone ? user.phone.replace(/\D/g, '').slice(-10) : ''),
        email: prev.email || user.email || '',
      }))
      if (user.phone && user.phone.trim().length >= 10) {
        setPhoneVerified(true)
      }
    }
  }, [user])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (idProofPreview) URL.revokeObjectURL(idProofPreview)
    }
  }, [avatarPreview, idProofPreview])

  // Step 1: Verify Worker Phone via MSG91 OTP Widget
  const handleVerifyWorkerPhone = async () => {
    setErrors({})
    setAlreadyRegisteredNotice(null)
    const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10)

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrors(prev => ({ ...prev, name: 'Please enter your full name (minimum 2 characters)' }))
      return
    }
    if (cleanPhone.length !== 10) {
      setErrors(prev => ({ ...prev, phone: 'Please enter a valid 10-digit mobile number' }))
      return
    }

    setVerifyingOtp(true)
    try {
      const launched = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async (accessToken: string) => {
          try {
            const authResult = await verifyAndLoginWithOtp(
              cleanPhone,
              accessToken,
              formData.name.trim(),
              formData.email.trim() || undefined
            )
            setPhoneVerified(true)
            setVerifyingOtp(false)
            setErrors({})
            if (authResult.role === 'worker') {
              navigate('/worker/dashboard')
              return
            }
            // Auto-advance to Step 2: Work Details
            setCurrentStep(1)
          } catch (e: any) {
            setVerifyingOtp(false)
            setErrors(prev => ({
              ...prev,
              phone: sanitizeErrorMessage(e, 'Verification failed. Please retry.'),
            }))
          }
        },
        onFailure: (err) => {
          setVerifyingOtp(false)
          setErrors(prev => ({
            ...prev,
            phone: typeof err === 'string' ? err : 'OTP verification cancelled or failed.',
          }))
        },
      })

      if (!launched) {
        setVerifyingOtp(false)
        setErrors(prev => ({
          ...prev,
          phone: 'OTP verification widget could not be loaded. Please ensure ad-blockers are disabled and try again.',
        }))
      }
    } catch (err) {
      setVerifyingOtp(false)
      setErrors(prev => ({ ...prev, phone: 'Could not open verification widget' }))
    }
  }

  // Google OAuth sign-in option for worker
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle(`${window.location.origin}/register-worker`)
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        form: err instanceof Error ? err.message : 'Google sign-in could not be initiated',
      }))
    }
  }

  const handleAvatarChange = (file?: File) => {
    if (!file) return
    const validation = validateFile(file, { maxSizeMb: 5 })
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, avatar: validation.error || 'Invalid file' }))
      return
    }
    setErrors(prev => {
      const next = { ...prev }
      delete next.avatar
      return next
    })
    setFormData(prev => ({ ...prev, avatar: file }))
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleIdProofChange = (file?: File) => {
    if (!file) return
    const isPdf = file.type === 'application/pdf'
    const validation = validateFile(file, {
      maxSizeMb: 10,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    })
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, idProof: validation.error || 'Invalid file' }))
      return
    }
    setErrors(prev => {
      const next = { ...prev }
      delete next.idProof
      return next
    })
    setFormData(prev => ({ ...prev, idProof: file }))
    setIdProofIsPdf(isPdf)
    if (idProofPreview) URL.revokeObjectURL(idProofPreview)
    if (!isPdf) {
      setIdProofPreview(URL.createObjectURL(file))
    } else {
      setIdProofPreview(null)
    }
  }

  const validateStep = () => {
    const newErrors: Record<string, string> = {}

    if (currentStep === 0) {
      if (!formData.name.trim() || formData.name.trim().length < 2) newErrors.name = 'Full name is mandatory (minimum 2 characters)'
      if (!formData.phone.trim()) newErrors.phone = 'Mobile number is required'
      else if (!/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Enter a valid 10-digit number'
      else if (!phoneVerified) newErrors.phone = 'Please verify your mobile number with OTP before continuing'
    }

    if (currentStep === 1) {
      if (selectedServices.length === 0) {
        newErrors.category = t('auth.workerRegistration.selectAtLeastOneService', 'Please select at least one work service (maximum 2)')
      } else if (selectedServices.length > 2) {
        newErrors.category = t('auth.workerRegistration.maxTwoServicesError', 'You can select a maximum of 2 services within this category.')
      } else if (selectedParentCategory) {
        const parentCategory = JUGNU_CATEGORIES.find(c => c.id === selectedParentCategory)
        const validServiceIds = new Set(parentCategory?.services.map(s => s.id) || [])
        const hasCrossCategory = selectedServices.some(sId => !validServiceIds.has(sId))
        if (hasCrossCategory) {
          newErrors.category = 'All selected services must belong to the selected parent category'
        }
      }
      if (!formData.experience) newErrors.experience = 'Experience is required'
      if (formData.areas.length === 0) newErrors.areas = 'Select at least one service area'
    }

    if (currentStep === 2) {
      if (!formData.idProof) newErrors.idProof = 'Government ID proof document is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep()) return

    setLoading(true)
    setErrors({})
    setUploadProgress('Uploading documents to secure storage...')

    try {
      // Ensure user session exists from Step 1 OTP verification
      const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10)
      const activeUser = user
      if (!activeUser || !activeUser.id) {
        throw new Error('Please verify your mobile number with OTP before submitting registration.')
      }

      let avatarUrl: string | undefined = undefined
      let idProofPath: string | undefined = undefined

      // 1. Upload ID Proof to private 'worker-documents' bucket
      if (formData.idProof) {
        setUploadProgress('Uploading ID proof to private storage...')
        idProofPath = await uploadIdProof(formData.idProof, activeUser.id)
      }

      // 2. Upload Avatar to public 'avatars' bucket (Optional)
      if (formData.avatar) {
        setUploadProgress('Uploading profile photo...')
        avatarUrl = await uploadAvatar(formData.avatar, activeUser.id)
      }

      // Enforce business rules before RPC dispatch
      if (selectedServices.length < 1 || selectedServices.length > 2) {
        throw new Error('A worker must select between 1 and 2 services')
      }
      if (selectedParentCategory) {
        const parentCategory = JUGNU_CATEGORIES.find(c => c.id === selectedParentCategory)
        const validServiceIds = new Set(parentCategory?.services.map(s => s.id) || [])
        if (selectedServices.some(sId => !validServiceIds.has(sId))) {
          throw new Error('Selected services belong to different categories')
        }
      }

      // 3. Register worker details via RPC
      setUploadProgress('Registering worker profile...')
      const supabase = getSupabaseClient()
      const primaryCategory = selectedServices[0] || formData.category

      const { error: rpcError } = await (supabase as any).rpc('register_worker', {
        worker_name: formData.name,
        worker_phone: `+91${cleanPhone}`,
        worker_bio: formData.bio,
        worker_experience: Number(formData.experience),
        worker_category_id: primaryCategory,
        worker_area_pincodes: formData.areas,
        worker_avatar_url: avatarUrl || null,
        worker_id_proof_url: idProofPath || null,
        worker_category_ids: selectedServices,
      })

      if (rpcError) {
        console.warn('RPC register_worker fallback triggered:', rpcError.message)
        const { error: legacyError } = await (supabase as any).rpc('register_worker', {
          worker_name: formData.name,
          worker_phone: `+91${cleanPhone}`,
          worker_bio: formData.bio,
          worker_experience: Number(formData.experience),
          worker_category_id: primaryCategory,
          worker_area_pincodes: formData.areas,
          worker_avatar_url: avatarUrl || null,
          worker_id_proof_url: idProofPath || null,
        })

        if (legacyError) throw legacyError

        if (avatarUrl) {
          await (supabase.from('profiles') as any).update({ avatar_url: avatarUrl }).eq('id', activeUser.id)
        }
        if (idProofPath) {
          await (supabase.from('worker_profiles') as any).update({ id_proof_url: idProofPath }).eq('id', activeUser.id)
        }

        // If worker selected multiple services, record additional services in worker_categories
        if (selectedServices.length > 1) {
          const additional = selectedServices.slice(1).map(catId => ({
            worker_id: activeUser.id,
            category_id: catId,
          }))
          try {
            await (supabase.from('worker_categories') as any).upsert(additional, { onConflict: 'worker_id,category_id' })
          } catch (multiErr) {
            console.warn('Additional services registration note:', multiErr)
          }
        }
      }

      // Notify platform administrators immediately
      await notifyAdminsOfWorkerRegistration({
        workerId: activeUser.id,
        workerName: formData.name,
        category: selectedServices.join(', '),
      })

      setSubmitted(true)
    } catch (submitErr) {
      setErrors({ form: sanitizeErrorMessage(submitErr, 'Unable to complete registration. Please try again.') })
    } finally {
      setLoading(false)
      setUploadProgress('')
    }
  }

  const handleNext = () => {
    if (validateStep() && currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md p-8 text-center bg-surface-100 border border-semantic-border-light shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-semantic-text-primary mb-2">
            {t('auth.workerRegistration.success', 'Registration Submitted!')}
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            {t('auth.workerRegistration.successDesc', 'Our team will verify your details and approve within 24 hours.')}
          </p>
          <div className="p-4 bg-surface-200/60 rounded-xl border border-semantic-border-light text-left text-xs text-semantic-text-secondary mb-6 space-y-1.5">
            <p className="font-semibold text-semantic-text-primary">{t('auth.workerRegistration.submissionSummary', 'Submission Summary:')}</p>
            <p>• {t('auth.workerRegistration.summaryName', 'Full Name')}: {formData.name}</p>
            <p>• {t('auth.workerRegistration.summaryMobile', 'Mobile Number')}: +91{formData.phone} ({t('auth.phoneVerified', 'Verified')})</p>
            <p>• {t('auth.workerRegistration.summaryCategory', 'Work Category')}: {selectedServices.length > 0 ? selectedServices.map(sId => getCategoryName(getServiceById(sId), i18n.language === 'hi' ? 'hi' : 'en') || sId).join(', ') : formData.category}</p>
            <p>• {t('auth.workerRegistration.summaryExperience', 'Experience')}: {formData.experience} {t('common.years', 'years')}</p>
            <p>• {t('auth.workerRegistration.summaryAreas', 'Service Areas')}: {formData.areas.join(', ')}</p>
            <p>• {t('auth.workerRegistration.summaryIdProof', 'ID Proof: Securely uploaded for verification')}</p>
            {formData.avatar && <p>• {t('auth.workerRegistration.summaryPhoto', 'Profile Photo: Uploaded')}</p>}
          </div>
          <Button variant="primary" onClick={() => navigate('/worker/dashboard')} className="w-full">
            {t('auth.workerRegistration.goToDashboard', 'Go to Worker Dashboard')}
          </Button>
        </Card>
      </div>
    )
  }

  const currentStepKey = STEPS[currentStep].key

  return (
    <div className="min-h-screen bg-semantic-bg-primary py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-semantic-text-secondary hover:text-semantic-text-primary mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back', 'Back')}
          </Link>
          <h1 className="text-2xl font-bold text-semantic-text-primary">
            {t('auth.workerRegistration.title', 'Worker Registration')}
          </h1>
          <p className="text-semantic-text-secondary mt-1">
            {t('auth.workerRegistration.subtitle', 'Register as a verified artisan or service professional in Muzaffarnagar.')}
          </p>
        </div>

        {/* Steps indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isCompleted = index < currentStep
              const isCurrent = index === currentStep
              return (
                <div key={step.key} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500 text-surface-950 font-bold'
                          : isCurrent
                          ? 'bg-brand-500 text-surface-950 font-bold ring-4 ring-brand-500/20'
                          : 'bg-surface-200 text-semantic-text-tertiary border border-semantic-border-light'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        isCurrent
                          ? 'text-brand-400 font-semibold'
                          : isCompleted
                          ? 'text-semantic-text-primary'
                          : 'text-semantic-text-tertiary'
                      }`}
                    >
                      {t(step.labelKey, step.fallback)}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        index < currentStep ? 'bg-emerald-500' : 'bg-surface-300'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Form Card */}
        <Card className="p-8 bg-surface-100 border border-semantic-border-light shadow-xl">
          {alreadyRegisteredNotice && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5 text-amber-300 text-xs">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-300 mb-0.5 text-sm">
                    {t('auth.alreadyRegisteredTitle', 'Mobile Number Already Registered')}
                  </p>
                  <p className="text-amber-200/90 leading-relaxed">
                    {alreadyRegisteredNotice.message ||
                      t('auth.alreadyRegisteredDesc', 'An account already exists with mobile number +91 {{phone}}. You cannot register again with this number. Please sign in instead.', { phone: alreadyRegisteredNotice.phone })}
                  </p>
                </div>
              </div>
              <div className="pt-1">
                <Link
                  to={`/login?role=worker&phone=${alreadyRegisteredNotice.phone}`}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold text-xs shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Lock className="w-4 h-4" />
                  <span>{t('auth.goToWorkerLogin', 'Sign In to Worker Dashboard')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {errors.form && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          {uploadProgress && (
            <div className="mb-6 p-4 bg-brand-500/10 border border-brand-500/30 rounded-lg flex items-center gap-3 text-brand-300 text-sm">
              <UploadCloud className="w-5 h-5 animate-pulse text-brand-400" />
              <span>{uploadProgress}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* STEP 1: PERSONAL INFO (ONLY NAME, PHONE, AND LIVE OTP VERIFICATION) */}
            {currentStepKey === 'personal' && (
              <div className="space-y-5">
                <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                  <p className="text-xs text-brand-300">
                    {t('auth.workerRegistration.step1Notice', 'Step 1 requires your Full Name and a verified Mobile Number. Mobile verification protects customers and ensures job notifications reach you.')}
                  </p>
                </div>

                <Input
                  label={t('auth.workerRegistration.fullName', 'Full Name')}
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('auth.workerRegistration.namePlaceholder', 'Enter your full name')}
                  error={errors.name}
                  required
                  autoFocus
                />

                <div>
                  <Input
                    label={t('auth.phoneLabel', 'Mobile Number')}
                    value={formData.phone}
                    onChange={e => {
                      setFormData(prev => ({
                        ...prev,
                        phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                      }))
                      setPhoneVerified(false)
                      if (alreadyRegisteredNotice) setAlreadyRegisteredNotice(null)
                    }}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                    error={errors.phone}
                    required
                  />
                  <p className="mt-1 text-xs text-semantic-text-tertiary">
                    {t('auth.workerRegistration.phoneHint', 'Enter your 10-digit Indian mobile number')}
                  </p>
                </div>

                {/* Optional Email Address */}
                <div>
                  <Input
                    label={t('auth.workerRegistration.emailLabel', 'Email / Gmail Address (Optional)')}
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={t('auth.workerRegistration.emailPlaceholder', 'name@gmail.com')}
                    leftIcon={<Mail className="w-5 h-5 text-semantic-text-tertiary" />}
                  />
                  <p className="mt-1 text-xs text-semantic-text-tertiary">
                    {t('auth.workerRegistration.emailHint', 'Optional: For registration confirmation, receipts, and admin notices.')}
                  </p>
                </div>


                {/* Verification Trigger or Verified Badge */}
                {phoneVerified ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-400">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{t('auth.workerRegistration.phoneVerified', 'Mobile Number Verified')}</p>
                        <p className="text-xs text-emerald-300/80">+91{formData.phone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhoneVerified(false)}
                      className="text-xs text-emerald-300/70 hover:text-emerald-200 underline"
                    >
                      {t('auth.workerRegistration.changeNumber', 'Change Number')}
                    </button>
                  </div>
                ) : (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full py-2.5"
                      onClick={handleVerifyWorkerPhone}
                      loading={verifyingOtp}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      {t('auth.workerRegistration.verifyPhoneBtn', 'Verify Mobile Number with OTP')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: WORK DETAILS */}
            {currentStepKey === 'work' && (
              <div className="space-y-6">
                {/* UNIFIED CATEGORY & MULTI-SERVICE SELECTION */}
                <div>
                  <div className="mb-3">
                    <label className="label text-semantic-text-secondary block font-bold text-sm">
                      {t('auth.workerRegistration.selectTradeCategory', 'Select Your Primary Trade Category')} *
                    </label>
                    <p className="text-xs text-semantic-text-tertiary mt-0.5">
                      {t(
                        'auth.workerRegistration.selectCategorySubtitle',
                        'Choose 1 trade category below. You can then select 1 or 2 services within this category.'
                      )}
                    </p>
                  </div>

                  {/* 5 Parent Categories Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                    {JUGNU_CATEGORIES.map(category => {
                      const CatIcon = categoryIconMap[category.icon] || Wrench
                      const isHindiLang = i18n.language === 'hi'
                      const primaryName = isHindiLang ? category.name_hi : category.name_en
                      const secondaryName = isHindiLang ? category.name_en : category.name_hi
                      const isCategoryActive = selectedParentCategory === category.id
                      const selectedCount = isCategoryActive ? selectedServices.length : 0

                      return (
                        <div
                          key={category.id}
                          onClick={() => handleSelectParentCategory(category.id)}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none group ${
                            isCategoryActive
                              ? 'border-brand-500 bg-brand-500/15 ring-2 ring-brand-500/30 shadow-md'
                              : 'border-semantic-border-light bg-surface-200/50 hover:bg-surface-200 hover:border-brand-500/40 shadow-xs'
                          }`}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                                isCategoryActive
                                  ? 'bg-brand-500 text-surface-950 font-bold border-brand-500 shadow-sm'
                                  : 'bg-brand-500/10 text-brand-400 border-brand-500/25 group-hover:scale-105'
                              }`}
                            >
                              <CatIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-sm font-bold text-semantic-text-primary truncate">
                                  {primaryName}
                                </h4>
                                {isCategoryActive && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-brand-500/30 text-brand-300 border border-brand-500/40">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-semantic-text-tertiary truncate mt-0.5">
                                {secondaryName}
                              </p>
                            </div>
                          </div>

                          {selectedCount > 0 ? (
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 ml-2">
                              {selectedCount} / 2
                            </span>
                          ) : (
                            <ArrowRight
                              className={`w-4 h-4 shrink-0 ml-2 transition-transform ${
                                isCategoryActive
                                  ? 'text-brand-400 translate-x-0.5'
                                  : 'text-semantic-text-tertiary group-hover:text-brand-400'
                              }`}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Category Switched Notice Banner */}
                  {categorySwitchedNotice && (
                    <div className="mb-4 p-3 bg-blue-500/15 border border-blue-500/30 rounded-xl flex items-start gap-2.5 text-blue-300 text-xs">
                      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-1 font-medium">{categorySwitchedNotice}</div>
                      <button
                        type="button"
                        onClick={() => setCategorySwitchedNotice(null)}
                        className="text-blue-400 hover:text-white cursor-pointer"
                        aria-label="Dismiss notice"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Services Selection Box */}
                  {selectedParentCategory ? (
                    (() => {
                      const activeCategory = JUGNU_CATEGORIES.find(c => c.id === selectedParentCategory)!
                      const isHindiLang = i18n.language === 'hi'
                      const categoryPrimary = isHindiLang ? activeCategory.name_hi : activeCategory.name_en

                      return (
                        <div className="p-4 sm:p-5 rounded-2xl bg-surface-200/60 border border-brand-500/30 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-semantic-border-light">
                            <div>
                              <h4 className="text-sm font-bold text-semantic-text-primary flex items-center gap-2">
                                <span>Services in {categoryPrimary}:</span>
                                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                                  {selectedServices.length} / 2 Selected
                                </span>
                              </h4>
                              <p className="text-xs text-semantic-text-tertiary mt-0.5">
                                {selectedServices.length === 0
                                  ? 'Select 1 or 2 services you provide (Maximum 2)'
                                  : selectedServices.length === 1
                                  ? '✓ 1 service selected. You can select 1 more service from this list.'
                                  : '✓ Maximum 2 services selected.'}
                              </p>
                            </div>

                            <span className="text-[11px] font-semibold text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 self-start sm:self-auto">
                              Max 2 services allowed
                            </span>
                          </div>

                          {/* 3rd Service Limit Warning */}
                          {serviceLimitMessage && (
                            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
                              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="flex-1 font-semibold">{serviceLimitMessage}</div>
                              <button
                                type="button"
                                onClick={() => setServiceLimitMessage(null)}
                                className="text-amber-400/80 hover:text-white cursor-pointer"
                                aria-label="Dismiss warning"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Selected Services Chips Bar */}
                          {selectedServices.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-surface-150/70 border border-semantic-border-light">
                              <span className="text-xs font-bold text-semantic-text-secondary mr-1">
                                Selected:
                              </span>
                              {selectedServices.map((svcId, idx) => {
                                const svc = getServiceById(svcId)
                                const name = svc ? (isHindiLang ? svc.name_hi : svc.name_en) : svcId
                                return (
                                  <span
                                    key={svcId}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 shadow-xs"
                                  >
                                    <span className="text-[10px] bg-emerald-500 text-surface-950 px-1.5 py-0.2 rounded font-black">
                                      Service {idx + 1}
                                    </span>
                                    <span>{name}</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleServiceSelection(svcId)}
                                      className="hover:text-white cursor-pointer ml-1 text-emerald-400 transition-colors"
                                      title={`Remove ${name}`}
                                      aria-label={`Remove ${name}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          {/* Services Checklist */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {activeCategory.services.map(service => {
                              const isSelected = selectedServices.includes(service.id)
                              const selectedIndex = selectedServices.indexOf(service.id)
                              const ServiceIcon = categoryIconMap[service.icon] || Wrench
                              const servicePrimary = isHindiLang ? service.name_hi : service.name_en
                              const serviceSecondary = isHindiLang ? service.name_en : service.name_hi

                              return (
                                <div
                                  key={service.id}
                                  onClick={() => toggleServiceSelection(service.id)}
                                  className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none ${
                                    isSelected
                                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-500/30 font-semibold shadow-sm'
                                      : selectedServices.length >= 2
                                      ? 'border-semantic-border-light bg-surface-150/40 opacity-60 hover:opacity-100 hover:border-amber-500/50 text-semantic-text-secondary'
                                      : 'border-semantic-border-light bg-surface-150/80 hover:bg-surface-200 hover:border-brand-500/50 text-semantic-text-secondary'
                                  }`}
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  tabIndex={0}
                                >
                                  <div
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? 'bg-emerald-500 border-emerald-500 text-surface-950 font-bold'
                                        : 'border-slate-500 dark:border-zinc-500 bg-transparent'
                                    }`}
                                  >
                                    {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : null}
                                  </div>

                                  <div className="w-8 h-8 rounded-lg bg-surface-200/80 border border-semantic-border-light flex items-center justify-center text-semantic-text-secondary shrink-0">
                                    <ServiceIcon className="w-4 h-4" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-bold text-semantic-text-primary truncate">
                                        {servicePrimary}
                                      </p>
                                      {isSelected && (
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                                          Service {selectedIndex + 1}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-semantic-text-tertiary truncate">
                                      {serviceSecondary}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="pt-2 flex items-start gap-2 text-[11px] text-semantic-text-tertiary leading-relaxed">
                            <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                            <span>
                              <strong>Category Rule:</strong> You can select 1 or 2 services. All services must belong to the selected trade category. To switch to another category, click it above (previous selections will be reset).
                            </span>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="p-6 rounded-2xl bg-surface-200/40 border border-dashed border-semantic-border-light text-center">
                      <p className="text-xs font-semibold text-semantic-text-secondary">
                        👆 Tap a trade category above to view and select up to 2 services.
                      </p>
                    </div>
                  )}

                  {errors.category && (
                    <p className="mt-2 text-xs text-red-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{errors.category}</span>
                    </p>
                  )}
                </div>

                <Input
                  label={t('auth.workerRegistration.experience', 'Years of Experience')}
                  type="number"
                  min="0"
                  max="50"
                  value={formData.experience}
                  onChange={e => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                  placeholder={t('auth.workerRegistration.experiencePlaceholder', 'e.g. 5')}
                  error={errors.experience}
                  required
                />

                <div>
                  <label className="label text-semantic-text-secondary mb-1 block">
                    {t('auth.workerRegistration.bio', 'Short Bio')}
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder={t('auth.workerRegistration.bioPlaceholder', 'Tell customers about your skills, specialties, and tools...')}
                    rows={3}
                    className="w-full rounded-lg bg-surface-200 border border-semantic-border-light p-3 text-sm text-semantic-text-primary placeholder:text-semantic-text-tertiary focus:border-brand-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-semantic-text-tertiary">{t('common.optional', 'Optional')}</p>
                </div>

                <div>
                  <label className="label text-semantic-text-secondary mb-2 block">
                    {t('auth.workerRegistration.serviceAreas', 'Service Areas')} {t('auth.workerRegistration.selectAtLeastOne', '(Select at least one)')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MUZAFFARNAGAR_PINCODES.map(pincode => (
                      <Badge
                        key={pincode}
                        variant={formData.areas.includes(pincode) ? 'primary' : 'outline'}
                        className="cursor-pointer py-1.5 px-3 text-xs"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            areas: prev.areas.includes(pincode)
                              ? prev.areas.filter(a => a !== pincode)
                              : [...prev.areas, pincode],
                          }))
                        }}
                      >
                        {pincode}
                      </Badge>
                    ))}
                  </div>
                  {errors.areas && <p className="mt-1 text-xs text-red-400">{errors.areas}</p>}
                </div>
              </div>
            )}

            {/* STEP 3: DOCUMENTS */}
            {currentStepKey === 'documents' && (
              <div className="space-y-6">
                <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 bg-brand-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-brand-400 text-sm">
                      {t('auth.workerRegistration.govtIdTitle', 'Government ID Verification')}
                    </h4>
                    <p className="text-xs text-semantic-text-secondary mt-1">
                      {t('auth.workerRegistration.govtIdDesc', 'Upload a clear photo or PDF of your Aadhaar card or Voter ID. Your document is stored in a strictly private storage bucket and accessible exclusively to administrators for verification.')}
                    </p>
                  </div>
                </div>

                {/* ID Proof Upload */}
                <div>
                  <label className="label text-semantic-text-secondary mb-1 block">
                    {t('auth.workerRegistration.idProof', 'ID Proof')} {t('auth.workerRegistration.requiredBadge', '(Required)')}
                  </label>
                  <div className="border-2 border-dashed border-semantic-border-light hover:border-brand-500 bg-surface-200/40 rounded-xl p-6 text-center transition-colors">
                    {formData.idProof ? (
                      <div className="flex flex-col items-center">
                        {idProofPreview ? (
                          <img
                            src={idProofPreview}
                            alt="ID Preview"
                            className="max-h-40 rounded-lg object-contain border border-semantic-border-light mb-2"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center mb-2">
                            <FileText className="w-8 h-8 text-red-400" />
                          </div>
                        )}
                        <p className="text-sm font-medium text-semantic-text-primary">{formData.idProof.name}</p>
                        <p className="text-xs text-semantic-text-tertiary mt-0.5">
                          {(formData.idProof.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, idProof: null }))
                            setIdProofPreview(null)
                          }}
                          className="text-xs text-red-400 hover:text-red-300 mt-2 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> {t('auth.workerRegistration.removeDoc', 'Remove document')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          id="idproof-upload"
                          onChange={e => handleIdProofChange(e.target.files?.[0])}
                        />
                        <label htmlFor="idproof-upload" className="cursor-pointer flex flex-col items-center gap-2">
                          <IdCard className="w-10 h-10 text-semantic-text-tertiary" />
                          <span className="text-semantic-text-secondary text-sm">
                            {t('auth.workerRegistration.clickUploadId', 'Click to upload Aadhaar or Voter ID')}
                          </span>
                          <span className="text-xs text-semantic-text-tertiary">
                            {t('auth.workerRegistration.idFormatHint', 'JPG, PNG, PDF up to 10MB')}
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  {errors.idProof && <p className="mt-1 text-xs text-red-400">{errors.idProof}</p>}
                </div>

                {/* Profile Photo (Optional) */}
                <div>
                  <label className="label text-semantic-text-secondary mb-1 block">
                    {t('auth.workerRegistration.photo', 'Profile Photo')} ({t('common.optional', 'Optional')})
                  </label>
                  <div className="border-2 border-dashed border-semantic-border-light hover:border-brand-500 bg-surface-200/40 rounded-xl p-6 text-center transition-colors">
                    {formData.avatar ? (
                      <div className="flex flex-col items-center">
                        {avatarPreview && (
                          <img
                            src={avatarPreview}
                            alt="Avatar Preview"
                            className="w-24 h-24 rounded-full object-cover border-2 border-brand-500 mb-2"
                          />
                        )}
                        <p className="text-sm font-medium text-semantic-text-primary">{formData.avatar.name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, avatar: null }))
                            setAvatarPreview(null)
                          }}
                          className="text-xs text-red-400 hover:text-red-300 mt-2 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> {t('auth.workerRegistration.removePhoto', 'Remove photo')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="avatar-upload"
                          onChange={e => handleAvatarChange(e.target.files?.[0])}
                        />
                        <label htmlFor="avatar-upload" className="cursor-pointer flex flex-col items-center gap-2">
                          <Image className="w-10 h-10 text-semantic-text-tertiary" />
                          <span className="text-semantic-text-secondary text-sm">
                            {t('auth.workerRegistration.clickUploadPhoto', 'Click to upload profile photo')}
                          </span>
                          <span className="text-xs text-semantic-text-tertiary">
                            {t('auth.workerRegistration.photoFormatHint', 'JPG, PNG up to 5MB')}
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  {errors.avatar && <p className="mt-1 text-xs text-red-400">{errors.avatar}</p>}
                </div>

                <div className="p-4 bg-surface-200/60 border border-semantic-border-light rounded-xl">
                  <h4 className="font-semibold text-semantic-text-primary mb-2 text-sm">
                    {t('auth.workerRegistration.whatHappensNext', 'What happens next?')}
                  </h4>
                  <ul className="text-xs text-semantic-text-secondary space-y-1.5">
                    <li>{t('auth.workerRegistration.nextStep1', '• Our team reviews your ID document within 24 hours.')}</li>
                    <li>{t('auth.workerRegistration.nextStep2', '• You will receive an automated notification once approved.')}</li>
                    <li>{t('auth.workerRegistration.nextStep3', '• Your profile will appear in the Muzaffarnagar public worker directory.')}</li>
                    <li>{t('auth.workerRegistration.nextStep4', '• 0% commission on bookings for the starting 3 months.')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-8 flex gap-3">
              {currentStep > 0 && (
                <Button type="button" variant="secondary" onClick={handleBack} className="flex-1" disabled={loading}>
                  {t('common.back', 'Back')}
                </Button>
              )}
              {currentStep < STEPS.length - 1 ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleNext}
                  className="flex-1"
                  disabled={currentStep === 0 && !phoneVerified}
                >
                  {t('common.next', 'Next')}
                </Button>
              ) : (
                <Button type="submit" variant="primary" className="flex-1" loading={loading}>
                  {loading ? uploadProgress || 'Submitting...' : t('auth.workerRegistration.submit', 'Submit for Approval')}
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

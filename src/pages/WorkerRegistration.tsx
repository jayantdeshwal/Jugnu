import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { Button, Input, Card, Badge } from '@kaamgar/ui'
import { CATEGORIES, MUZAFFARNAGAR_PINCODES, getCategoryName } from '@kaamgar/shared'
import {
  ArrowLeft,
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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { uploadAvatar, uploadIdProof, validateFile } from '@/services/storage'
import { notifyAdminsOfWorkerRegistration } from '@/services/admin'
import { openOtpWidget } from '@/services/otp'

const STEPS = [
  { key: 'personal', label: 'Personal Info', icon: User },
  { key: 'work', label: 'Work Details', icon: Briefcase },
  { key: 'documents', label: 'Documents', icon: IdCard },
]

export default function WorkerRegistration() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loginWithVerifiedPhone, signInWithGoogle } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)

  // Initialize form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '',
    email: user?.email || '',
    category: '',
    experience: '',
    bio: '',
    areas: [] as string[],
    avatar: null as File | null,
    idProof: null as File | null,
  })

  // Track phone verification status
  const [phoneVerified, setPhoneVerified] = useState(
    !!(user?.phone && user.phone.trim().length >= 10)
  )
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [idProofPreview, setIdProofPreview] = useState<string | null>(null)
  const [idProofIsPdf, setIdProofIsPdf] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [submitted, setSubmitted] = useState(false)

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
    const cleanPhone = formData.phone.replace(/\D/g, '')

    if (!formData.name.trim()) {
      setErrors(prev => ({ ...prev, name: 'Please enter your full name' }))
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
        onSuccess: async () => {
          setPhoneVerified(true)
          setVerifyingOtp(false)
          setErrors({})
          try {
            await loginWithVerifiedPhone(formData.name.trim(), cleanPhone, 'worker', formData.email.trim() || undefined)
          } catch (e) {
            console.warn('Session init warning:', e)
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
      if (!formData.name.trim()) newErrors.name = 'Full name is required'
      if (!formData.phone.trim()) newErrors.phone = 'Mobile number is required'
      else if (!/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Enter a valid 10-digit number'
      else if (!phoneVerified) newErrors.phone = 'Please verify your mobile number with OTP before continuing'
    }

    if (currentStep === 1) {
      if (!formData.category) newErrors.category = 'Select a work category'
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
      // Ensure user session exists
      const cleanPhone = formData.phone.replace(/\D/g, '')
      let activeUser = user
      if (!activeUser || !activeUser.id) {
        activeUser = await loginWithVerifiedPhone(formData.name.trim(), cleanPhone, 'worker')
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

      // 3. Register worker details via RPC
      setUploadProgress('Registering worker profile...')
      const supabase = getSupabaseClient()

      const { error: rpcError } = await (supabase as any).rpc('register_worker', {
        worker_name: formData.name,
        worker_phone: `+91${cleanPhone}`,
        worker_bio: formData.bio,
        worker_experience: Number(formData.experience),
        worker_category_id: formData.category,
        worker_area_pincodes: formData.areas,
        worker_avatar_url: avatarUrl || null,
        worker_id_proof_url: idProofPath || null,
      })

      if (rpcError) {
        console.warn('RPC register_worker fallback triggered:', rpcError.message)
        const { error: legacyError } = await (supabase as any).rpc('register_worker', {
          worker_name: formData.name,
          worker_phone: `+91${cleanPhone}`,
          worker_bio: formData.bio,
          worker_experience: Number(formData.experience),
          worker_category_id: formData.category,
          worker_area_pincodes: formData.areas,
        })

        if (legacyError) throw legacyError

        if (avatarUrl) {
          await (supabase.from('profiles') as any).update({ avatar_url: avatarUrl }).eq('id', activeUser.id)
        }
        if (idProofPath) {
          await (supabase.from('worker_profiles') as any).update({ id_proof_url: idProofPath }).eq('id', activeUser.id)
        }
      }

      // Notify platform administrators immediately
      await notifyAdminsOfWorkerRegistration({
        workerId: activeUser.id,
        workerName: formData.name,
        category: formData.category,
      })

      setSubmitted(true)
    } catch (submitErr) {
      setErrors({ form: submitErr instanceof Error ? submitErr.message : 'Unable to complete registration' })
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
            <p className="font-semibold text-semantic-text-primary">Submission Summary:</p>
            <p>• Full Name: {formData.name}</p>
            <p>• Mobile Number: +91{formData.phone} (Verified)</p>
            <p>• Work Category: {formData.category}</p>
            <p>• Experience: {formData.experience} years</p>
            <p>• Service Areas: {formData.areas.join(', ')}</p>
            <p>• ID Proof: Securely uploaded for verification</p>
            {formData.avatar && <p>• Profile Photo: Uploaded</p>}
          </div>
          <Button variant="primary" onClick={() => navigate('/worker/dashboard')} className="w-full">
            Go to Worker Dashboard
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
            Register as a verified artisan or service professional in Muzaffarnagar.
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
                      {step.label}
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
                    Step 1 requires your <strong>Full Name</strong> and a verified <strong>Mobile Number</strong>. Mobile verification protects customers and ensures job notifications reach you.
                  </p>
                </div>

                <Input
                  label={t('auth.workerRegistration.fullName', 'Full Name')}
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
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
                    }}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                    error={errors.phone}
                    required
                  />
                  <p className="mt-1 text-xs text-semantic-text-tertiary">
                    Enter your 10-digit Indian mobile number
                  </p>
                </div>

                {/* Optional Email Address */}
                <div>
                  <Input
                    label="Email / Gmail Address (Optional)"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="name@gmail.com"
                    leftIcon={<Mail className="w-5 h-5 text-semantic-text-tertiary" />}
                  />
                  <p className="mt-1 text-xs text-semantic-text-tertiary">
                    Optional: For registration confirmation, receipts, and admin notices.
                  </p>
                </div>

                {/* Verification Trigger or Verified Badge */}
                {phoneVerified ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-400">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Mobile Number Verified</p>
                        <p className="text-xs text-emerald-300/80">+91{formData.phone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhoneVerified(false)}
                      className="text-xs text-emerald-300/70 hover:text-emerald-200 underline"
                    >
                      Change Number
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
                      Verify Mobile Number with OTP
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: WORK DETAILS */}
            {currentStepKey === 'work' && (
              <div className="space-y-6">
                <div>
                  <label className="label text-semantic-text-secondary mb-2 block">
                    {t('auth.workerRegistration.category', 'Work Category')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {CATEGORIES.map(cat => {
                      const isSelected = formData.category === cat.id
                      return (
                        <div
                          key={cat.id}
                          onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                          className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${
                            isSelected
                              ? 'border-brand-500 bg-brand-500/10 text-brand-400 ring-2 ring-brand-500/20 font-bold'
                              : 'border-semantic-border-light bg-surface-200/50 text-semantic-text-secondary hover:border-brand-500/50'
                          }`}
                        >
                          <p className="font-medium text-sm text-semantic-text-primary capitalize">
                            {getCategoryName(cat, 'en')}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category}</p>}
                </div>

                <Input
                  label={t('auth.workerRegistration.experience', 'Years of Experience')}
                  type="number"
                  min="0"
                  max="50"
                  value={formData.experience}
                  onChange={e => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                  placeholder="e.g. 5"
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
                    placeholder="Tell customers about your skills, specialties, and tools..."
                    rows={3}
                    className="w-full rounded-lg bg-surface-200 border border-semantic-border-light p-3 text-sm text-semantic-text-primary placeholder:text-semantic-text-tertiary focus:border-brand-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-semantic-text-tertiary">{t('common.optional', 'Optional')}</p>
                </div>

                <div>
                  <label className="label text-semantic-text-secondary mb-2 block">
                    {t('auth.workerRegistration.serviceAreas', 'Service Areas')} (Select at least one)
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
                    <h4 className="font-semibold text-brand-400 text-sm">Government ID Verification</h4>
                    <p className="text-xs text-semantic-text-secondary mt-1">
                      Upload a clear photo or PDF of your Aadhaar card or Voter ID. Your document is stored in a{' '}
                      <strong>strictly private</strong> storage bucket and accessible exclusively to administrators for verification.
                    </p>
                  </div>
                </div>

                {/* ID Proof Upload */}
                <div>
                  <label className="label text-semantic-text-secondary mb-1 block">
                    {t('auth.workerRegistration.idProof', 'ID Proof')} (Required)
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
                          <X className="w-3.5 h-3.5" /> Remove document
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
                            Click to upload Aadhaar or Voter ID
                          </span>
                          <span className="text-xs text-semantic-text-tertiary">
                            JPG, PNG, PDF up to 10MB
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
                          <X className="w-3.5 h-3.5" /> Remove photo
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
                            Click to upload profile photo
                          </span>
                          <span className="text-xs text-semantic-text-tertiary">JPG, PNG up to 5MB</span>
                        </label>
                      </>
                    )}
                  </div>
                  {errors.avatar && <p className="mt-1 text-xs text-red-400">{errors.avatar}</p>}
                </div>

                <div className="p-4 bg-surface-200/60 border border-semantic-border-light rounded-xl">
                  <h4 className="font-semibold text-semantic-text-primary mb-2 text-sm">What happens next?</h4>
                  <ul className="text-xs text-semantic-text-secondary space-y-1.5">
                    <li>• Our team reviews your ID document within 24 hours.</li>
                    <li>• You will receive an automated notification once approved.</li>
                    <li>• Your profile will appear in the Muzaffarnagar public worker directory.</li>
                    <li>• Zero commission on bookings during the introductory pilot.</li>
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

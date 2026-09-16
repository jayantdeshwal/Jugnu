import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, Button, Input, Badge } from '@kaamgar/ui'
import { CATEGORIES, MUZAFFARNAGAR_PINCODES, getCategoryName } from '@kaamgar/shared'
import {
  User,
  Truck,
  Phone,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Briefcase,
  IdCard,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  FileText,
  X,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { uploadIdProof, validateFile } from '@/services/storage'
import { notifyAdminsOfWorkerRegistration } from '@/services/admin'
import { openOtpWidget } from '@/services/otp'
import { checkPhoneRegistration } from '@/services/authCheck'

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'worker' ? 'worker' : 'customer'
  const [activeTab, setActiveTab] = useState<'customer' | 'worker'>(initialRole)

  const { registerWithPhone } = useAuth()

  const queryPhone = (searchParams.get('phone') || '').replace(/\D/g, '').slice(-10)

  // ---------------- Customer State ----------------
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState(queryPhone)
  const [customerPassword, setCustomerPassword] = useState('')
  const [customerConfirmPassword, setCustomerConfirmPassword] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')

  // ---------------- Worker State ----------------
  const [workerName, setWorkerName] = useState('')
  const [workerPhone, setWorkerPhone] = useState(queryPhone)
  const [workerPassword, setWorkerPassword] = useState('')
  const [workerConfirmPassword, setWorkerConfirmPassword] = useState('')
  const [workerCategory, setWorkerCategory] = useState('')
  const [workerAreas, setWorkerAreas] = useState<string[]>([])
  const [workerExperience, setWorkerExperience] = useState('')
  const [workerIdProof, setWorkerIdProof] = useState<File | null>(null)
  const [workerIdPreview, setWorkerIdPreview] = useState<string | null>(null)
  const [workerIdIsPdf, setWorkerIdIsPdf] = useState(false)
  const [workerLoading, setWorkerLoading] = useState(false)
  const [workerProgress, setWorkerProgress] = useState('')
  const [workerError, setWorkerError] = useState('')

  // ---------------- Already Registered Warning ----------------
  const [alreadyRegisteredNotice, setAlreadyRegisteredNotice] = useState<{
    phone: string
    role: 'customer' | 'worker' | 'admin'
    message?: string
  } | null>(null)

  // Toggle service area pincode selection
  const toggleArea = (pincode: string) => {
    setWorkerAreas(prev =>
      prev.includes(pincode) ? prev.filter(p => p !== pincode) : [...prev, pincode]
    )
  }

  // Handle ID Proof file selection
  const handleIdFileChange = (file?: File) => {
    if (!file) return
    const isPdf = file.type === 'application/pdf'
    const validation = validateFile(file, {
      maxSizeMb: 10,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    })
    if (!validation.valid) {
      setWorkerError(validation.error || 'Invalid document file')
      return
    }
    setWorkerError('')
    setWorkerIdProof(file)
    setWorkerIdIsPdf(isPdf)
    if (workerIdPreview) URL.revokeObjectURL(workerIdPreview)
    if (!isPdf) {
      setWorkerIdPreview(URL.createObjectURL(file))
    } else {
      setWorkerIdPreview(null)
    }
  }

  // ---------------- Customer Sign Up Submit ----------------
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError('')
    setAlreadyRegisteredNotice(null)

    const cleanName = customerName.trim()
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10)

    if (!cleanName || cleanName.length < 2) {
      setCustomerError('Full Name is mandatory (minimum 2 characters)')
      return
    }
    if (cleanPhone.length !== 10) {
      setCustomerError('Please enter a valid 10-digit Indian mobile number')
      return
    }
    if (!customerPassword || customerPassword.length < 6) {
      setCustomerError('Password must be at least 6 characters long')
      return
    }
    if (customerPassword !== customerConfirmPassword) {
      setCustomerError('Passwords do not match')
      return
    }

    setCustomerLoading(true)
    try {
      // 1. Strict pre-check: verify phone is NOT already registered
      const check = await checkPhoneRegistration(cleanPhone)
      if (check.isRegistered) {
        setCustomerLoading(false)
        setAlreadyRegisteredNotice({
          phone: cleanPhone,
          role: check.role || 'customer',
          message: `An account is already registered with mobile number +91 ${cleanPhone}. You cannot register again with this number. Please sign in instead.`
        })
        return
      }

      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await registerWithPhone(
              cleanName,
              cleanPhone,
              'customer',
              customerEmail.trim() || undefined,
              customerPassword
            )
            navigate('/')
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Registration failed after OTP verification'
            if (msg.toLowerCase().includes('already registered')) {
              setAlreadyRegisteredNotice({
                phone: cleanPhone,
                role: 'customer',
                message: msg
              })
            } else {
              setCustomerError(msg)
            }
          } finally {
            setCustomerLoading(false)
          }
        },
        onFailure: (err) => {
          setCustomerLoading(false)
          setCustomerError(
            typeof err === 'string'
              ? err
              : 'OTP verification failed or was cancelled. Please verify to complete sign up.'
          )
        },
      })

      if (!widgetOpened) {
        setCustomerLoading(false)
        setCustomerError('OTP verification widget could not be loaded. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setCustomerLoading(false)
      setCustomerError('Unable to launch OTP verification. Please retry.')
    }
  }

  // ---------------- Worker Sign Up Submit ----------------
  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWorkerError('')
    setAlreadyRegisteredNotice(null)

    const cleanName = workerName.trim()
    const cleanPhone = workerPhone.replace(/\D/g, '').slice(-10)

    if (!cleanName || cleanName.length < 2) {
      setWorkerError('Full Name is mandatory (minimum 2 characters)')
      return
    }
    if (cleanPhone.length !== 10) {
      setWorkerError('Please enter a valid 10-digit Indian mobile number')
      return
    }
    if (!workerPassword || workerPassword.length < 6) {
      setWorkerError('Password must be at least 6 characters long')
      return
    }
    if (workerPassword !== workerConfirmPassword) {
      setWorkerError('Passwords do not match')
      return
    }
    if (!workerCategory) {
      setWorkerError('Please select your trade / work category')
      return
    }
    if (workerAreas.length === 0) {
      setWorkerError('Please select at least one service area in Muzaffarnagar')
      return
    }
    if (!workerExperience || Number(workerExperience) < 0) {
      setWorkerError('Please provide your experience in years')
      return
    }
    if (!workerIdProof) {
      setWorkerError('Government ID proof document is mandatory for worker verification')
      return
    }

    setWorkerLoading(true)
    setWorkerProgress('Checking registration status...')

    try {
      // 1. Strict pre-check: verify phone is NOT already registered as worker
      const check = await checkPhoneRegistration(cleanPhone)
      if (check.isRegistered) {
        setWorkerLoading(false)
        setWorkerProgress('')
        setAlreadyRegisteredNotice({
          phone: cleanPhone,
          role: check.role || 'worker',
          message: `An account is already registered with mobile number +91 ${cleanPhone}. You cannot register again with this number. Please sign in instead.`
        })
        return
      }

      setWorkerProgress('Initiating mobile verification...')
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            setWorkerProgress('Creating worker account...')
            const userSession = await registerWithPhone(
              cleanName,
              cleanPhone,
              'worker',
              undefined,
              workerPassword
            )

            setWorkerProgress('Uploading ID proof document securely...')
            let idProofPath: string | undefined = undefined
            if (workerIdProof) {
              idProofPath = await uploadIdProof(workerIdProof, userSession.id)
            }

            setWorkerProgress('Registering professional worker profile...')
            const supabase = getSupabaseClient()
            const { error: rpcErr } = await (supabase as any).rpc('register_worker', {
              worker_name: cleanName,
              worker_phone: `+91${cleanPhone}`,
              worker_bio: `Experienced ${workerCategory} professional serving Muzaffarnagar.`,
              worker_experience: Number(workerExperience),
              worker_category_id: workerCategory,
              worker_area_pincodes: workerAreas,
              worker_avatar_url: null,
              worker_id_proof_url: idProofPath || null,
            })

            if (rpcErr) {
              console.warn('Fallback worker profile registration:', rpcErr.message)
            }

            void notifyAdminsOfWorkerRegistration({
              workerId: userSession.id,
              workerName: cleanName,
              category: workerCategory,
            })

            navigate('/worker/dashboard')
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Worker registration failed. Please retry.'
            if (msg.toLowerCase().includes('already registered')) {
              setAlreadyRegisteredNotice({
                phone: cleanPhone,
                role: 'worker',
                message: msg
              })
            } else {
              setWorkerError(msg)
            }
          } finally {
            setWorkerLoading(false)
            setWorkerProgress('')
          }
        },
        onFailure: (err) => {
          setWorkerLoading(false)
          setWorkerProgress('')
          setWorkerError(
            typeof err === 'string'
              ? err
              : 'OTP verification failed or was cancelled. Please verify to complete registration.'
          )
        },
      })

      if (!widgetOpened) {
        setWorkerLoading(false)
        setWorkerProgress('')
        setWorkerError('OTP verification widget could not be loaded. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setWorkerLoading(false)
      setWorkerProgress('')
      setWorkerError('Unable to launch OTP verification. Please retry.')
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-xl w-full">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('registerPage.backToOptions', 'Back to Login / Sign Up options')}</span>
          </Link>
        </div>

        <Card className="p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('registerPage.title', 'New to Kaamgar? Create Account')}
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              {t('registerPage.subtitle', 'Select your role to register with mobile OTP verification & password')}
            </p>
          </div>

          {/* Role Tabs */}
          <div className="flex bg-slate-100 dark:bg-zinc-800/90 p-1.5 rounded-xl mb-6 border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('customer')
                setSearchParams({ role: 'customer' })
                setAlreadyRegisteredNotice(null)
                setCustomerError('')
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'customer'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{t('registerPage.tabCustomer', 'Customer Sign Up')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('worker')
                setSearchParams({ role: 'worker' })
                setAlreadyRegisteredNotice(null)
                setWorkerError('')
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'worker'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>{t('registerPage.tabWorker', 'Worker Sign Up')}</span>
            </button>
          </div>

          {/* ================= 1. CUSTOMER SIGN UP FORM ================= */}
          {activeTab === 'customer' && (
            <div>
              {alreadyRegisteredNotice && (
                <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">
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
                      to={`/login?role=${alreadyRegisteredNotice.role}&phone=${alreadyRegisteredNotice.phone}`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold text-xs shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {alreadyRegisteredNotice.role === 'worker'
                          ? t('auth.goToWorkerLogin', 'Sign In to Worker Dashboard')
                          : t('auth.goToCustomerLogin', 'Sign In to Customer Account')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {customerError && (
                <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{customerError}</span>
                </div>
              )}

              {/* One-time OTP & Password notice */}
              <div className="p-3.5 bg-brand-500/10 border border-brand-500/25 rounded-xl mb-5 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="text-xs text-brand-200 leading-relaxed">
                  <strong className="text-white block font-semibold mb-0.5">
                    {t('registerPage.oneTimeNoticeTitle', 'One-Time Verification')}
                  </strong>
                  {t('registerPage.oneTimeNoticeDesc', 'You only need to verify your mobile number with OTP once during sign up. On subsequent visits, simply log in using your phone number and password.')}
                </div>
              </div>

              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <Input
                  label={t('registerPage.fullName', 'Full Name (Mandatory) *')}
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Amit Kumar"
                  required
                  autoFocus
                />

                <div>
                  <Input
                    label={t('registerPage.phone', 'Mobile Number (10 digits) *')}
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                    required
                  />
                  <p className="mt-1 text-[11px] text-semantic-text-tertiary">
                    {t('registerPage.otpNotice', 'A 6-digit OTP will be dispatched to this number to verify your account.')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t('registerPage.createPassword', 'Create Password *')}
                    type="password"
                    value={customerPassword}
                    onChange={e => setCustomerPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                  />

                  <Input
                    label={t('registerPage.confirmPassword', 'Confirm Password *')}
                    type="password"
                    value={customerConfirmPassword}
                    onChange={e => setCustomerConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                  />
                </div>

                <Input
                  label={t('registerPage.emailOptional', 'Email Address (Optional)')}
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  leftIcon={<Mail className="w-4 h-4 text-semantic-text-tertiary" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-3 py-3 font-semibold shadow-lg shadow-brand-500/20"
                  size="lg"
                  loading={customerLoading}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {t('registerPage.customerSubmitBtn', 'Verify Mobile via OTP & Create Customer Account')}
                </Button>
              </form>
            </div>
          )}

          {/* ================= 2. WORKER SIGN UP FORM ================= */}
          {activeTab === 'worker' && (
            <div>
              {alreadyRegisteredNotice && (
                <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">
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
                      to={`/login?role=${alreadyRegisteredNotice.role}&phone=${alreadyRegisteredNotice.phone}`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold text-xs shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {alreadyRegisteredNotice.role === 'worker'
                          ? t('auth.goToWorkerLogin', 'Sign In to Worker Dashboard')
                          : t('auth.goToCustomerLogin', 'Sign In to Customer Account')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-5 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-semantic-text-secondary">
                  <strong className="text-emerald-300 block font-semibold mb-0.5">
                    {t('registerPage.workerNoticeTitle', 'Skilled Worker Registration')}
                  </strong>
                  {t('registerPage.workerNoticeDesc', 'Set your password, verify via mobile OTP, and provide your ID proof for platform verification.')}
                </div>
              </div>

              {workerError && (
                <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{workerError}</span>
                </div>
              )}

              <form onSubmit={handleWorkerSubmit} className="space-y-4">
                <Input
                  label={t('registerPage.workerFullName', 'Full Name (Mandatory) *')}
                  value={workerName}
                  onChange={e => setWorkerName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  required
                  autoFocus
                />

                <div>
                  <Input
                    label={t('registerPage.phone', 'Mobile Number (10 digits) *')}
                    value={workerPhone}
                    onChange={e => {
                      setWorkerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      if (alreadyRegisteredNotice) setAlreadyRegisteredNotice(null)
                    }}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                    required
                  />
                  <p className="mt-1 text-[11px] text-semantic-text-tertiary">
                    {t('registerPage.otpNotice', 'A 6-digit OTP will be dispatched via SMS to this number.')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t('registerPage.workerCreatePassword', 'Create Password *')}
                    type="password"
                    value={workerPassword}
                    onChange={e => setWorkerPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                  />

                  <Input
                    label={t('registerPage.confirmPassword', 'Confirm Password *')}
                    type="password"
                    value={workerConfirmPassword}
                    onChange={e => setWorkerConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                  />
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    {t('registerPage.tradeCategory', 'Trade / Service Category *')}
                  </label>
                  <select
                    required
                    value={workerCategory}
                    onChange={e => setWorkerCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">{t('registerPage.selectCategory', '-- Select Your Trade / Category --')}</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {getCategoryName(cat, 'en')} ({getCategoryName(cat, 'hi')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    {t('registerPage.experience', 'Years of Experience *')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    required
                    value={workerExperience}
                    onChange={e => setWorkerExperience(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Service Areas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    {t('registerPage.serviceAreas', 'Service Areas in Muzaffarnagar *')}
                  </label>
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl">
                    {MUZAFFARNAGAR_PINCODES.map(pincode => {
                      const selected = workerAreas.includes(pincode)
                      return (
                        <button
                          key={pincode}
                          type="button"
                          onClick={() => toggleArea(pincode)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            selected
                              ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                              : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700'
                          }`}
                        >
                          Pincode {pincode}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    {t('registerPage.selectedAreas', { count: workerAreas.length })}
                  </p>
                </div>

                {/* ID Proof Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    {t('registerPage.idProof', 'Government ID Proof (Aadhaar / Voter ID / Driving License) *')}
                  </label>
                  <div className="mt-1 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-emerald-500/50 rounded-xl p-4 text-center transition-colors bg-slate-50 dark:bg-zinc-800/40 relative">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={e => handleIdFileChange(e.target.files?.[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                      <UploadCloud className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-medium text-slate-800 dark:text-zinc-200">
                        {workerIdProof ? workerIdProof.name : t('registerPage.idProofPlaceholder', 'Tap to upload ID proof photo or PDF')}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {t('registerPage.idProofHint', 'JPG, PNG, or PDF up to 10MB • Stored in private encrypted storage')}
                      </p>
                    </div>
                  </div>
                  {workerIdPreview && (
                    <div className="mt-2 relative inline-block">
                      <img
                        src={workerIdPreview}
                        alt="ID Preview"
                        className="h-20 w-32 object-cover rounded-lg border border-semantic-border-light"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setWorkerIdProof(null)
                          setWorkerIdPreview(null)
                        }}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-600 text-white rounded-full shadow"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {workerIdIsPdf && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                      <FileText className="w-4 h-4" />
                      <span>{t('registerPage.pdfSelected', { name: workerIdProof?.name })}</span>
                    </div>
                  )}
                </div>

                {workerProgress && (
                  <p className="text-xs text-emerald-400 text-center animate-pulse">
                    {workerProgress}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border-none shadow-lg shadow-emerald-600/20"
                  size="lg"
                  loading={workerLoading}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {t('registerPage.workerSubmitBtn', 'Verify Mobile via OTP & Submit Worker Registration')}
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    to="/register/worker"
                    className="text-xs text-semantic-text-tertiary hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                  >
                    <span>{t('registerPage.wizardPrompt', 'Prefer the step-by-step registration wizard? Open wizard')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* Footer Navigation to Login */}
          <div className="mt-6 pt-5 border-t border-semantic-border-light text-center">
            <p className="text-xs text-semantic-text-secondary">
              {t('registerPage.alreadyHaveAccount', 'Already have an account?')}{' '}
              <Link
                to="/login"
                className="font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                {t('registerPage.loginHere', 'Log In here')}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

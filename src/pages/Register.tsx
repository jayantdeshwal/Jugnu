import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, Button, Input } from '@kaamgar/ui'
import {
  User,
  Truck,
  Phone,
  Mail,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { openOtpWidget } from '@/services/otp'
import { checkPhoneRegistration } from '@/services/authCheck'
import { sanitizeErrorMessage } from '@/utils/errors'
import { normalizeIndianPhone, tryNormalizeIndianPhone, sanitizePhoneInput } from '@/utils/phone'

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'worker' ? 'worker' : 'customer'
  const [activeTab, setActiveTab] = useState<'customer' | 'worker'>(initialRole)

  const { verifyAndLoginWithOtp } = useAuth()

  const queryPhone = tryNormalizeIndianPhone(searchParams.get('phone') || '') ?? ''

  // ---------------- Customer State ----------------
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState(queryPhone)
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')

  // ---------------- Already Registered Notice ----------------
  const [alreadyRegisteredNotice, setAlreadyRegisteredNotice] = useState<{
    phone: string
    message?: string
  } | null>(null)

  // ---------------- Customer Sign Up Submit ----------------
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError('')
    setAlreadyRegisteredNotice(null)

    const cleanName = customerName.trim()
    if (!cleanName || cleanName.length < 2) {
      setCustomerError('Full Name is mandatory (minimum 2 characters)')
      return
    }
    const normalizeResult = normalizeIndianPhone(customerPhone)
    if (!normalizeResult.ok) {
      setCustomerError(normalizeResult.error)
      return
    }
    const cleanPhone = normalizeResult.digits

    setCustomerLoading(true)
    try {
      // Check if phone is already registered
      const check = await checkPhoneRegistration(cleanPhone)
      if (check.isRegistered) {
        setCustomerLoading(false)
        setAlreadyRegisteredNotice({
          phone: cleanPhone,
          message: `An account is already registered with mobile number +91 ${cleanPhone}. Please sign in with OTP.`,
        })
        return
      }

      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async (accessToken: string) => {
          try {
            await verifyAndLoginWithOtp(
              cleanPhone,
              accessToken,
              cleanName,
              customerEmail.trim() || undefined
            )
            navigate('/')
          } catch (err) {
            setCustomerError(sanitizeErrorMessage(err, 'Sign up failed after OTP verification.'))
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
            <div className="w-14 h-14 mx-auto mb-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('registerPage.title', 'New to Jugnu? Join Today')}
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              {t('registerPage.subtitle', 'Passwordless mobile registration with instant OTP verification')}
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
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'worker'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>{t('registerPage.tabWorker', 'Artisan / Worker')}</span>
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
                        {alreadyRegisteredNotice.message}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Link
                      to={`/login?role=customer&phone=${alreadyRegisteredNotice.phone}`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t('auth.goToCustomerLogin', 'Sign In with OTP')}</span>
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

              {/* Passwordless benefits notice */}
              <div className="p-3.5 bg-brand-500/10 border border-brand-500/25 rounded-xl mb-5 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="text-xs text-brand-200 leading-relaxed">
                  <strong className="text-white block font-semibold mb-0.5">
                    {t('registerPage.passwordlessNoticeTitle', '100% Passwordless & Secure')}
                  </strong>
                  {t(
                    'registerPage.passwordlessNoticeDesc',
                    'Verify your mobile number via OTP once. Your session stays permanently saved on this device—no passwords to remember or reset!'
                  )}
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
                    onChange={e => setCustomerPhone(sanitizePhoneInput(e.target.value))}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">+91</span>}
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                    {t('registerPage.otpNotice', 'A 6-digit OTP will be dispatched to this number to verify your account.')}
                  </p>
                </div>

                <Input
                  label={t('registerPage.emailOptional', 'Email Address (Optional)')}
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  leftIcon={<Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-3 py-3 font-semibold shadow-lg shadow-brand-500/20"
                  size="lg"
                  loading={customerLoading}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {t('registerPage.customerSubmitBtn', 'Verify Mobile via OTP & Create Account')}
                </Button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500 dark:text-zinc-400">
                <span>{t('registerPage.haveAccount', 'Already have an account?')} </span>
                <Link
                  to="/login?role=customer"
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  {t('registerPage.loginLink', 'Sign In with OTP')}
                </Link>
              </div>
            </div>
          )}

          {/* ================= 2. WORKER REGISTRATION CTA ================= */}
          {activeTab === 'worker' && (
            <div className="py-3 text-center space-y-5">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-left space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Become a Verified Jugnu Artisan / Service Provider</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Join Muzaffarnagar's premier network of skilled local technicians and service experts.
                  Register in 3 simple steps:
                </p>
                <ul className="text-xs space-y-1.5 text-slate-600 dark:text-zinc-300 pl-2">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Verify your mobile number via OTP (no passwords required)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Select 1 or 2 trade services and your service areas in Muzaffarnagar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Upload government ID proof for fast admin verification</span>
                  </li>
                </ul>
              </div>

              <Link
                to={`/register/worker${customerPhone ? `?phone=${customerPhone}` : ''}`}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>Proceed to Artisan Registration</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="text-xs text-slate-500 dark:text-zinc-400">
                <span>Already registered as an artisan? </span>
                <Link
                  to="/login?role=worker"
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Sign in to Worker Dashboard
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

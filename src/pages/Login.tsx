import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input, Card } from '@kaamgar/ui'
import { useAuth } from '../context/AuthContext'
import { openOtpWidget } from '@/services/otp'
import { checkPhoneRegistration } from '@/services/authCheck'
import { getSupabaseClient } from '@/lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { triggerPWAInstall } from '@/components/PWAInstallPrompt'
import {
  Phone,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Shield,
  User,
  Truck,
  Sparkles,
  Download,
  Globe,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from 'lucide-react'
import { sanitizeErrorMessage } from '@/utils/errors'
import JugnuLogo from '@/components/common/JugnuLogo'

export default function Login() {
  const { t } = useTranslation()
  const { toggleLanguage } = useLanguage()
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const queryRole = searchParams.get('role')
  const initialRole = queryRole === 'worker' ? 'worker' : queryRole === 'admin' ? 'admin' : 'customer'
  const [loginRole, setLoginRole] = useState<'customer' | 'worker' | 'admin'>(initialRole)

  const {
    user,
    logout,
    signInWithEmail,
    verifyAndLoginWithOtp,
    updatePhone,
  } = useAuth()

  const queryPhone = (searchParams.get('phone') || '').replace(/\D/g, '').slice(-10)

  // ---------------- Customer State ----------------
  const [customerPhone, setCustomerPhone] = useState(queryPhone)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')

  // ---------------- Worker State ----------------
  const [workerPhone, setWorkerPhone] = useState(queryPhone)
  const [workerLoading, setWorkerLoading] = useState(false)
  const [workerError, setWorkerError] = useState('')

  // ---------------- Admin State & 2FA ----------------
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [admin2faStep, setAdmin2faStep] = useState<'credentials' | 'otp_challenge' | 'phone_setup'>('credentials')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminSetupPhone, setAdminSetupPhone] = useState('')

  // Sync role and phone from URL params if updated externally
  useEffect(() => {
    const roleParam = searchParams.get('role')
    if (roleParam === 'worker' || roleParam === 'admin' || roleParam === 'customer') {
      setLoginRole(roleParam)
    }
    const phoneParam = searchParams.get('phone')
    if (phoneParam) {
      const clean = phoneParam.replace(/\D/g, '').slice(-10)
      if (clean.length === 10) {
        setCustomerPhone(clean)
        setWorkerPhone(clean)
      }
    }
  }, [searchParams])

  // Redirect based on role and active verification
  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin' || user.role === 'sub_admin') {
        const is2faVerified = typeof window !== 'undefined' && sessionStorage.getItem('admin_2fa_verified') === 'true'
        if (is2faVerified) {
          const timer = setTimeout(() => {
            navigate('/admin')
          }, 300)
          return () => clearTimeout(timer)
        } else {
          setLoginRole('admin')
          const clean = (user.phone || '').replace(/\D/g, '').slice(-10)
          if (clean.length === 10) {
            setAdminPhone(clean)
            setAdmin2faStep('otp_challenge')
          } else {
            setAdmin2faStep('phone_setup')
          }
        }
      } else if (user.role === 'worker') {
        const timer = setTimeout(() => {
          navigate('/worker/dashboard')
        }, 500)
        return () => clearTimeout(timer)
      } else if (user.phone && user.phone.trim().length >= 10) {
        const timer = setTimeout(() => {
          navigate('/')
        }, 500)
        return () => clearTimeout(timer)
      }
    }
  }, [user, navigate])

  // ---------------- 1. CUSTOMER PASSWORDLESS OTP LOGIN ----------------
  const handleCustomerOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError('')

    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      setCustomerError('Please enter a valid 10-digit Indian mobile number')
      return
    }

    setCustomerLoading(true)
    try {
      // 1. Verify account exists before opening OTP
      const check = await checkPhoneRegistration(cleanPhone)
      if (!check.isRegistered) {
        setCustomerLoading(false)
        setCustomerError('No account found for this mobile number. Please register first.')
        return
      }

      // 2. Account exists: launch MSG91 OTP widget
      const launched = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async (accessToken: string) => {
          try {
            await verifyAndLoginWithOtp(cleanPhone, accessToken)
            navigate('/')
          } catch (err) {
            setCustomerError(sanitizeErrorMessage(err, 'Sign in failed after OTP verification.'))
          } finally {
            setCustomerLoading(false)
          }
        },
        onFailure: (err) => {
          setCustomerLoading(false)
          setCustomerError(typeof err === 'string' ? err : 'OTP verification cancelled or failed.')
        },
      })

      if (!launched) {
        setCustomerLoading(false)
        setCustomerError('Could not open OTP verification widget. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setCustomerLoading(false)
      setCustomerError('Unable to verify mobile number.')
    }
  }

  // ---------------- 2. WORKER PASSWORDLESS OTP LOGIN ----------------
  const handleWorkerOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWorkerError('')

    const cleanPhone = workerPhone.replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      setWorkerError('Please enter a valid 10-digit Indian mobile number')
      return
    }

    setWorkerLoading(true)
    try {
      // 1. Verify account exists before opening OTP
      const check = await checkPhoneRegistration(cleanPhone)
      if (!check.isRegistered) {
        setWorkerLoading(false)
        setWorkerError('No account found for this mobile number. Please register as a worker first.')
        return
      }

      // 2. Account exists: launch MSG91 OTP widget
      const launched = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async (accessToken: string) => {
          try {
            const authRes = await verifyAndLoginWithOtp(cleanPhone, accessToken)
            if (authRes.role === 'worker') {
              navigate('/worker/dashboard')
            } else {
              // User has verified phone but has not completed worker onboarding
              navigate(`/worker/register?phone=${cleanPhone}`)
            }
          } catch (err) {
            setWorkerError(sanitizeErrorMessage(err, 'Sign in failed after OTP verification.'))
          } finally {
            setWorkerLoading(false)
          }
        },
        onFailure: (err) => {
          setWorkerLoading(false)
          setWorkerError(typeof err === 'string' ? err : 'OTP verification cancelled or failed.')
        },
      })

      if (!launched) {
        setWorkerLoading(false)
        setWorkerError('Could not open OTP verification widget. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setWorkerLoading(false)
      setWorkerError('Unable to verify mobile number.')
    }
  }

  // ---------------- 3. ADMIN 2FA & EMAIL/PASSWORD LOGIN ----------------
  const launchAdmin2faOtp = async (cleanPhone: string) => {
    setAdminLoading(true)
    setAdminError('')

    try {
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          sessionStorage.setItem('admin_2fa_verified', 'true')
          sessionStorage.setItem('admin_2fa_timestamp', Date.now().toString())
          setAdminLoading(false)
          navigate('/admin')
        },
        onFailure: (err) => {
          setAdminLoading(false)
          setAdminError(
            typeof err === 'string'
              ? err
              : '2FA OTP verification was cancelled or failed. Two-factor authentication is required to access the administrator console.'
          )
        },
      })

      if (!widgetOpened) {
        setAdminLoading(false)
        setAdminError('2FA OTP widget could not be launched automatically. Please pause ad-blockers and retry.')
      }
    } catch (err) {
      setAdminLoading(false)
      setAdminError('Unable to initiate 2FA OTP verification. Please retry.')
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError('')
    if (!adminEmail.trim()) {
      setAdminError('Please enter your administrator email')
      return
    }
    if (!adminPassword) {
      setAdminError('Please enter your administrator password')
      return
    }

    setAdminLoading(true)
    try {
      await signInWithEmail(adminEmail.trim(), adminPassword)

      const supabase = getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user) {
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('id, role, phone, full_name')
          .eq('id', sessionData.session.user.id)
          .maybeSingle()

        if (profile?.role !== 'super_admin' && profile?.role !== 'sub_admin') {
          await logout()
          setAdminError('Access denied: This account is not authorized as a platform administrator.')
          return
        }

        const rawPhone = profile?.phone || ''
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)

        if (cleanPhone.length === 10) {
          setAdminPhone(cleanPhone)
          setAdmin2faStep('otp_challenge')
          await launchAdmin2faOtp(cleanPhone)
        } else {
          setAdmin2faStep('phone_setup')
        }
      }
    } catch (err) {
      setAdminError(sanitizeErrorMessage(err, 'Invalid administrator email or password'))
    } finally {
      setAdminLoading(false)
    }
  }

  const handleAdminPhoneSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError('')
    const cleanPhone = adminSetupPhone.replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      setAdminError('Please enter a valid 10-digit Indian mobile number for 2FA')
      return
    }

    setAdminLoading(true)
    try {
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await updatePhone(cleanPhone)
            sessionStorage.setItem('admin_2fa_verified', 'true')
            sessionStorage.setItem('admin_2fa_timestamp', Date.now().toString())
            navigate('/admin')
          } catch (err) {
            setAdminError('Mobile verified, but saving to profile failed. Please try again.')
          } finally {
            setAdminLoading(false)
          }
        },
        onFailure: (err) => {
          setAdminLoading(false)
          setAdminError(typeof err === 'string' ? err : 'Mobile OTP verification failed or cancelled.')
        },
      })

      if (!widgetOpened) {
        setAdminLoading(false)
        setAdminError('OTP widget could not be loaded. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setAdminLoading(false)
      setAdminError('Failed to initiate phone verification.')
    }
  }

  const handleExploreAsGuest = () => {
    sessionStorage.setItem('kaamgar_guest_mode', 'true')
    window.dispatchEvent(new Event('storage'))
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-between relative overflow-hidden px-4 py-4 sm:py-6 transition-colors">
      {/* Ambient Theme Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-amber-500/8 dark:bg-brand-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 bg-emerald-500/6 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-amber-500/5 dark:bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      {/* Top Minimalist Header */}
      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('loginPage.backToHome', 'Back to Home')}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerPWAInstall}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
            title="Install Jugnu Android/PWA App"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>

          <button
            type="button"
            onClick={toggleLanguage}
            className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-zinc-800/50 border border-slate-300 dark:border-zinc-700 transition-colors"
            title="Toggle Language"
            aria-label="Toggle Language"
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-zinc-800/50 border border-slate-300 dark:border-zinc-700 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-4">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <JugnuLogo className="h-10 w-auto mx-auto" />
          </Link>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('loginPage.welcomeBack', 'Welcome to Jugnu')}
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            {t('loginPage.platformSubtitle', 'Muzaffarnagar\'s Trusted Home & Professional Services')}
          </p>
        </div>

        <Card className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl relative">
          {/* Role Navigation Tabs */}
          <div className="flex bg-slate-100 dark:bg-zinc-800/90 p-1 rounded-xl mb-6 border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setLoginRole('customer')
                setSearchParams({ role: 'customer' })
                setCustomerError('')
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginRole === 'customer'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('loginPage.tabCustomer', 'Customer')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginRole('worker')
                setSearchParams({ role: 'worker' })
                setWorkerError('')
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginRole === 'worker'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{t('loginPage.tabWorker', 'Worker')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginRole('admin')
                setSearchParams({ role: 'admin' })
                setAdminError('')
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginRole === 'admin'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t('loginPage.tabAdmin', 'Admin')}</span>
            </button>
          </div>

          {/* ================= 1. CUSTOMER LOGIN FORM ================= */}
          {loginRole === 'customer' && (
            <div>
              {customerError && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{customerError}</span>
                  </div>
                  {customerError.toLowerCase().includes('register') && (
                    <div className="pl-6 pt-1">
                      <Link
                        to={`/register?phone=${customerPhone.replace(/\D/g, '').slice(0, 10)}&role=customer`}
                        className="font-semibold text-amber-500 hover:text-amber-400 underline inline-flex items-center gap-1"
                      >
                        <span>Register now with this number</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                  <strong className="text-slate-900 dark:text-white block font-semibold mb-0.5">
                    Instant Passwordless Login
                  </strong>
                  Enter your mobile number to receive an instant verification OTP. No passwords required.
                </div>
              </div>

              <form onSubmit={handleCustomerOtpLogin} className="space-y-4">
                <div>
                  <Input
                    label={t('loginPage.identifierLabel', 'Mobile Number (10 digits) *')}
                    value={customerPhone}
                    onChange={e => {
                      setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      if (customerError) setCustomerError('')
                    }}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">+91</span>}
                    required
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                    A 6-digit OTP will be verified to sign you in.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  size="lg"
                  loading={customerLoading}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span>Send OTP & Sign In</span>
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500 dark:text-zinc-400">
                <span>New to Jugnu? </span>
                <Link
                  to="/register?role=customer"
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                >
                  <span>Create Customer Account</span>
                  <ArrowRight className="w-3 h-3 inline" />
                </Link>
              </div>
            </div>
          )}

          {/* ================= 2. WORKER LOGIN FORM ================= */}
          {loginRole === 'worker' && (
            <div>
              {workerError && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{workerError}</span>
                  </div>
                  {workerError.toLowerCase().includes('register') && (
                    <div className="pl-6 pt-1">
                      <Link
                        to={`/worker/register?phone=${workerPhone.replace(/\D/g, '').slice(0, 10)}`}
                        className="font-semibold text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1"
                      >
                        <span>Register as a worker now</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                <Truck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                  <strong className="text-slate-900 dark:text-white block font-semibold mb-0.5">
                    Artisan & Worker Portal
                  </strong>
                  Sign in with your verified mobile number to access your worker dashboard and manage customer bookings.
                </div>
              </div>

              <form onSubmit={handleWorkerOtpLogin} className="space-y-4">
                <div>
                  <Input
                    label={t('loginPage.workerIdentifierLabel', 'Worker Mobile Number (10 digits) *')}
                    value={workerPhone}
                    onChange={e => {
                      setWorkerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      if (workerError) setWorkerError('')
                    }}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">+91</span>}
                    required
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                    A 6-digit OTP will be verified to sign in.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-lg shadow-emerald-600/20"
                  size="lg"
                  loading={workerLoading}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span>Send OTP & Sign In to Dashboard</span>
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500 dark:text-zinc-400">
                <p className="mb-1 text-slate-500 dark:text-zinc-500">Not registered as a worker yet?</p>
                <Link
                  to="/worker/register"
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Register as Worker to get jobs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* ================= 3. ADMIN LOGIN & 2FA FORM ================= */}
          {loginRole === 'admin' && (
            <div>
              {adminError && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{adminError}</span>
                  </div>
                </div>
              )}

              {/* Step A: Credentials */}
              {admin2faStep === 'credentials' && (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                      <strong className="text-slate-900 dark:text-white block font-semibold mb-0.5">
                        Platform Administrator Console
                      </strong>
                      Sign in with your administrator credentials. Two-Factor Authentication (2FA) is mandatory.
                    </div>
                  </div>

                  <Input
                    label="Administrator Email *"
                    type="email"
                    value={adminEmail}
                    onChange={e => {
                      setAdminEmail(e.target.value)
                      if (adminError) setAdminError('')
                    }}
                    placeholder="admin@jugnu.in"
                    leftIcon={<Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500" />}
                    required
                    autoFocus
                  />

                  <div className="relative">
                    <Input
                      label="Administrator Password *"
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => {
                        setAdminPassword(e.target.value)
                        if (adminError) setAdminError('')
                      }}
                      placeholder="••••••••••••"
                      leftIcon={<Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500" />}
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(prev => !prev)}
                          className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
                          title={showAdminPassword ? 'Hide password' : 'Show password'}
                          aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                        >
                          {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white border-none shadow-lg shadow-blue-600/20"
                    size="lg"
                    loading={adminLoading}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    <span>Verify Credentials & Continue</span>
                  </Button>
                </form>
              )}

              {/* Step B: 2FA OTP Challenge */}
              {admin2faStep === 'otp_challenge' && (
                <div className="space-y-4 py-2 text-center">
                  <div className="w-12 h-12 mx-auto bg-blue-500/10 border border-blue-500/25 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Two-Factor Authentication Required
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                      A verification challenge is required for registered administrator mobile: <br />
                      <strong className="text-slate-900 dark:text-white">+91 ******{adminPhone.slice(-4)}</strong>
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white border-none"
                    onClick={() => launchAdmin2faOtp(adminPhone)}
                    loading={adminLoading}
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    <span>Complete 2FA Verification</span>
                  </Button>

                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      setAdmin2faStep('credentials')
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 underline cursor-pointer"
                  >
                    Cancel and Sign Out
                  </button>
                </div>
              )}

              {/* Step C: First-time Phone Setup for 2FA */}
              {admin2faStep === 'phone_setup' && (
                <form onSubmit={handleAdminPhoneSetupSubmit} className="space-y-4">
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                      <strong className="text-slate-900 dark:text-white block font-semibold mb-0.5">
                        2FA Setup Required
                      </strong>
                      Your administrator account requires a verified mobile number for mandatory Two-Factor Authentication.
                    </div>
                  </div>

                  <Input
                    label="Administrator Mobile Number (10 digits) *"
                    value={adminSetupPhone}
                    onChange={e => {
                      setAdminSetupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      if (adminError) setAdminError('')
                    }}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">+91</span>}
                    required
                    autoFocus
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white border-none"
                    size="lg"
                    loading={adminLoading}
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    <span>Verify Phone with OTP & Complete Setup</span>
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Guest Explore Option */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800 text-center">
            <button
              type="button"
              onClick={handleExploreAsGuest}
              className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Want to browse services first? <span className="underline font-medium">Explore as Guest</span>
            </button>
          </div>
        </Card>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-400 dark:text-zinc-500">
        Jugnu • Muzaffarnagar Urban Services • 100% Secure Platform
      </footer>
    </div>
  )
}
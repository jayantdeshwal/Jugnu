import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input, Card, Badge } from '@kaamgar/ui'
import { useAuth } from '../context/AuthContext'
import { openOtpWidget } from '@/services/otp'
import { getSupabaseClient } from '@/lib/supabase'
import {
  Phone,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Shield,
  User,
  Truck,
  Briefcase,
  Sparkles,
} from 'lucide-react'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const queryRole = searchParams.get('role')
  const initialRole = queryRole === 'worker' ? 'worker' : queryRole === 'admin' ? 'admin' : 'customer'
  const [loginRole, setLoginRole] = useState<'customer' | 'worker' | 'admin'>(initialRole)

  const {
    user,
    logout,
    signInWithEmail,
    loginWithVerifiedPhone,
    signInWithGoogle,
    updatePhone,
  } = useAuth()

  // ---------------- Customer State ----------------
  const [customerAuthMode, setCustomerAuthMode] = useState<'otp' | 'password'>('otp')
  const [customerIdentifier, setCustomerIdentifier] = useState('')
  const [customerPassword, setCustomerPassword] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')

  // ---------------- Worker State ----------------
  const [workerAuthMode, setWorkerAuthMode] = useState<'otp' | 'password'>('otp')
  const [workerIdentifier, setWorkerIdentifier] = useState('')
  const [workerPassword, setWorkerPassword] = useState('')
  const [workerPhone, setWorkerPhone] = useState('')
  const [workerLoading, setWorkerLoading] = useState(false)
  const [workerError, setWorkerError] = useState('')

  // ---------------- Admin State & 2FA ----------------
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [admin2faStep, setAdmin2faStep] = useState<'credentials' | 'otp_challenge' | 'phone_setup'>('credentials')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminSetupPhone, setAdminSetupPhone] = useState('')

  // Sync role tab from URL params if updated externally
  useEffect(() => {
    const roleParam = searchParams.get('role')
    if (roleParam === 'worker' || roleParam === 'admin' || roleParam === 'customer') {
      setLoginRole(roleParam)
    }
  }, [searchParams])

  // Redirect based on role and active verification
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
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

  // Helper: Resolve phone or email to Supabase email for password authentication
  const resolveIdentifierToEmail = async (rawIdentifier: string): Promise<string> => {
    const trimmed = rawIdentifier.trim()
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase()
    }
    const cleanPhone = trimmed.replace(/\D/g, '').slice(-10)
    const supabase = getSupabaseClient()
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('email')
      .eq('phone', `+91${cleanPhone}`)
      .maybeSingle()

    if (profile?.email) {
      return profile.email.toLowerCase()
    }
    return `${cleanPhone}@phone.kaamgar.local`
  }

  // ---------------- 1. CUSTOMER LOGIN HANDLERS ----------------
  const handleCustomerOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError('')

    const cleanPhone = customerPhone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setCustomerError('Please enter a valid 10-digit mobile number')
      return
    }

    setCustomerLoading(true)
    try {
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await loginWithVerifiedPhone(
              customerName.trim() || 'Customer',
              cleanPhone,
              'customer'
            )
            navigate('/')
          } catch (err) {
            setCustomerError(err instanceof Error ? err.message : 'Sign in failed after OTP verification')
          } finally {
            setCustomerLoading(false)
          }
        },
        onFailure: (err) => {
          setCustomerLoading(false)
          setCustomerError(typeof err === 'string' ? err : 'OTP verification was cancelled or failed.')
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

  const handleCustomerPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError('')

    if (!customerIdentifier.trim()) {
      setCustomerError('Please enter your mobile number or email address')
      return
    }
    if (!customerPassword) {
      setCustomerError('Please enter your password')
      return
    }

    setCustomerLoading(true)
    try {
      const resolvedEmail = await resolveIdentifierToEmail(customerIdentifier)
      await signInWithEmail(resolvedEmail, customerPassword)
      navigate('/')
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : 'Invalid login credentials. Please check and retry.')
    } finally {
      setCustomerLoading(false)
    }
  }

  // ---------------- 2. WORKER LOGIN HANDLERS ----------------
  const handleWorkerOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWorkerError('')

    const cleanPhone = workerPhone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setWorkerError('Please enter a valid 10-digit mobile number')
      return
    }

    setWorkerLoading(true)
    try {
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await loginWithVerifiedPhone(
              'Worker',
              cleanPhone,
              'worker'
            )
            navigate('/worker/dashboard')
          } catch (err) {
            setWorkerError(err instanceof Error ? err.message : 'Worker login failed after OTP verification')
          } finally {
            setWorkerLoading(false)
          }
        },
        onFailure: (err) => {
          setWorkerLoading(false)
          setWorkerError(typeof err === 'string' ? err : 'OTP verification was cancelled or failed.')
        },
      })

      if (!widgetOpened) {
        setWorkerLoading(false)
        setWorkerError('OTP verification widget could not be loaded. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setWorkerLoading(false)
      setWorkerError('Unable to launch OTP verification. Please retry.')
    }
  }

  const handleWorkerPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWorkerError('')

    if (!workerIdentifier.trim()) {
      setWorkerError('Please enter your mobile number or email')
      return
    }
    if (!workerPassword) {
      setWorkerError('Please enter your password')
      return
    }

    setWorkerLoading(true)
    try {
      const resolvedEmail = await resolveIdentifierToEmail(workerIdentifier)
      await signInWithEmail(resolvedEmail, workerPassword)
      navigate('/worker/dashboard')
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : 'Invalid worker credentials. Please check and retry.')
    } finally {
      setWorkerLoading(false)
    }
  }

  // ---------------- 3. ADMIN 2FA & LOGIN HANDLERS ----------------
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
        setAdminError('2FA OTP widget could not be launched automatically. Please pause ad-blockers and click "Open OTP Widget" below.')
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

        if (profile?.role !== 'admin') {
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
      setAdminError(err instanceof Error ? err.message : 'Invalid administrator email or password')
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

  return (
    <div className="min-h-[calc(100vh-64px)] bg-semantic-bg-primary flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-xs text-semantic-text-tertiary hover:text-brand-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('loginPage.backToOptions', 'Back to Login / Sign Up options')}</span>
          </Link>
        </div>

        <Card className="p-6 sm:p-8 bg-surface-100 border border-semantic-border-light shadow-2xl relative">
          {/* Header Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-semantic-text-primary">
              {loginRole === 'admin'
                ? t('loginPage.adminTitle', 'Administrator Portal')
                : loginRole === 'worker'
                ? t('loginPage.workerTitle', 'Kaamgar Worker Login')
                : t('loginPage.customerTitle', 'Customer Login')}
            </h1>
            <p className="mt-1 text-xs text-semantic-text-secondary">
              {loginRole === 'admin'
                ? t('loginPage.adminSubtitle', 'Sign in with administrator credentials & complete 2FA')
                : loginRole === 'worker'
                ? t('loginPage.workerSubtitle', 'Access your jobs, appointments & earnings')
                : t('loginPage.customerSubtitle', 'Sign in to book verified local services')}
            </p>
          </div>

          {/* Role Navigation: 3 Distinct Tabs */}
          <div className="flex bg-surface-200/90 p-1 rounded-xl mb-6 border border-semantic-border-light text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setLoginRole('customer')
                setSearchParams({ role: 'customer' })
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginRole === 'customer'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-semantic-text-secondary hover:text-semantic-text-primary'
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
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginRole === 'worker'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-semantic-text-secondary hover:text-semantic-text-primary'
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
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginRole === 'admin'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-semantic-text-secondary hover:text-semantic-text-primary'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t('loginPage.tabAdmin', 'Admin')}</span>
            </button>
          </div>

          {/* ================= 1. CUSTOMER LOGIN FORM ================= */}
          {loginRole === 'customer' && (
            <div>
              {/* Toggle: OTP vs Password */}
              <div className="flex bg-surface-200/60 p-1 rounded-lg mb-4 border border-semantic-border-light/60 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerAuthMode('otp')
                    setCustomerError('')
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    customerAuthMode === 'otp'
                      ? 'bg-surface-100 text-brand-400 font-semibold shadow-sm'
                      : 'text-semantic-text-tertiary hover:text-semantic-text-primary'
                  }`}
                >
                  {t('loginPage.modeOtp', 'Mobile Number (OTP)')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerAuthMode('password')
                    setCustomerError('')
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    customerAuthMode === 'password'
                      ? 'bg-surface-100 text-brand-400 font-semibold shadow-sm'
                      : 'text-semantic-text-tertiary hover:text-semantic-text-primary'
                  }`}
                >
                  {t('loginPage.modePassword', 'Phone / Email & Password')}
                </button>
              </div>

              {customerError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{customerError}</span>
                </div>
              )}

              {customerAuthMode === 'otp' ? (
                <form onSubmit={handleCustomerOtpLogin} className="space-y-4">
                  <Input
                    label={t('loginPage.phoneLabel', 'Mobile Number (10 digits) *')}
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                    required
                    autoFocus
                  />

                  <Input
                    label={t('loginPage.fullNameOptional', 'Full Name (Optional for existing customers)')}
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Your Name"
                    leftIcon={<User className="w-4 h-4 text-semantic-text-tertiary" />}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2"
                    size="lg"
                    loading={customerLoading}
                  >
                    {t('loginPage.verifyOtpBtn', 'Verify Mobile via OTP & Sign In')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleCustomerPasswordLogin} className="space-y-4">
                  <Input
                    label={t('loginPage.identifierLabel', 'Mobile Number or Email Address *')}
                    value={customerIdentifier}
                    onChange={e => setCustomerIdentifier(e.target.value)}
                    placeholder="9876543210 or name@gmail.com"
                    leftIcon={<User className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                    autoFocus
                  />

                  <Input
                    label={t('loginPage.passwordLabel', 'Password *')}
                    type="password"
                    value={customerPassword}
                    onChange={e => setCustomerPassword(e.target.value)}
                    placeholder="••••••••••••"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2"
                    size="lg"
                    loading={customerLoading}
                  >
                    {t('loginPage.customerPasswordBtn', 'Sign In as Customer')}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ================= 2. WORKER LOGIN FORM ================= */}
          {loginRole === 'worker' && (
            <div>
              {/* Toggle: OTP vs Password */}
              <div className="flex bg-surface-200/60 p-1 rounded-lg mb-4 border border-semantic-border-light/60 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setWorkerAuthMode('otp')
                    setWorkerError('')
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    workerAuthMode === 'otp'
                      ? 'bg-surface-100 text-emerald-400 font-semibold shadow-sm'
                      : 'text-semantic-text-tertiary hover:text-semantic-text-primary'
                  }`}
                >
                  {t('loginPage.modeOtp', 'Mobile Number (OTP)')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkerAuthMode('password')
                    setWorkerError('')
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    workerAuthMode === 'password'
                      ? 'bg-surface-100 text-emerald-400 font-semibold shadow-sm'
                      : 'text-semantic-text-tertiary hover:text-semantic-text-primary'
                  }`}
                >
                  {t('loginPage.modePassword', 'Phone / Email & Password')}
                </button>
              </div>

              {workerError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{workerError}</span>
                </div>
              )}

              {workerAuthMode === 'otp' ? (
                <form onSubmit={handleWorkerOtpLogin} className="space-y-4">
                  <Input
                    label={t('loginPage.phoneLabel', 'Worker Mobile Number (10 digits) *')}
                    value={workerPhone}
                    onChange={e => setWorkerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                    required
                    autoFocus
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-lg shadow-emerald-600/20"
                    size="lg"
                    loading={workerLoading}
                  >
                    {t('loginPage.workerOtpBtn', 'Verify via OTP & Access Worker Dashboard')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleWorkerPasswordLogin} className="space-y-4">
                  <Input
                    label={t('loginPage.workerIdentifierLabel', 'Mobile Number or Registered Email *')}
                    value={workerIdentifier}
                    onChange={e => setWorkerIdentifier(e.target.value)}
                    placeholder="9876543210 or worker@gmail.com"
                    leftIcon={<Truck className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                    autoFocus
                  />

                  <Input
                    label={t('loginPage.passwordLabel', 'Password *')}
                    type="password"
                    value={workerPassword}
                    onChange={e => setWorkerPassword(e.target.value)}
                    placeholder="••••••••••••"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-lg shadow-emerald-600/20"
                    size="lg"
                    loading={workerLoading}
                  >
                    {t('loginPage.workerPasswordBtn', 'Sign In to Worker Dashboard')}
                  </Button>
                </form>
              )}

              <div className="mt-4 pt-3 border-t border-semantic-border-light/60 text-center">
                <p className="text-xs text-semantic-text-tertiary mb-1">
                  {t('loginPage.newWorkerPrompt', 'New Kaamgar? Register as a verified artisan')}
                </p>
                <Link
                  to="/register?role=worker"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  <span>{t('loginPage.newWorkerLink', 'Register as Worker to get jobs')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* ================= 3. ADMIN LOGIN FORM & 2FA ================= */}
          {loginRole === 'admin' && (
            <div>
              {admin2faStep === 'credentials' && (
                <div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 flex items-start gap-2.5">
                    <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200">
                      <strong className="block font-semibold text-amber-300 mb-0.5">
                        {t('loginPage.adminConsoleBadge', 'High Security Console')}
                      </strong>
                      {t('loginPage.adminConsoleNotice', 'Sign in with your official administrator credentials. A mandatory 2FA OTP will be sent to your mobile.')}
                    </div>
                  </div>

                  {adminError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <Input
                      label={t('loginPage.adminEmailLabel', 'Administrator Email *')}
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="admin@muzaffarnagar-kaamgar.in"
                      leftIcon={<Mail className="w-5 h-5 text-semantic-text-tertiary" />}
                      required
                      autoFocus
                    />

                    <Input
                      label={t('loginPage.passwordLabel', 'Password *')}
                      type="password"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      leftIcon={<Lock className="w-5 h-5 text-semantic-text-tertiary" />}
                      required
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-medium border-none shadow-lg shadow-amber-600/20"
                      size="lg"
                      loading={adminLoading}
                    >
                      {t('loginPage.adminSubmitBtn', 'Authenticate & Launch 2FA OTP')}
                    </Button>
                  </form>
                </div>
              )}

              {admin2faStep === 'otp_challenge' && (
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center animate-pulse">
                    <Shield className="w-7 h-7 text-amber-400" />
                  </div>
                  <span className="inline-block px-2 py-0.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded-full">
                    {t('loginPage.twoFaBadge', '2FA Verification')}
                  </span>
                  <h2 className="text-xl font-bold text-semantic-text-primary">
                    {t('loginPage.twoFaTitle', 'Verify Your Mobile')}
                  </h2>
                  <p className="mt-1 text-xs text-semantic-text-secondary">
                    {t('loginPage.twoFaSubtitle', "We've triggered an OTP via MSG91 to:")}
                  </p>
                  <p className="mt-1 text-base font-bold text-amber-400 tracking-wider">
                    +91 ••••••{adminPhone.slice(-4)}
                  </p>

                  {adminError && (
                    <div className="my-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs text-left">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  <div className="space-y-3 mt-5">
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium border-none shadow-lg shadow-amber-600/20 py-2.5"
                      size="lg"
                      loading={adminLoading}
                      onClick={() => launchAdmin2faOtp(adminPhone)}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      {t('loginPage.openOtpWidgetBtn', 'Open OTP Verification Widget')}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs text-semantic-text-secondary hover:text-red-400 border-semantic-border-light"
                      onClick={async () => {
                        await logout()
                        setAdmin2faStep('credentials')
                        setAdminPassword('')
                        setAdminError('')
                      }}
                    >
                      {t('loginPage.cancelSignOut', 'Cancel & Sign Out')}
                    </Button>
                  </div>
                </div>
              )}

              {admin2faStep === 'phone_setup' && (
                <div>
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 mx-auto mb-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center">
                      <Phone className="w-6 h-6 text-amber-400" />
                    </div>
                    <h2 className="text-lg font-bold text-semantic-text-primary">
                      {t('loginPage.linkMobileTitle', 'Link Mobile for 2FA')}
                    </h2>
                    <p className="mt-1 text-xs text-semantic-text-secondary">
                      {t('loginPage.linkMobileSubtitle', 'Your administrator account requires a verified mobile number for mandatory SMS OTP verification.')}
                    </p>
                  </div>

                  {adminError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAdminPhoneSetupSubmit} className="space-y-4">
                    <Input
                      label={t('loginPage.phoneLabel', 'Mobile Number (10 digits) *')}
                      value={adminSetupPhone}
                      onChange={e => setAdminSetupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                      required
                      autoFocus
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-medium border-none shadow-lg shadow-amber-600/20"
                      size="lg"
                      loading={adminLoading}
                    >
                      {t('loginPage.verifyLinkMobileBtn', 'Verify via OTP & Link Mobile')}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs text-semantic-text-secondary hover:text-red-400 border-semantic-border-light"
                      onClick={async () => {
                        await logout()
                        setAdmin2faStep('credentials')
                        setAdminPassword('')
                        setAdminError('')
                      }}
                    >
                      {t('loginPage.cancelSignOut', 'Cancel & Sign Out')}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Footer Callout to Register */}
          <div className="mt-6 pt-5 border-t border-semantic-border-light text-center">
            <p className="text-xs text-semantic-text-secondary">
              {t('loginPage.newToKaamgar', 'New to Kaamgar?')}{' '}
              <Link
                to={`/register?role=${loginRole === 'worker' ? 'worker' : 'customer'}`}
                className="font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                {t('loginPage.signUpLink', 'Create an account (Sign Up)')}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
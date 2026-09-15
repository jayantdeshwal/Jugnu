import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input, Card, Badge } from '@kaamgar/ui'
import { useAuth } from '../context/AuthContext'
import { openOtpWidget } from '@/services/otp'
import { getSupabaseClient } from '@/lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import { triggerPWAInstall } from '@/components/PWAInstallPrompt'
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
  Download,
  Globe,
  Heart,
  UserPlus,
  Eye,
  EyeOff,
} from 'lucide-react'
import { checkPhoneRegistration } from '@/services/authCheck'

export default function Login() {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
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

  const queryPhone = (searchParams.get('phone') || '').replace(/\D/g, '').slice(-10)

  // ---------------- Customer State ----------------
  const [customerIdentifier, setCustomerIdentifier] = useState(queryPhone)
  const [customerPassword, setCustomerPassword] = useState('')
  const [showCustomerPassword, setShowCustomerPassword] = useState(false)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')

  // ---------------- Worker State ----------------
  const [workerIdentifier, setWorkerIdentifier] = useState(queryPhone)
  const [workerPassword, setWorkerPassword] = useState('')
  const [showWorkerPassword, setShowWorkerPassword] = useState(false)
  const [workerLoading, setWorkerLoading] = useState(false)
  const [workerError, setWorkerError] = useState('')

  // ---------------- Account Check & Registration Warnings ----------------
  const [unregisteredNotice, setUnregisteredNotice] = useState<{
    phone: string
    role: 'customer' | 'worker'
    message?: string
  } | null>(null)

  const [workerRoleMismatch, setWorkerRoleMismatch] = useState<{
    phone: string
    fullName?: string
  } | null>(null)

  // ---------------- Admin State & 2FA ----------------
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
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
        setCustomerIdentifier(clean)
        setWorkerIdentifier(clean)
      }
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
  const resolveIdentifierToEmail = async (rawIdentifier: string): Promise<{ primaryEmail: string; fallbackEmail?: string }> => {
    const trimmed = rawIdentifier.trim()
    if (trimmed.includes('@')) {
      return { primaryEmail: trimmed.toLowerCase() }
    }
    const cleanPhone = trimmed.replace(/\D/g, '').slice(-10)

    // Check RPC registration info first (which returns user's registered email even without auth)
    let registeredEmail: string | undefined
    try {
      const check = await checkPhoneRegistration(cleanPhone)
      if (check.email && check.email.includes('@') && !check.email.includes('@phone.kaamgar.local')) {
        registeredEmail = check.email.toLowerCase()
      }
    } catch {
      // Ignore and fallback
    }

    const defaultPhoneEmail = `${cleanPhone}@phone.kaamgar.local`
    if (registeredEmail) {
      return { primaryEmail: registeredEmail, fallbackEmail: defaultPhoneEmail }
    }
    return { primaryEmail: defaultPhoneEmail }
  }

  // ---------------- 1. CUSTOMER LOGIN HANDLERS ----------------
  const handleCustomerOtpRecovery = async () => {
    setCustomerError('')
    setUnregisteredNotice(null)

    const cleanPhone = customerIdentifier.trim().replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      setCustomerError('Please enter your 10-digit registered mobile number in the field above to verify via OTP.')
      return
    }

    setCustomerLoading(true)
    try {
      const check = await checkPhoneRegistration(cleanPhone)
      if (!check.isRegistered) {
        setCustomerLoading(false)
        setUnregisteredNotice({
          phone: cleanPhone,
          role: 'customer',
          message: 'No account found with this mobile number. Please sign up to create your Kaamgar account first.'
        })
        return
      }

      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await loginWithVerifiedPhone(
              check.fullName || 'Customer',
              cleanPhone,
              'customer'
            )
            navigate('/')
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sign in failed after OTP verification'
            setCustomerError(msg)
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
    } catch {
      setCustomerLoading(false)
      setCustomerError('Unable to launch OTP verification. Please retry.')
    }
  }

  const handleCustomerPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError('')
    setUnregisteredNotice(null)

    if (!customerIdentifier.trim()) {
      setCustomerError('Please enter your mobile number or email address')
      return
    }
    if (!customerPassword) {
      setCustomerError('Please enter your password')
      return
    }

    const clean = customerIdentifier.trim().replace(/\D/g, '').slice(-10)
    const isPhone = clean.length === 10 && !customerIdentifier.includes('@')

    setCustomerLoading(true)
    try {
      // If user typed a 10-digit mobile, pre-verify registration
      if (isPhone) {
        const check = await checkPhoneRegistration(clean)
        if (!check.isRegistered) {
          setCustomerLoading(false)
          setUnregisteredNotice({
            phone: clean,
            role: 'customer',
            message: 'No account found with this mobile number. Please sign up to create your Kaamgar account first.'
          })
          return
        }
      }

      const { primaryEmail, fallbackEmail } = await resolveIdentifierToEmail(customerIdentifier)
      try {
        await signInWithEmail(primaryEmail, customerPassword)
        navigate('/')
        return
      } catch (firstErr) {
        // If phone number was used, try alternative email format
        if (fallbackEmail) {
          try {
            await signInWithEmail(fallbackEmail, customerPassword)
            navigate('/')
            return
          } catch {
            // Both failed, throw original error
          }
        }
        throw firstErr
      }
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : 'Invalid login credentials. Please check and retry.')
    } finally {
      setCustomerLoading(false)
    }
  }

  // ---------------- 2. WORKER LOGIN HANDLERS ----------------
  const handleWorkerOtpRecovery = async () => {
    setWorkerError('')
    setUnregisteredNotice(null)
    setWorkerRoleMismatch(null)

    const cleanPhone = workerIdentifier.trim().replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      setWorkerError('Please enter your 10-digit registered worker mobile number in the field above to verify via OTP.')
      return
    }

    setWorkerLoading(true)
    try {
      const check = await checkPhoneRegistration(cleanPhone)
      if (!check.isRegistered) {
        setWorkerLoading(false)
        setUnregisteredNotice({
          phone: cleanPhone,
          role: 'worker',
          message: 'No worker account found with this mobile number. Please register as a verified Kaamgar artisan first.'
        })
        return
      }

      if (check.role === 'customer' && !check.isWorker) {
        setWorkerLoading(false)
        setWorkerRoleMismatch({
          phone: cleanPhone,
          fullName: check.fullName
        })
        return
      }

      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await loginWithVerifiedPhone(
              check.fullName || 'Worker',
              cleanPhone,
              'worker'
            )
            navigate('/worker/dashboard')
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Worker login failed after OTP verification'
            setWorkerError(msg)
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
    } catch {
      setWorkerLoading(false)
      setWorkerError('Unable to launch OTP verification. Please retry.')
    }
  }

  const handleWorkerPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWorkerError('')
    setUnregisteredNotice(null)
    setWorkerRoleMismatch(null)

    if (!workerIdentifier.trim()) {
      setWorkerError('Please enter your mobile number or email')
      return
    }
    if (!workerPassword) {
      setWorkerError('Please enter your password')
      return
    }

    const clean = workerIdentifier.trim().replace(/\D/g, '').slice(-10)
    const isPhone = clean.length === 10 && !workerIdentifier.includes('@')
    setWorkerLoading(true)
    try {
      if (isPhone) {
        const check = await checkPhoneRegistration(clean)
        if (!check.isRegistered) {
          setWorkerLoading(false)
          setUnregisteredNotice({
            phone: clean,
            role: 'worker',
            message: 'No worker account found with this mobile number. Please register as a verified Kaamgar artisan first.'
          })
          return
        }
        if (check.role === 'customer' && !check.isWorker) {
          setWorkerLoading(false)
          setWorkerRoleMismatch({
            phone: clean,
            fullName: check.fullName
          })
          return
        }
      }

      const { primaryEmail, fallbackEmail } = await resolveIdentifierToEmail(workerIdentifier)
      try {
        await signInWithEmail(primaryEmail, workerPassword)
        navigate('/worker/dashboard')
        return
      } catch (firstErr) {
        if (fallbackEmail) {
          try {
            await signInWithEmail(fallbackEmail, workerPassword)
            navigate('/worker/dashboard')
            return
          } catch {
            // Both failed
          }
        }
        throw firstErr
      }
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
    <div className="min-h-screen bg-surface-950 text-semantic-text-primary flex flex-col justify-between relative overflow-hidden px-4 py-4 sm:py-6">
      {/* Decent Ambient Theme Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 bg-emerald-500/6 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      {/* Top Minimalist Header */}
      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 text-surface-950 rounded-lg flex items-center justify-center font-bold shadow-md shadow-brand-500/20">
            <Truck className="w-4 h-4 text-surface-950" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
            {t('app.name')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Install App Button (Exclusively on Login page before signing in!) */}
          <button
            type="button"
            onClick={() => triggerPWAInstall()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title={t('pwa.installApp', 'Install App')}
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>{t('pwa.installApp', 'Install App')}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-semantic-border-medium rounded-full text-xs font-semibold text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-800 transition-colors cursor-pointer"
            aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
          >
            <Globe className="w-3.5 h-3.5 text-brand-400" />
            <span className="font-hindi tracking-wide">{language === 'en' ? 'EN' : 'हि'}</span>
          </button>
        </div>
      </header>

      {/* Central Instagram-style Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10 py-3">
        <Card className="p-6 sm:p-7 bg-surface-900/85 backdrop-blur-xl border border-semantic-border-light shadow-2xl rounded-3xl relative">
          {/* Header Title & Branding */}
          <div className="text-center mb-5">
            <div className="w-12 h-12 mx-auto mb-2.5 bg-brand-500/10 border border-brand-500/25 rounded-2xl flex items-center justify-center text-brand-400 shadow-sm">
              <Sparkles className="w-5 h-5 text-brand-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {loginRole === 'admin'
                ? t('loginPage.adminTitle', 'Administrator Portal')
                : loginRole === 'worker'
                ? t('loginPage.workerTitle', 'Kaamgar Worker Login')
                : t('loginPage.customerTitle', 'Customer Login')}
            </h1>
            <p className="mt-1 text-[11px] sm:text-xs text-semantic-text-secondary">
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
              {unregisteredNotice && unregisteredNotice.role === 'customer' && (
                <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">
                        {t('auth.notRegisteredTitle', 'Account Not Found / Not Registered')}
                      </p>
                      <p className="text-amber-200/90 leading-relaxed">
                        {unregisteredNotice.message ||
                          t('auth.notRegisteredCustomerDesc', 'No account found with mobile number +91 {{phone}}. You are not registered yet. Please sign up to create your Kaamgar account first.', { phone: unregisteredNotice.phone })}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Link
                      to={`/register?role=customer&phone=${unregisteredNotice.phone}`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold text-xs shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{t('auth.signUpAsCustomerBtn', 'Sign Up as Customer (Free)')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {customerError && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{customerError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleCustomerPasswordLogin} className="space-y-4">
                <Input
                  label={t('loginPage.identifierLabel', 'Mobile Number or Email Address *')}
                  value={customerIdentifier}
                  onChange={e => {
                    setCustomerIdentifier(e.target.value)
                    if (unregisteredNotice) setUnregisteredNotice(null)
                    if (customerError) setCustomerError('')
                  }}
                  placeholder="9876543210 or name@gmail.com"
                  leftIcon={<User className="w-4 h-4 text-semantic-text-tertiary" />}
                  required
                  autoFocus
                />

                <div className="relative">
                  <Input
                    label={t('loginPage.passwordLabel', 'Password *')}
                    type={showCustomerPassword ? 'text' : 'password'}
                    value={customerPassword}
                    onChange={e => {
                      setCustomerPassword(e.target.value)
                      if (customerError) setCustomerError('')
                    }}
                    placeholder="••••••••••••"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowCustomerPassword(prev => !prev)}
                        className="text-semantic-text-tertiary hover:text-white p-1"
                        title={showCustomerPassword ? 'Hide password' : 'Show password'}
                        aria-label={showCustomerPassword ? 'Hide password' : 'Show password'}
                      >
                        {showCustomerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-[11px] text-semantic-text-tertiary">
                    {t('loginPage.needHelp', 'Forgot password or first login?')}
                  </span>
                  <button
                    type="button"
                    onClick={handleCustomerOtpRecovery}
                    disabled={customerLoading}
                    className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 underline cursor-pointer transition-colors"
                  >
                    {t('loginPage.signInWithOtpLink', 'Sign in with Mobile OTP')}
                  </button>
                </div>

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
            </div>
          )}

          {/* ================= 2. WORKER LOGIN FORM ================= */}
          {loginRole === 'worker' && (
            <div>
              {unregisteredNotice && unregisteredNotice.role === 'worker' && (
                <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">
                        {t('auth.notRegisteredWorkerTitle', 'Worker Account Not Found')}
                      </p>
                      <p className="text-amber-200/90 leading-relaxed">
                        {unregisteredNotice.message ||
                          t('auth.notRegisteredWorkerDesc', 'No worker account found with mobile number +91 {{phone}}. Please register as a verified Kaamgar artisan first to receive jobs.', { phone: unregisteredNotice.phone })}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Link
                      to={`/register?role=worker&phone=${unregisteredNotice.phone}`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{t('auth.registerAsWorkerBtn', 'Register as Worker / Artisan')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {workerRoleMismatch && (
                <div className="mb-4 p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5 text-blue-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                    <div>
                      <p className="font-semibold text-blue-300 mb-0.5">
                        {t('auth.customerAccountDetected', 'Customer Account Detected')}
                      </p>
                      <p className="text-blue-200/90 leading-relaxed">
                        {t('auth.customerAccountWorkerNotice', 'Mobile +91 {{phone}} is registered as a Customer. Please sign in under Customer login, or register this number as a Worker.', { phone: workerRoleMismatch.phone })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginRole('customer')
                        setSearchParams({ role: 'customer', phone: workerRoleMismatch.phone })
                        setCustomerIdentifier(workerRoleMismatch.phone)
                        setWorkerRoleMismatch(null)
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{t('auth.goToCustomerLogin', 'Go to Customer Login')}</span>
                    </button>
                    <Link
                      to={`/register?role=worker&phone=${workerRoleMismatch.phone}`}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors text-center"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{t('auth.registerAsWorkerBtn', 'Register as Worker')}</span>
                    </Link>
                  </div>
                </div>
              )}

              {workerError && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{workerError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleWorkerPasswordLogin} className="space-y-4">
                <Input
                  label={t('loginPage.workerIdentifierLabel', 'Worker Mobile Number or Email *')}
                  value={workerIdentifier}
                  onChange={e => {
                    setWorkerIdentifier(e.target.value)
                    if (unregisteredNotice) setUnregisteredNotice(null)
                    if (workerRoleMismatch) setWorkerRoleMismatch(null)
                    if (workerError) setWorkerError('')
                  }}
                  placeholder="9876543210 or worker@gmail.com"
                  leftIcon={<Truck className="w-4 h-4 text-semantic-text-tertiary" />}
                  required
                  autoFocus
                />

                <div className="relative">
                  <Input
                    label={t('loginPage.passwordLabel', 'Password *')}
                    type={showWorkerPassword ? 'text' : 'password'}
                    value={workerPassword}
                    onChange={e => {
                      setWorkerPassword(e.target.value)
                      if (workerError) setWorkerError('')
                    }}
                    placeholder="••••••••••••"
                    leftIcon={<Lock className="w-4 h-4 text-semantic-text-tertiary" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowWorkerPassword(prev => !prev)}
                        className="text-semantic-text-tertiary hover:text-white p-1"
                        title={showWorkerPassword ? 'Hide password' : 'Show password'}
                        aria-label={showWorkerPassword ? 'Hide password' : 'Show password'}
                      >
                        {showWorkerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-[11px] text-semantic-text-tertiary">
                    {t('loginPage.needHelp', 'Forgot password or first login?')}
                  </span>
                  <button
                    type="button"
                    onClick={handleWorkerOtpRecovery}
                    disabled={workerLoading}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer transition-colors"
                  >
                    {t('loginPage.signInWithOtpLink', 'Sign in with Mobile OTP')}
                  </button>
                </div>

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
          <div className="mt-5 pt-4 border-t border-semantic-border-light text-center space-y-3">
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

      {/* Bottom Footer Trust, Love & Copyright */}
      <footer className="relative z-10 w-full max-w-md mx-auto text-center py-2">
        <div className="flex items-center justify-center gap-2 text-[11px] text-semantic-text-tertiary">
          <span>100% ID Verified</span>
          <span>•</span>
          <span>0% Commission</span>
          <span>•</span>
          <span>Muzaffarnagar</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-semantic-text-secondary mt-1.5">
          <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400/20" />
          <span>{t('footer.madeWith', 'Made with ❤️ for Muzaffarnagar')}</span>
        </div>
        <p className="text-[10px] text-semantic-text-tertiary/70 mt-1">
          © 2026 {t('app.name')} • Hyperlocal Pilot
        </p>
      </footer>
    </div>
  )
}
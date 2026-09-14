import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input, Card } from '@kaamgar/ui'
import { useAuth } from '../context/AuthContext'
import { openOtpWidget } from '@/services/otp'
import { getSupabaseClient } from '@/lib/supabase'
import { Phone, AlertCircle, CheckCircle, ShieldCheck, ArrowRight, Mail, Lock, Shield } from 'lucide-react'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout, signInWithEmail, loginWithVerifiedPhone, signInWithGoogle, updatePhone, needsPhoneVerification } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Auth Mode: 'otp' for standard customers/workers, 'admin' for email+password admin login
  const [authMode, setAuthMode] = useState<'otp' | 'admin'>('otp')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')

  // Admin 2FA State
  const [admin2faStep, setAdmin2faStep] = useState<'credentials' | 'otp_challenge' | 'phone_setup'>('credentials')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminSetupPhone, setAdminSetupPhone] = useState('')

  // Mandatory phone verification state for Google sign-in redirect
  const [googlePhone, setGooglePhone] = useState('')
  const [googlePhoneLoading, setGooglePhoneLoading] = useState(false)
  const [googlePhoneError, setGooglePhoneError] = useState('')

  // Redirect based on role and verification
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
          // Admin account is logged into Supabase Auth, but 2FA is needed for this browser session
          setAuthMode('admin')
          const clean = (user.phone || '').replace(/\D/g, '').slice(-10)
          if (clean.length === 10) {
            setAdminPhone(clean)
            setAdmin2faStep('otp_challenge')
          } else {
            setAdmin2faStep('phone_setup')
          }
        }
      } else if (user.phone && user.phone.trim().length >= 10) {
        const timer = setTimeout(() => {
          navigate('/')
        }, 800)
        return () => clearTimeout(timer)
      }
    }
  }, [user, navigate])

  // Helper: Trigger MSG91 OTP Widget for Administrator 2FA
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
        setAdminError('2FA OTP widget could not be launched automatically (often blocked by pop-up or ad-blockers). Please pause ad-blockers and click "Open OTP Widget" below.')
      }
    } catch (err) {
      setAdminLoading(false)
      setAdminError('Unable to initiate 2FA OTP verification. Please retry.')
    }
  }

  // Handle Real Admin Email & Password Login -> Initiates 2FA
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

      // Strict Administrator Role Verification
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

        // Two-Factor Authentication via MSG91
        const rawPhone = profile?.phone || ''
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)

        if (cleanPhone.length === 10) {
          setAdminPhone(cleanPhone)
          setAdmin2faStep('otp_challenge')
          await launchAdmin2faOtp(cleanPhone)
        } else {
          // Admin account needs to register & verify a mobile number for 2FA
          setAdmin2faStep('phone_setup')
        }
      }
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Invalid administrator email or password')
    } finally {
      setAdminLoading(false)
    }
  }

  // Handle First-Time Admin Phone Setup & Verification
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

  // Handle Phone + MSG91 OTP Verification & Sign In for Customers/Workers
  const handleVerifyPhoneAndLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanPhone = phone.replace(/\D/g, '')
    if (!name.trim()) {
      setError('Please enter your full name')
      return
    }
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number')
      return
    }

    setLoading(true)

    try {
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          try {
            await loginWithVerifiedPhone(name.trim(), cleanPhone, 'customer', email.trim() || undefined)
            navigate('/')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed after verification')
          } finally {
            setLoading(false)
          }
        },
        onFailure: (err) => {
          setLoading(false)
          setError(
            typeof err === 'string'
              ? err
              : 'OTP verification failed or was cancelled. Please try again.'
          )
        },
      })

      if (!widgetOpened) {
        setLoading(false)
        setError('OTP verification service could not be loaded. Please disable ad-blockers or shields and try again.')
      }
    } catch (err) {
      setLoading(false)
      setError('Unable to launch OTP verification. Please try again.')
    }
  }

  // Optional: Auto-fill details from Google
  const handleAutoFillFromGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle(`${window.location.origin}/login`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google connection could not be initiated')
      setLoading(false)
    }
  }

  // Handle completing mandatory phone verification if arriving from Google
  const handleGooglePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGooglePhoneError('')
    const cleanPhone = googlePhone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setGooglePhoneError('Please enter a valid 10-digit Indian mobile number')
      return
    }

    setGooglePhoneLoading(true)
    try {
      const widgetOpened = await openOtpWidget({
        identifier: cleanPhone,
        onSuccess: async () => {
          await updatePhone(cleanPhone)
          navigate('/')
        },
        onFailure: (err) => {
          setGooglePhoneLoading(false)
          setGooglePhoneError(typeof err === 'string' ? err : 'OTP verification was cancelled or failed.')
        },
      })

      if (!widgetOpened) {
        setGooglePhoneLoading(false)
        setGooglePhoneError('OTP verification widget could not be loaded. Please ensure ad-blockers are disabled.')
      }
    } catch (err) {
      setGooglePhoneError(err instanceof Error ? err.message : 'Failed to verify phone')
      setGooglePhoneLoading(false)
    }
  }

  // CASE 1: Logged in via Google but Phone Number is Missing (Mandatory Requirement)
  if (user && needsPhoneVerification) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md p-8 bg-surface-100 border border-semantic-border-light shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center">
              <Phone className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-semantic-text-primary">
              {t('auth.phoneMandatory', 'Mobile Number Verification Required')}
            </h1>
            <p className="mt-2 text-sm text-semantic-text-secondary">
              Welcome, <strong className="text-semantic-text-primary">{user.name}</strong>! In Muzaffarnagar Kaamgar,
              a verified 10-digit Indian mobile number is mandatory to coordinate bookings with workers.
            </p>
          </div>

          {googlePhoneError && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{googlePhoneError}</span>
            </div>
          )}

          <form onSubmit={handleGooglePhoneSubmit} className="space-y-4">
            <Input
              label={t('auth.phoneLabel', 'Mobile Number')}
              value={googlePhone}
              onChange={e => setGooglePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              loading={googlePhoneLoading}
            >
              {t('auth.verifyViaOtp', 'Verify via OTP')}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  // CASE 2: Already Logged In With Verified Phone (and not an unverified admin session)
  if (user && user.phone && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-semantic-bg-primary">
        <div className="text-center p-6">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-400 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-semantic-text-primary">
            Welcome back, {user.name}!
          </h2>
          <p className="mt-2 text-semantic-text-secondary mb-6">
            Signed in with verified mobile: <span className="text-brand-400 font-semibold">{user.phone}</span>
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    )
  }

  // CASE 3: Main Authentication Card
  return (
    <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md p-8 bg-surface-100 border border-semantic-border-light shadow-2xl">
        {/* Auth Mode Segmented Control Tabs */}
        <div className="flex rounded-xl bg-surface-200/80 p-1 mb-6 border border-semantic-border-light">
          <button
            type="button"
            onClick={() => {
              setAuthMode('otp')
              setError('')
              setAdminError('')
              setAdmin2faStep('credentials')
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'otp'
                ? 'bg-brand-500 text-white shadow-md'
                : 'text-semantic-text-secondary hover:text-semantic-text-primary'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Customer (OTP)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('admin')
              setError('')
              setAdminError('')
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'admin'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-semantic-text-secondary hover:text-semantic-text-primary'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin / Staff Login</span>
          </button>
        </div>

        {/* ================= ADMIN SIGN IN FLOW (CREDENTIALS + 2FA) ================= */}
        {authMode === 'admin' ? (
          <div>
            {admin2faStep === 'credentials' && (
              <div>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center shadow-inner">
                    <ShieldCheck className="w-8 h-8 text-amber-400" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full">
                    2FA Secured Console
                  </span>
                  <h1 className="text-2xl font-bold text-semantic-text-primary">
                    Administrator Sign In
                  </h1>
                  <p className="mt-1.5 text-sm text-semantic-text-secondary">
                    Step 1: Enter your registered credentials. Mobile OTP 2FA will follow automatically.
                  </p>
                </div>

                {adminError && (
                  <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{adminError}</span>
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <Input
                    label="Admin Email Address"
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@muzaffarnagarkaamgar.com"
                    leftIcon={<Mail className="w-5 h-5 text-semantic-text-tertiary" />}
                    required
                    autoFocus
                  />

                  <Input
                    label="Password"
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
                    className="w-full mt-3 bg-amber-600 hover:bg-amber-500 text-white font-medium border-none shadow-lg shadow-amber-600/20"
                    size="lg"
                    loading={adminLoading}
                  >
                    Authenticate & Launch 2FA OTP
                  </Button>
                </form>

                <div className="mt-6 pt-4 border-t border-semantic-border-light text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode('otp')}
                    className="text-xs text-semantic-text-secondary hover:text-brand-300 transition-colors"
                  >
                    ← Back to Customer Mobile OTP Sign In
                  </button>
                </div>
              </div>
            )}

            {admin2faStep === 'otp_challenge' && (
              <div>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center shadow-inner animate-pulse">
                    <Shield className="w-8 h-8 text-amber-400" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded-full">
                    Step 2 of 2: Mobile 2FA Verification
                  </span>
                  <h1 className="text-2xl font-bold text-semantic-text-primary">
                    Verify Your Identity
                  </h1>
                  <p className="mt-1.5 text-sm text-semantic-text-secondary">
                    We've triggered an OTP via MSG91 to your administrator mobile:
                  </p>
                  <p className="mt-2 text-lg font-bold text-amber-400 tracking-wider">
                    +91 ••••••{adminPhone.slice(-4)}
                  </p>
                </div>

                {adminError && (
                  <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{adminError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium border-none shadow-lg shadow-amber-600/20 py-3"
                    size="lg"
                    loading={adminLoading}
                    onClick={() => launchAdmin2faOtp(adminPhone)}
                  >
                    <ShieldCheck className="w-5 h-5 mr-2" />
                    Open OTP Verification Widget
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
                    Cancel & Sign Out
                  </Button>
                </div>
              </div>
            )}

            {admin2faStep === 'phone_setup' && (
              <div>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center shadow-inner">
                    <Phone className="w-8 h-8 text-amber-400" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded-full">
                    Mandatory 2FA Setup
                  </span>
                  <h1 className="text-2xl font-bold text-semantic-text-primary">
                    Link Administrator Mobile
                  </h1>
                  <p className="mt-1.5 text-sm text-semantic-text-secondary">
                    Your administrator account requires a verified mobile number to receive mandatory 2FA OTP codes on every sign in.
                  </p>
                </div>

                {adminError && (
                  <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{adminError}</span>
                  </div>
                )}

                <form onSubmit={handleAdminPhoneSetupSubmit} className="space-y-4">
                  <Input
                    label="Administrator Mobile Number (10 digits)"
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
                    Verify via OTP & Link Mobile
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
                    Cancel & Sign Out
                  </Button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* ================= CUSTOMER MOBILE OTP LOGIN ================= */
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-brand-400" />
              </div>
              <h1 className="text-2xl font-bold text-semantic-text-primary">
                {t('auth.loginTitle', 'Customer & Worker Login')}
              </h1>
              <p className="mt-1.5 text-sm text-semantic-text-secondary">
                Enter your mobile number to verify via secure OTP
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPhoneAndLogin} className="space-y-4">
              <Input
                label={t('auth.nameLabel', 'Full Name')}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your Full Name"
                required
                autoFocus
              />

              <div>
                <Input
                  label={t('auth.phoneLabel', 'Mobile Number (10 digits)')}
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  leftIcon={<span className="text-sm font-semibold text-semantic-text-secondary">+91</span>}
                  required
                />
                <p className="mt-1 text-xs text-semantic-text-tertiary">
                  We will send a 6-digit verification code to this number.
                </p>
              </div>

              <div>
                <Input
                  label={t('auth.emailOptional', 'Email Address (Optional)')}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  leftIcon={<Mail className="w-5 h-5 text-semantic-text-tertiary" />}
                />
                <p className="mt-1 text-xs text-semantic-text-tertiary">
                  Optional: For receipts and booking updates.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                size="lg"
                loading={loading}
              >
                {t('auth.verifyViaOtp', 'Verify Mobile via OTP & Sign In')}
              </Button>
            </form>

            {/* Optional Google Auto-fill helper */}
            <div className="mt-4 pt-3 border-t border-semantic-border-light/60 text-center">
              <button
                type="button"
                onClick={handleAutoFillFromGoogle}
                className="inline-flex items-center gap-2 text-xs text-semantic-text-tertiary hover:text-brand-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Optional: Auto-fill details from Google account</span>
              </button>
            </div>

            {/* Worker Registration Link */}
            <div className="mt-5 pt-4 border-t border-semantic-border-light text-center">
              <p className="text-sm text-semantic-text-secondary mb-1.5">Are you a skilled worker or tradesperson?</p>
              <Link
                to="/register/worker"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                <span>Register as a Kaamgar Worker</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Direct Admin switch helper */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('admin')
                  setAdmin2faStep('credentials')
                }}
                className="text-xs text-semantic-text-tertiary hover:text-amber-400 transition-colors inline-flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                <span>Platform Administrator? Sign in with Email & 2FA</span>
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
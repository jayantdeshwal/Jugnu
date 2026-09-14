import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, Button, Badge } from '@kaamgar/ui'
import { LogIn, UserPlus, Shield, Truck, ArrowRight, CheckCircle2, Sparkles, ArrowLeft } from 'lucide-react'

export default function AuthChoice() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-64px)] bg-semantic-bg-primary flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-semantic-text-tertiary hover:text-brand-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back', 'Back to Home')}</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('authChoice.badge', 'Muzaffarnagar Kaamgar Portal')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-semantic-text-primary tracking-tight">
            {t('authChoice.title', 'Welcome to Muzaffarnagar Kaamgar')}
          </h1>
          <p className="mt-2 text-base text-semantic-text-secondary max-w-lg mx-auto">
            {t(
              'authChoice.subtitle',
              'Your trusted local platform connecting residents with verified skilled workers. How would you like to proceed?'
            )}
          </p>
        </div>

        {/* Selection Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* OPTION 1: LOG IN */}
          <Card
            className="p-8 bg-surface-100 border border-semantic-border-light hover:border-brand-500/40 transition-all duration-200 flex flex-col justify-between group shadow-xl hover:shadow-2xl hover:shadow-brand-500/5 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-500/10 transition-colors" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-105 transition-transform">
                  <LogIn className="w-7 h-7" />
                </div>
                <Badge variant="outline" size="sm" className="border-brand-500/30 text-brand-300">
                  {t('authChoice.loginBadge', 'Existing Account')}
                </Badge>
              </div>

              <h2 className="text-xl font-bold text-semantic-text-primary mb-2">
                {t('authChoice.loginTitle', 'Log In / Sign In')}
              </h2>
              <p className="text-xs text-semantic-text-secondary leading-relaxed mb-6">
                {t(
                  'authChoice.loginDesc',
                  'Already registered with Kaamgar? Sign in to access your bookings, worker dashboard, or administrator portal.'
                )}
              </p>

              <div className="space-y-2.5 mb-6 text-xs text-semantic-text-tertiary">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>{t('authChoice.loginPoint1', 'Customer booking dashboard & status')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>{t('authChoice.loginPoint2', 'Kaamgar worker job management')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>{t('authChoice.loginPoint3', 'Secure 2FA-protected administrator console')}</span>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/login')}
              className="w-full justify-center group-hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20 py-3 text-sm font-semibold"
            >
              <span>{t('authChoice.loginBtn', 'Go to Login')}</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>

          {/* OPTION 2: SIGN UP (NEW TO KAAMGAR) */}
          <Card
            className="p-8 bg-surface-100 border border-semantic-border-light hover:border-emerald-500/40 transition-all duration-200 flex flex-col justify-between group shadow-xl hover:shadow-2xl hover:shadow-emerald-500/5 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-7 h-7" />
                </div>
                <Badge variant="success" size="sm">
                  {t('authChoice.registerBadge', 'New to Kaamgar')}
                </Badge>
              </div>

              <h2 className="text-xl font-bold text-semantic-text-primary mb-2">
                {t('authChoice.registerTitle', 'New to Kaamgar? Sign Up')}
              </h2>
              <p className="text-xs text-semantic-text-secondary leading-relaxed mb-6">
                {t(
                  'authChoice.registerDesc',
                  'Join Muzaffarnagar Kaamgar for the first time as a Customer seeking services or as a skilled Worker seeking daily work.'
                )}
              </p>

              <div className="space-y-2.5 mb-6 text-xs text-semantic-text-tertiary">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('authChoice.registerPoint1', 'Customer Sign Up: Book local electricians, plumbers & more')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('authChoice.registerPoint2', 'Worker Sign Up: Verified artisan profile to get direct jobs')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('authChoice.registerPoint3', 'Simple mobile OTP verification & password setup')}</span>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/register')}
              className="w-full justify-center bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/20 py-3 text-sm font-semibold border-none"
            >
              <span>{t('authChoice.registerBtn', 'Create Account (Sign Up)')}</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>
        </div>

        {/* Footer Security Assurance */}
        <div className="mt-8 text-center text-xs text-semantic-text-tertiary flex items-center justify-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-brand-400" />
            {t('authChoice.trustWorkers', '100% Verified Local Professionals')}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-emerald-400" />
            {t('authChoice.trustAreas', 'Muzaffarnagar City & Surrounding Tehsil Areas')}
          </span>
        </div>
      </div>
    </div>
  )
}

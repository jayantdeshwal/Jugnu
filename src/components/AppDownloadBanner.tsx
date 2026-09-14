import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Badge } from '@kaamgar/ui'
import {
  Smartphone,
  Download,
  CheckCircle2,
  Share,
  PlusSquare,
  Sparkles,
  Zap,
  ShieldCheck,
  Percent,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { triggerPWAInstall } from './PWAInstallPrompt'

export default function AppDownloadBanner() {
  const { t } = useTranslation()
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [installedSuccess, setInstalledSuccess] = useState(false)

  useEffect(() => {
    // Check if running in standalone mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    setIsStandalone(standalone)

    const userAgent = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))
  }, [])

  const handleInstallClick = async () => {
    const installed = await triggerPWAInstall()
    if (installed) {
      setInstalledSuccess(true)
    } else {
      // If native prompt wasn't available (iOS Safari, or dismissed earlier), show instructions
      setShowInstructions(prev => !prev)
    }
  }

  return (
    <section className="section bg-gradient-to-b from-surface-950 via-surface-900 to-surface-950 border-t border-semantic-border-light py-16 sm:py-20 relative overflow-hidden">
      {/* Background radial aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container-app relative z-10">
        <div className="rounded-3xl bg-gradient-to-br from-surface-900 via-surface-850 to-surface-900 border border-brand-500/30 p-8 sm:p-12 lg:p-14 shadow-2xl relative overflow-hidden">
          {/* Subtle decorative grid lines */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Content (8 cols on lg) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>{t('appBanner.eyebrow', 'Official Mobile App • <2MB Storage')}</span>
              </div>

              {/* Main Heading */}
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {t('appBanner.title', 'Get the Muzaffarnagar Kaamgar Mobile App')}
              </h2>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-semantic-text-secondary leading-relaxed max-w-xl">
                {t(
                  'appBanner.subtitle',
                  'Install the app directly on your phone for faster bookings, 1-tap WhatsApp chat, and 0% commission local artisan services.'
                )}
              </p>

              {/* 4 Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-950/60 border border-semantic-border-light/40">
                  <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {t('appBanner.feature1Title', 'Under 2MB Size')}
                    </h4>
                    <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                      {t('appBanner.feature1Desc', 'Takes almost no phone memory and works fast on any network.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-950/60 border border-semantic-border-light/40">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {t('appBanner.feature2Title', 'Instant 1-Tap Access')}
                    </h4>
                    <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                      {t('appBanner.feature2Desc', 'Launches directly from your home screen just like a native app.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-950/60 border border-semantic-border-light/40">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {t('appBanner.feature4Title', '100% ID Verified')}
                    </h4>
                    <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                      {t('appBanner.feature4Desc', 'Direct contact with verified Muzaffarnagar artisans.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-950/60 border border-semantic-border-light/40">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {t('appBanner.feature3Title', '0% Commission')}
                    </h4>
                    <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                      {t('appBanner.feature3Desc', 'No intermediary fees for the starting 3 months.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button & Status */}
              <div className="pt-3 flex flex-wrap items-center gap-4">
                {isStandalone || installedSuccess ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('appBanner.installedStatus', 'App Already Installed on This Device')}</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500 text-surface-950 font-black text-sm sm:text-base shadow-2xl shadow-brand-500/40 hover:shadow-brand-500/60 hover:scale-[1.03] active:scale-[0.98] transition-all border border-amber-200 cursor-pointer group"
                    >
                      <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform text-surface-950 animate-bounce" />
                      <span className="uppercase tracking-tight">{t('appBanner.installBtn', 'Install Mobile App Now')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInstructions(prev => !prev)}
                      className="inline-flex items-center gap-1.5 text-xs text-semantic-text-secondary hover:text-white transition-colors underline underline-offset-4"
                    >
                      <span>How to install?</span>
                      {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>

              {/* Collapsible Step-by-Step Instructions if prompted */}
              {showInstructions && !isStandalone && (
                <div className="mt-4 p-4 rounded-2xl bg-surface-950/80 border border-brand-500/30 text-xs text-semantic-text-secondary space-y-2 animate-slide-in">
                  <h5 className="font-semibold text-white text-xs flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-brand-400" />
                    {isIOS
                      ? t('appBanner.iosTitle', 'Installing on iPhone (Safari):')
                      : t('appBanner.androidManualTitle', 'Installing on Android (Chrome):')}
                  </h5>

                  {isIOS ? (
                    <ul className="space-y-1.5 text-xs text-semantic-text-secondary pl-1">
                      <li className="flex items-center gap-2">
                        <Share className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>{t('appBanner.iosStep1', '1. Tap the Share button at the bottom of Safari')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{t('appBanner.iosStep2', "2. Select 'Add to Home Screen' and tap Add")}</span>
                      </li>
                    </ul>
                  ) : (
                    <p className="leading-relaxed">
                      {t(
                        'appBanner.androidManualDesc',
                        "Tap the 3 dots (⋮) in Chrome and select 'Install app' or 'Add to Home screen' to add the Kaamgar icon to your phone."
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Visual: Realistic App Preview Card (5 cols on lg) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-sm p-6 rounded-3xl bg-surface-950/90 border border-semantic-border-light shadow-2xl relative overflow-hidden backdrop-blur-xl">
                {/* Glowing border accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-amber-400 to-emerald-500" />

                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Big App Icon with shadow */}
                  <div className="w-24 h-24 rounded-2xl bg-surface-900 border-2 border-brand-500/40 p-2 shadow-xl shadow-brand-500/10 flex items-center justify-center relative">
                    <img
                      src="/icon-192.png"
                      alt="Muzaffarnagar Kaamgar Icon"
                      className="w-full h-full object-contain rounded-xl"
                    />
                    <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-surface-950 text-[9px] font-extrabold tracking-wider uppercase shadow">
                      Verified
                    </div>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-lg text-white tracking-tight">
                      मुजफ्फरनगर का कामगार
                    </h3>
                    <p className="text-xs text-brand-400 font-medium mt-0.5">
                      Muzaffarnagar Kaamgar App
                    </p>
                  </div>

                  {/* Rating & Local community trust */}
                  <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-surface-900 border border-semantic-border-light text-xs">
                    <span className="text-amber-400 font-bold">★ 4.9</span>
                    <span className="text-semantic-text-tertiary">•</span>
                    <span className="text-semantic-text-secondary">Official Citizen Pilot</span>
                  </div>

                  <p className="text-xs text-semantic-text-tertiary leading-relaxed px-4">
                    Install once, use anytime on your mobile home screen with zero clutter and zero commission.
                  </p>

                  <div className="pt-2 w-full border-t border-surface-900 flex items-center justify-around text-[11px] text-semantic-text-secondary">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Android Ready
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-blue-400">
                      iOS Compatible
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

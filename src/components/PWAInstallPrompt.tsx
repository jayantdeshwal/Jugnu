import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@kaamgar/ui'
import { Download, X, Smartphone, Share, PlusSquare, Sparkles, ChevronRight, HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

// Global deferred prompt holder so header/menu buttons can also trigger install
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null

export function triggerPWAInstall(): Promise<boolean> {
  if (globalDeferredPrompt) {
    return globalDeferredPrompt.prompt().then(() => {
      return globalDeferredPrompt!.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          globalDeferredPrompt = null
          return true
        }
        return false
      })
    })
  }
  // If native prompt is not available, dispatch custom event to open the in-app guide
  window.dispatchEvent(new CustomEvent('open-pwa-install-dialog'))
  return Promise.resolve(false)
}

export function canInstallPWA(): boolean {
  return globalDeferredPrompt !== null
}

export default function PWAInstallPrompt() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed as an app)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    setIsStandalone(standalone)
    if (standalone) return

    // 2. Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    // 3. Clear any legacy 3-day dismissal lock so users can test immediately
    localStorage.removeItem('kaamgar_pwa_dismissed')

    // 4. Capture native beforeinstallprompt (Chrome Android/Desktop)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      globalDeferredPrompt = e
      setDeferredPrompt(e)
      setIsExpanded(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 5. Custom event listener for when users click "Install App" elsewhere
    const handleOpenDialog = () => {
      setIsExpanded(true)
      setShowGuide(true)
    }
    window.addEventListener('open-pwa-install-dialog', handleOpenDialog)

    // 6. Pop up automatically after a gentle 1.5s delay on initial exploration
    const timer = setTimeout(() => {
      setIsExpanded(true)
    }, 1500)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('open-pwa-install-dialog', handleOpenDialog)
      clearTimeout(timer)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsExpanded(false)
        setDeferredPrompt(null)
        globalDeferredPrompt = null
      }
    } else {
      // If native deferred prompt isn't directly triggerable (iOS or desktop), toggle the guide
      setShowGuide(prev => !prev)
    }
  }

  // If already installed, hide everything
  if (isStandalone) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        {/* State A: Minimized Floating Highlighted Pill Button */}
        {!isExpanded && (
          <motion.div
            key="minimized-pill"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            className="flex justify-end pointer-events-auto"
          >
            <button
              onClick={() => {
                setIsExpanded(true)
              }}
              className="group relative flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500 text-surface-950 font-black text-xs sm:text-sm shadow-2xl shadow-brand-500/40 hover:scale-105 active:scale-95 transition-all border-2 border-amber-200 ring-4 ring-brand-500/25"
              aria-label="Install Kaamgar Mobile App"
            >
              {/* Pulsing indicator ring */}
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-surface-950" />
              </span>

              <Download className="w-4 h-4 animate-bounce shrink-0" />
              <span className="tracking-tight uppercase">
                {t('pwa.installApp', 'Install App')}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
        )}

        {/* State B: Expanded Full Highlighted Pop-up Banner */}
        {isExpanded && (
          <motion.div
            key="expanded-card"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="pointer-events-auto"
          >
            <div className="p-4 sm:p-5 rounded-2xl bg-surface-900/95 border-2 border-brand-500/50 shadow-2xl shadow-brand-500/20 backdrop-blur-2xl text-white relative overflow-hidden">
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-400 via-amber-300 to-emerald-400" />

              <div className="flex items-start gap-3.5">
                {/* App Icon */}
                <div className="w-14 h-14 rounded-2xl bg-surface-800 border-2 border-brand-500/40 overflow-hidden shrink-0 flex items-center justify-center p-1.5 shadow-lg shadow-brand-500/15 relative">
                  <img src="/icon-192.png" alt="App Icon" className="w-full h-full object-contain rounded-xl" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-surface-900" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Sparkles className="w-3 h-3 text-brand-400" />
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-brand-400">
                          Official PWA
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-snug">
                        {t('pwa.installBannerTitle', 'Install Kaamgar App')}
                      </h4>
                    </div>

                    {/* Minimize / Close button */}
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="p-1.5 rounded-lg text-semantic-text-tertiary hover:text-white hover:bg-surface-800 transition-colors shrink-0"
                      title="Minimize"
                      aria-label="Minimize"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-semantic-text-secondary mt-1.5 leading-relaxed">
                    {t(
                      'pwa.installBannerSubtitle',
                      'Add to your home screen for fast booking, zero fees, and direct artisan contact.'
                    )}
                  </p>

                  {/* Step-by-Step Instructions if native prompt isn't directly available */}
                  {showGuide ? (
                    <div className="mt-3 p-3 rounded-xl bg-surface-950 border border-brand-500/30 text-xs text-semantic-text-secondary space-y-1.5 animate-slide-in">
                      <div className="flex items-center justify-between text-white font-semibold text-[11px] mb-1">
                        <span className="flex items-center gap-1.5 text-brand-400">
                          <HelpCircle className="w-3.5 h-3.5" />
                          {isIOS ? 'iPhone Safari Steps:' : 'Android Chrome Steps:'}
                        </span>
                        <button
                          onClick={() => setShowGuide(false)}
                          className="text-[10px] text-semantic-text-tertiary hover:text-white"
                        >
                          Hide
                        </button>
                      </div>

                      {isIOS ? (
                        <>
                          <p className="flex items-center gap-1.5 text-[11px]">
                            <Share className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>1. Tap the <strong>Share</strong> button at bottom of Safari</span>
                          </p>
                          <p className="flex items-center gap-1.5 text-[11px]">
                            <PlusSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>2. Scroll down & tap <strong>'Add to Home Screen'</strong></span>
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] leading-relaxed">
                          Tap the <strong>3 dots (⋮)</strong> in Chrome at the top right, then select <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong>.
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Primary Action Buttons */
                    <div className="mt-3.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500 text-surface-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all border border-amber-200"
                      >
                        <Download className="w-4 h-4 animate-bounce" />
                        <span>{t('pwa.installBtn', 'Install App Now')}</span>
                      </button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(false)}
                        className="text-xs text-semantic-text-tertiary hover:text-white py-2 px-3"
                      >
                        <span>{t('pwa.laterBtn', 'Later')}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

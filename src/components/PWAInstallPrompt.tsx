import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@kaamgar/ui'
import { Download, X, Smartphone, Share, PlusSquare } from 'lucide-react'
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
  return Promise.resolve(false)
}

export function canInstallPWA(): boolean {
  return globalDeferredPrompt !== null
}

export default function PWAInstallPrompt() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // 1. Check if already installed in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) {
      return // Already installed, do not show
    }

    // 2. Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    // 3. Check dismissal timestamp
    const dismissedAt = localStorage.getItem('kaamgar_pwa_dismissed')
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismiss < 3) {
        return // Dismissed recently
      }
    }

    // 4. Android / Chrome `beforeinstallprompt` event listener
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      globalDeferredPrompt = e
      setDeferredPrompt(e)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // If on iOS and not dismissed, show after 4 seconds of user exploration
    let iosTimer: NodeJS.Timeout
    if (isIosDevice && !isStandalone) {
      iosTimer = setTimeout(() => {
        setIsVisible(true)
      }, 4000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsVisible(false)
        setDeferredPrompt(null)
        globalDeferredPrompt = null
      }
    } else if (isIOS) {
      setShowIOSGuide(true)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('kaamgar_pwa_dismissed', Date.now().toString())
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
      >
        <div className="p-4 rounded-2xl bg-surface-900/95 border border-brand-500/40 shadow-2xl backdrop-blur-xl text-white">
          <div className="flex items-start gap-3.5">
            {/* App Icon */}
            <div className="w-12 h-12 rounded-xl bg-surface-800 border border-brand-500/30 overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-md">
              <img src="/icon-192.png" alt="App Icon" className="w-full h-full object-contain rounded-lg" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-sm text-white tracking-tight">
                  {t('pwa.installBannerTitle', 'Install Kaamgar App')}
                </h4>
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded-lg text-semantic-text-tertiary hover:text-white hover:bg-surface-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-semantic-text-secondary mt-1 leading-relaxed">
                {t(
                  'pwa.installBannerSubtitle',
                  'Add to your home screen for fast booking, zero fees, and direct artisan contact.'
                )}
              </p>

              {/* iOS Guide popup inline if requested */}
              {showIOSGuide ? (
                <div className="mt-3 p-2.5 rounded-xl bg-surface-800 border border-semantic-border-light text-[11px] text-brand-300 space-y-1 animate-fade-in">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Share className="w-3.5 h-3.5 text-blue-400" />
                    1. Tap the <strong>Share</strong> button in Safari
                  </p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                    2. Select <strong>'Add to Home Screen'</strong>
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleInstallClick}
                    className="font-semibold text-xs py-2 px-3.5 shadow-md shadow-brand-500/20"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    <span>{t('pwa.installBtn', 'Install App')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
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
    </AnimatePresence>
  )
}

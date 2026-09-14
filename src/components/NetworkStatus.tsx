import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowBackOnline(true)
      const timer = setTimeout(() => {
        setShowBackOnline(false)
      }, 3500)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowBackOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-xs sm:text-sm font-medium py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md animate-in"
      >
        <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
        <span>आप इंटरनेट से डिस्कनेक्ट हैं / You are currently offline. Check your internet connection.</span>
      </div>
    )
  }

  if (showBackOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-xs sm:text-sm font-medium py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md animate-in"
      >
        <Wifi className="w-4 h-4 flex-shrink-0" />
        <span>इंटरनेट पुनः कनेक्ट हो गया / Back online!</span>
      </div>
    )
  }

  return null
}

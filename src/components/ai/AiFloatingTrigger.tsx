import React from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../context/LanguageContext'
import { useAiAssistant } from '../../context/AiAssistantContext'
import { useAuth } from '../../context/AuthContext'
import { Sparkles, Bot, MessageCircle } from 'lucide-react'

export default function AiFloatingTrigger() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const location = useLocation()
  const { isWorker } = useAuth()
  const { isOpen, openAssistant } = useAiAssistant()

  // Hide on auth pages or if modal is open
  const isAuthPage = location.pathname === '/login' || location.pathname === '/auth' || location.pathname === '/register'
  if (isAuthPage || isOpen) return null

  const isHindi = language === 'hi'
  const isWorkerRoute = location.pathname.startsWith('/worker')

  const handleOpen = () => {
    if (isWorkerRoute || isWorker) {
      openAssistant('worker_sarathi')
    } else {
      openAssistant('customer_booking')
    }
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-40 animate-fade-in">
      <button
        onClick={handleOpen}
        className="group relative flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 text-white shadow-xl hover:shadow-brand-500/25 border border-brand-400/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
        aria-label="Open AI Assistant"
      >
        {/* Glow backdrop */}
        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 opacity-40 blur group-hover:opacity-75 transition duration-300 -z-10" />

        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[11px] font-extrabold tracking-tight leading-none text-white flex items-center gap-1">
            {isWorkerRoute || isWorker
              ? isHindi
                ? 'कारीगर सारथी'
                : 'Kaamgar Sarathi'
              : isHindi
              ? 'कामगार AI'
              : 'Kaamgar AI'}
          </span>
          <span className="text-[9px] text-white/80 leading-none pt-0.5">
            {isWorkerRoute || isWorker
              ? isHindi
                ? 'व्यवसाय मित्र'
                : 'Artisan Coach'
              : isHindi
              ? '24x7 सहायता'
              : 'Instant Help'}
          </span>
        </div>
      </button>
    </div>
  )
}

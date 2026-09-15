import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../context/LanguageContext'
import { useAiAssistant } from '../../context/AiAssistantContext'
import { useAuth } from '../../context/AuthContext'
import { ASSISTANT_CONFIGS } from '../../services/ai/domainKnowledge'
import { AssistantPersona, ChatAction } from '../../services/ai/types'
import {
  X,
  Send,
  Sparkles,
  Bot,
  ExternalLink,
  Copy,
  Check,
  Zap,
  RotateCcw,
  Shield,
  Briefcase,
  Search,
  MessageCircle,
  PhoneCall,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
} from 'lucide-react'

export default function AiAssistantModal() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { isWorker, isAdmin } = useAuth()
  const navigate = useNavigate()
  const {
    isOpen,
    activePersona,
    messages,
    isTyping,
    closeAssistant,
    switchPersona,
    sendMessage,
    clearHistory,
  } = useAiAssistant()

  const [input, setInput] = useState('')
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isHindi = language === 'hi'
  const currentConfig = ASSISTANT_CONFIGS[activePersona]
  const currentMessages = messages[activePersona] || []

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentMessages, isTyping, isOpen])

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 200)
    }
  }, [isOpen, activePersona])

  if (!isOpen) return null

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isTyping) return
    const text = input
    setInput('')
    await sendMessage(text)
  }

  const handleChipClick = async (query: string) => {
    if (isTyping) return
    await sendMessage(query)
  }

  const handleActionClick = (action: ChatAction) => {
    if (action.type === 'navigate') {
      closeAssistant()
      navigate(action.payload)
    } else if (action.type === 'external_link') {
      window.open(action.payload, '_blank', 'noopener,noreferrer')
    } else if (action.type === 'copy_text') {
      navigator.clipboard.writeText(action.payload)
      setCopiedActionId(action.id)
      setTimeout(() => setCopiedActionId(null), 2500)
    } else if (action.type === 'quick_reply') {
      sendMessage(action.payload)
    }
  }

  const getActionIcon = (action: ChatAction) => {
    if (action.icon === 'Zap') return <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    if (action.icon === 'Search') return <Search className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    if (action.icon === 'MessageCircle') return <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    if (action.icon === 'PhoneCall') return <PhoneCall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    if (action.icon === 'Calendar') return <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
    if (action.icon === 'Copy') {
      return copiedActionId === action.id ? (
        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      )
    }
    return <ArrowRight className="w-3.5 h-3.5 text-semantic-text-tertiary shrink-0" />
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) closeAssistant()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Kaamgar AI Assistant"
    >
      <div className="w-full sm:max-w-lg h-[92vh] sm:h-[650px] max-h-[92vh] bg-surface-100 border border-semantic-border-medium rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-semantic-text-primary">
        {/* Top Handle for mobile drag visual */}
        <div className="w-12 h-1.5 bg-surface-300 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header Bar */}
        <div className="px-4 py-3.5 border-b border-semantic-border-light/80 bg-surface-200/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500/20 to-emerald-500/20 border border-brand-500/30 flex items-center justify-center text-xl shadow-inner">
              {currentConfig.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {isHindi ? currentConfig.nameHi : currentConfig.nameEn}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {isHindi ? currentConfig.badgeHi : currentConfig.badgeEn}
                </span>
              </div>
              <p className="text-[11px] text-semantic-text-secondary">
                {isHindi ? currentConfig.roleTitleHi : currentConfig.roleTitleEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => clearHistory(activePersona)}
              className="p-1.5 rounded-xl text-semantic-text-tertiary hover:text-white hover:bg-surface-300 transition-colors"
              title={isHindi ? 'बातचीत रीसेट करें' : 'Reset Conversation'}
              aria-label="Reset Chat"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={closeAssistant}
              className="p-1.5 rounded-xl text-semantic-text-tertiary hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Persona Switcher Tabs */}
        <div className="px-3 py-2 bg-surface-200/30 border-b border-semantic-border-light/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* Persona 1: Customer Booking Mitra */}
          <button
            onClick={() => switchPersona('customer_booking')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activePersona === 'customer_booking'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-surface-200/60 text-semantic-text-secondary hover:text-white hover:bg-surface-300'
            }`}
          >
            <span>🛠️</span>
            <span>{isHindi ? 'बुकिंग मित्र' : 'Booking Guide'}</span>
          </button>

          {/* Persona 2: Customer Support & Resolution */}
          <button
            onClick={() => switchPersona('customer_care')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activePersona === 'customer_care'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-surface-200/60 text-semantic-text-secondary hover:text-white hover:bg-surface-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{isHindi ? 'समाधान व सहायता' : 'Care & Support'}</span>
          </button>

          {/* Persona 3: Worker Sarathi Coach */}
          <button
            onClick={() => switchPersona('worker_sarathi')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activePersona === 'worker_sarathi'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-surface-200/60 text-semantic-text-secondary hover:text-white hover:bg-surface-300'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>{isHindi ? 'कारीगर सारथी' : 'Artisan Coach'}</span>
          </button>
        </div>

        {/* Quick Suggestion Chips Carousel */}
        <div className="px-3 py-2 bg-surface-200/20 border-b border-semantic-border-light/30 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 w-max">
            {currentConfig.chips.map(chip => (
              <button
                key={chip.id}
                onClick={() => handleChipClick(chip.query)}
                disabled={isTyping}
                className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-surface-200 hover:bg-surface-300 text-semantic-text-secondary hover:text-white border border-semantic-border-light/60 transition-colors whitespace-nowrap"
              >
                {isHindi ? chip.labelHi : chip.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentMessages.map(msg => {
            const isUser = msg.sender === 'user'
            const messageText = isHindi ? msg.textHi || msg.textEn : msg.textEn

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-surface-300 border border-semantic-border-light flex items-center justify-center text-sm shrink-0 mt-0.5">
                    {ASSISTANT_CONFIGS[msg.persona]?.avatar || '🤖'}
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-surface-200/90 text-semantic-text-primary rounded-tl-none border border-semantic-border-light/60 shadow-sm'
                  }`}
                >
                  {/* Message body with basic markdown line formatting */}
                  <div className="whitespace-pre-line space-y-1.5">
                    {messageText.split('\n\n').map((para, idx) => (
                      <p key={idx} className="break-words">
                        {para}
                      </p>
                    ))}
                  </div>

                  {/* Actions / Deep-Links */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-semantic-border-light/60 flex flex-col gap-1.5">
                      {msg.actions.map(action => (
                        <button
                          key={action.id}
                          onClick={() => handleActionClick(action)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-surface-300 hover:bg-surface-400/80 text-[11px] font-semibold text-semantic-text-primary hover:text-white border border-semantic-border-light transition-all text-left"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {getActionIcon(action)}
                            <span className="truncate">
                              {isHindi ? action.labelHi : action.labelEn}
                            </span>
                          </div>
                          <span className="text-[10px] text-semantic-text-tertiary">
                            {action.type === 'copy_text'
                              ? copiedActionId === action.id
                                ? 'Copied!'
                                : 'Copy'
                              : 'Open'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`mt-1.5 text-[10px] text-right ${
                      isUser ? 'text-white/70' : 'text-semantic-text-tertiary'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2.5 items-center">
              <div className="w-7 h-7 rounded-xl bg-surface-300 border border-semantic-border-light flex items-center justify-center text-sm shrink-0">
                {currentConfig.avatar}
              </div>
              <div className="bg-surface-200/90 rounded-2xl rounded-tl-none p-3 border border-semantic-border-light/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[11px] text-semantic-text-tertiary ml-1.5">
                  {isHindi ? 'सोच रहे हैं...' : 'Thinking...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-surface-200/80 border-t border-semantic-border-light/80 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              isHindi
                ? `${currentConfig.nameHi} से पूछें (उदा. पंखा खराब है, लेट हुआ)...`
                : `Ask ${currentConfig.nameEn} (e.g. MCB tripping, delayed artisan)...`
            }
            className="flex-1 bg-surface-100 border border-semantic-border-medium rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-semantic-text-tertiary focus:outline-none focus:border-brand-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:hover:bg-brand-500 text-white flex items-center justify-center transition-colors shadow-sm shrink-0"
            aria-label="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

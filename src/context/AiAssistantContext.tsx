import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AssistantPersona, ChatMessage } from '../services/ai/types'
import { ASSISTANT_CONFIGS } from '../services/ai/domainKnowledge'
import { processAiQuery } from '../services/ai/aiEngine'

interface AiAssistantContextType {
  isOpen: boolean
  activePersona: AssistantPersona
  messages: Record<AssistantPersona, ChatMessage[]>
  isTyping: boolean
  openAssistant: (persona?: AssistantPersona, initialQuery?: string) => void
  closeAssistant: () => void
  switchPersona: (persona: AssistantPersona) => void
  sendMessage: (query: string) => Promise<void>
  clearHistory: (persona?: AssistantPersona) => void
}

const AiAssistantContext = createContext<AiAssistantContextType | undefined>(undefined)

const INITIAL_MESSAGES: Record<AssistantPersona, ChatMessage[]> = {
  customer_booking: [
    {
      id: 'init_cb',
      sender: 'assistant',
      persona: 'customer_booking',
      timestamp: new Date(),
      textEn: ASSISTANT_CONFIGS.customer_booking.greetingEn,
      textHi: ASSISTANT_CONFIGS.customer_booking.greetingHi,
    },
  ],
  customer_care: [
    {
      id: 'init_cc',
      sender: 'assistant',
      persona: 'customer_care',
      timestamp: new Date(),
      textEn: ASSISTANT_CONFIGS.customer_care.greetingEn,
      textHi: ASSISTANT_CONFIGS.customer_care.greetingHi,
    },
  ],
  worker_sarathi: [
    {
      id: 'init_ws',
      sender: 'assistant',
      persona: 'worker_sarathi',
      timestamp: new Date(),
      textEn: ASSISTANT_CONFIGS.worker_sarathi.greetingEn,
      textHi: ASSISTANT_CONFIGS.worker_sarathi.greetingHi,
    },
  ],
}

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activePersona, setActivePersona] = useState<AssistantPersona>('customer_booking')
  const [messages, setMessages] = useState<Record<AssistantPersona, ChatMessage[]>>(INITIAL_MESSAGES)
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) return

      const userMsg: ChatMessage = {
        id: 'usr_' + Date.now(),
        sender: 'user',
        persona: activePersona,
        timestamp: new Date(),
        textEn: trimmed,
        textHi: trimmed,
      }

      setMessages(prev => ({
        ...prev,
        [activePersona]: [...prev[activePersona], userMsg],
      }))

      setIsTyping(true)
      try {
        const reply = await processAiQuery({
          query: trimmed,
          persona: activePersona,
          conversationHistory: messages[activePersona],
        })

        setMessages(prev => ({
          ...prev,
          [activePersona]: [...prev[activePersona], reply],
        }))
      } catch (err) {
        console.error('Failed to process AI query:', err)
      } finally {
        setIsTyping(false)
      }
    },
    [activePersona, messages]
  )

  const openAssistant = useCallback(
    (persona?: AssistantPersona, initialQuery?: string) => {
      if (persona) {
        setActivePersona(persona)
      }
      setIsOpen(true)
      if (initialQuery) {
        setTimeout(() => {
          sendMessage(initialQuery)
        }, 150)
      }
    },
    [sendMessage]
  )

  const closeAssistant = useCallback(() => {
    setIsOpen(false)
  }, [])

  const switchPersona = useCallback((persona: AssistantPersona) => {
    setActivePersona(persona)
  }, [])

  const clearHistory = useCallback((persona?: AssistantPersona) => {
    if (persona) {
      setMessages(prev => ({
        ...prev,
        [persona]: INITIAL_MESSAGES[persona],
      }))
    } else {
      setMessages(INITIAL_MESSAGES)
    }
  }, [])

  return (
    <AiAssistantContext.Provider
      value={{
        isOpen,
        activePersona,
        messages,
        isTyping,
        openAssistant,
        closeAssistant,
        switchPersona,
        sendMessage,
        clearHistory,
      }}
    >
      {children}
    </AiAssistantContext.Provider>
  )
}

export function useAiAssistant() {
  const context = useContext(AiAssistantContext)
  if (!context) {
    throw new Error('useAiAssistant must be used within an AiAssistantProvider')
  }
  return context
}

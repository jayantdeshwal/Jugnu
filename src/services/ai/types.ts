export type AssistantPersona = 'customer_booking' | 'customer_care' | 'worker_sarathi'

export interface ChatAction {
  id: string
  labelEn: string
  labelHi: string
  type: 'navigate' | 'external_link' | 'copy_text' | 'quick_reply'
  payload: string
  icon?: string
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  persona: AssistantPersona
  textEn: string
  textHi: string
  timestamp: Date
  actions?: ChatAction[]
}

export interface QuickChip {
  id: string
  labelEn: string
  labelHi: string
  query: string
  icon?: string
}

export interface AssistantConfig {
  id: AssistantPersona
  nameEn: string
  nameHi: string
  roleTitleEn: string
  roleTitleHi: string
  badgeEn: string
  badgeHi: string
  avatar: string
  greetingEn: string
  greetingHi: string
  chips: QuickChip[]
}

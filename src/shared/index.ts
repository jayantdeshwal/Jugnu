export type Language = 'en' | 'hi'
export type UserRole = 'customer' | 'worker' | 'admin'

export interface User {
  id: string
  name: string
  phone: string
  email?: string | null
  role: UserRole
  language: Language
  avatar_url?: string | null
  created_at?: string
}

export const CATEGORIES = [
  { id: 'electrician', name_en: 'Electrician', name_hi: 'इलेक्ट्रीशियन', icon: 'zap' },
  { id: 'plumber', name_en: 'Plumber', name_hi: 'प्लंबर', icon: 'wrench' },
  { id: 'carpenter', name_en: 'Carpenter', name_hi: 'कारपेंटर', icon: 'hammer' },
  { id: 'ac', name_en: 'AC Technician', name_hi: 'AC टेक्नीशियन', icon: 'snowflake' },
  { id: 'painter', name_en: 'Painter', name_hi: 'पेंटर', icon: 'brush' },
] as const

export const MUZAFFARNAGAR_PINCODES = ['251001', '251002'] as const

export function getCategoryName(category: { id?: string; icon?: string; sort_order?: number; name_en: string; name_hi: string }, language: Language) {
  return language === 'hi' ? category.name_hi : category.name_en
}

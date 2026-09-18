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

export interface ServiceItem {
  id: string
  name_en: string
  name_hi: string
  icon: string
  categoryId: string
}

export interface CategoryGroup {
  id: string
  name_en: string
  name_hi: string
  icon: string
  services: ServiceItem[]
}

export const JUGNU_CATEGORIES: CategoryGroup[] = [
  {
    id: 'home_repair',
    name_en: 'Home Repair & Work',
    name_hi: 'घर की मरम्मत और काम',
    icon: 'home',
    services: [
      { id: 'electrician', name_en: 'Electrician', name_hi: 'बिजली मिस्त्री', icon: 'zap', categoryId: 'home_repair' },
      { id: 'plumber', name_en: 'Plumber', name_hi: 'प्लंबर', icon: 'wrench', categoryId: 'home_repair' },
      { id: 'carpenter', name_en: 'Carpenter', name_hi: 'बढ़ई', icon: 'hammer', categoryId: 'home_repair' },
      { id: 'painter', name_en: 'Painter', name_hi: 'पेंटर', icon: 'brush', categoryId: 'home_repair' },
      { id: 'daily_wage_worker', name_en: 'Daily Wage Worker', name_hi: 'दिहाड़ी मजदूर', icon: 'hammer', categoryId: 'home_repair' },
      { id: 'raj_mistri', name_en: 'Raj Mistri', name_hi: 'राज मिस्त्री', icon: 'wrench', categoryId: 'home_repair' },
    ],
  },
  {
    id: 'appliance_repair',
    name_en: 'Home Appliance Repair',
    name_hi: 'घर के उपकरण मरम्मत',
    icon: 'wrench',
    services: [
      { id: 'ac_repair', name_en: 'AC Repair & Service', name_hi: 'AC मरम्मत और सर्विस', icon: 'snowflake', categoryId: 'appliance_repair' },
      { id: 'refrigerator_repair', name_en: 'Refrigerator Repair', name_hi: 'फ्रिज मरम्मत', icon: 'snowflake', categoryId: 'appliance_repair' },
      { id: 'washing_machine_repair', name_en: 'Washing Machine Repair', name_hi: 'वॉशिंग मशीन मरम्मत', icon: 'cog', categoryId: 'appliance_repair' },
      { id: 'ro_repair', name_en: 'RO Repair', name_hi: 'RO मरम्मत', icon: 'droplets', categoryId: 'appliance_repair' },
      { id: 'geyser_repair', name_en: 'Geyser Repair', name_hi: 'गीजर मरम्मत', icon: 'flame', categoryId: 'appliance_repair' },
    ],
  },
  {
    id: 'beauty_personal_care',
    name_en: 'Beauty & Personal Care',
    name_hi: 'ब्यूटी और व्यक्तिगत देखभाल',
    icon: 'sparkles',
    services: [
      { id: 'parlour_service', name_en: 'Parlour Service', name_hi: 'पार्लर सेवा', icon: 'scissors', categoryId: 'beauty_personal_care' },
      { id: 'nail_extension', name_en: 'Nail Extension', name_hi: 'नेल एक्सटेंशन', icon: 'sparkles', categoryId: 'beauty_personal_care' },
      { id: 'mehendi_artist', name_en: 'Mehendi Artist', name_hi: 'मेहंदी आर्टिस्ट', icon: 'palette', categoryId: 'beauty_personal_care' },
    ],
  },
  {
    id: 'home_help_cleaning',
    name_en: 'Home Help & Cleaning',
    name_hi: 'घरेलू मदद और सफाई',
    icon: 'sparkles',
    services: [
      { id: 'part_time_maid', name_en: 'Part-time Home Maid', name_hi: 'पार्ट-टाइम घरेलू काम', icon: 'user', categoryId: 'home_help_cleaning' },
      { id: 'dry_clean_press', name_en: 'Dry Clean & Press', name_hi: 'ड्राई क्लीन और प्रेस', icon: 'shirt', categoryId: 'home_help_cleaning' },
    ],
  },
  {
    id: 'vehicle_emergency',
    name_en: 'Vehicle & Emergency Services',
    name_hi: 'वाहन और आपातकालीन सेवाएँ',
    icon: 'truck',
    services: [
      { id: 'part_time_driver', name_en: 'Part-time Driver', name_hi: 'पार्ट-टाइम ड्राइवर', icon: 'car', categoryId: 'vehicle_emergency' },
      { id: 'car_mechanic', name_en: 'Car Mechanic', name_hi: 'कार मैकेनिक', icon: 'wrench', categoryId: 'vehicle_emergency' },
      { id: 'ambulance', name_en: 'Ambulance', name_hi: 'एम्बुलेंस', icon: 'shield-alert', categoryId: 'vehicle_emergency' },
    ],
  },
]

export const ALL_SERVICES: ServiceItem[] = JUGNU_CATEGORIES.flatMap(cat => cat.services)

// Flat list of canonical services and categories
export const CATEGORIES = [
  ...ALL_SERVICES.map(s => ({ id: s.id, name_en: s.name_en, name_hi: s.name_hi, icon: s.icon })),
  ...JUGNU_CATEGORIES.map(c => ({ id: c.id, name_en: c.name_en, name_hi: c.name_hi, icon: c.icon })),
]

export const MUZAFFARNAGAR_PINCODES = ['251001', '251002'] as const

export function getCategoryName(
  item: { id?: string; icon?: string; sort_order?: number; name_en?: string; name_hi?: string } | null | undefined,
  language: Language
): string {
  if (!item) return ''
  if (language === 'hi' && item.name_hi) return item.name_hi
  return item.name_en || item.name_hi || ''
}

export function getServiceById(id: string): ServiceItem | undefined {
  return ALL_SERVICES.find(s => s.id === id)
}

export function getCategoryById(id: string): CategoryGroup | undefined {
  const byCatId = JUGNU_CATEGORIES.find(c => c.id === id)
  if (byCatId) return byCatId
  const service = getServiceById(id)
  if (service) return JUGNU_CATEGORIES.find(c => c.id === service.categoryId)
  return undefined
}

export function getServicesByCategoryId(categoryId: string): ServiceItem[] {
  const category = JUGNU_CATEGORIES.find(c => c.id === categoryId)
  return category ? category.services : []
}

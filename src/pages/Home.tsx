import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Badge, Avatar, RatingStars } from '@/ui'
import { usePublicCatalog } from '@/hooks/usePublicCatalog'
import { fetchCategoryWorkerStats, fetchApprovedWorkers, CategoryWorkerStat, PublicWorker } from '@/services/workers'
import {
  CATEGORIES,
  ALL_SERVICES,
  JUGNU_CATEGORIES,
  MUZAFFARNAGAR_PINCODES,
  getCategoryName,
  getServicesByCategoryId,
  getServiceById,
  getCategoryById,
} from '@kaamgar/shared'
import {
  Search,
  Truck,
  Zap,
  Wrench,
  Hammer,
  Snowflake,
  Brush,
  Sparkles,
  Scissors,
  Flower2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Star,
  MapPin,
  PhoneCall,
  MessageSquare,
  ArrowRight,
  Check,
  Award,
  TrendingUp,
  Percent,
  Calendar,
  UserCheck,
  ChevronRight,
  Briefcase,
  Users,
  Smartphone,
  X,
  Grid,
  SlidersHorizontal,
  Flame,
  AlertCircle,
  XCircle,
  Bot,
  ArrowLeft,
} from 'lucide-react'
import { motion, AnimatePresence, useScroll } from 'framer-motion'
import { useAiAssistant } from '@/context/AiAssistantContext'
import { useAuth } from '@/context/AuthContext'

const iconMap: Record<string, any> = {
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  snowflake: Snowflake,
  brush: Brush,
  sparkles: Sparkles,
  scissors: Scissors,
  flower: Flower2,
}

// Popular search issue chips for quick selection
const POPULAR_SEARCHES = [
  { labelKey: 'home.popularSwitchboard', category: 'electrician' },
  { labelKey: 'home.popularAc', category: 'ac_repair' },
  { labelKey: 'home.popularPipe', category: 'plumber' },
  { labelKey: 'home.popularMaid', category: 'part_time_maid' },
  { labelKey: 'home.popularParlour', category: 'parlour_service' },
  { labelKey: 'home.popularFurniture', category: 'carpenter' },
  { labelKey: 'home.popularPaint', category: 'painter' },
  { labelKey: 'home.popularCar', category: 'car_mechanic' },
]

// Common query aliases mapping to canonical service IDs in @kaamgar/shared
const SERVICE_ALIASES: Record<string, string[]> = {
  parlour: ['parlour_service'],
  parlor: ['parlour_service'],
  salon: ['parlour_service'],
  beauty: ['parlour_service', 'nail_extension', 'mehendi_artist'],
  makeup: ['parlour_service'],
  facial: ['parlour_service'],
  waxing: ['parlour_service'],
  hair: ['parlour_service'],
  mehendi: ['mehendi_artist'],
  mehndi: ['mehendi_artist'],
  henna: ['mehendi_artist'],
  nail: ['nail_extension'],
  nails: ['nail_extension'],
  ac: ['ac_repair'],
  'ac repair': ['ac_repair'],
  'ac service': ['ac_repair'],
  aircon: ['ac_repair'],
  cool: ['ac_repair', 'refrigerator_repair'],
  fridge: ['refrigerator_repair'],
  refrigerator: ['refrigerator_repair'],
  washing: ['washing_machine_repair'],
  'washing machine': ['washing_machine_repair'],
  laundry: ['dry_clean_press', 'part_time_maid'],
  iron: ['dry_clean_press'],
  press: ['dry_clean_press'],
  maid: ['part_time_maid'],
  cleaning: ['part_time_maid'],
  cook: ['part_time_maid'],
  plumber: ['plumber'],
  pipe: ['plumber'],
  leak: ['plumber'],
  leakage: ['plumber'],
  tap: ['plumber'],
  water: ['plumber', 'ro_repair'],
  ro: ['ro_repair'],
  geyser: ['geyser_repair'],
  heater: ['geyser_repair'],
  electrician: ['electrician'],
  electric: ['electrician'],
  wiring: ['electrician'],
  switch: ['electrician'],
  switchboard: ['electrician'],
  mcb: ['electrician'],
  fan: ['electrician'],
  light: ['electrician'],
  carpenter: ['carpenter'],
  furniture: ['carpenter'],
  wood: ['carpenter'],
  door: ['carpenter'],
  lock: ['carpenter'],
  painter: ['painter'],
  paint: ['painter'],
  painting: ['painter'],
  wall: ['painter', 'raj_mistri'],
  mechanic: ['car_mechanic'],
  car: ['car_mechanic', 'part_time_driver'],
  vehicle: ['car_mechanic', 'part_time_driver'],
  auto: ['car_mechanic'],
  driver: ['part_time_driver'],
  ambulance: ['ambulance'],
  emergency: ['ambulance'],
  mason: ['raj_mistri'],
  mistri: ['raj_mistri', 'daily_wage_worker'],
  mazdoor: ['daily_wage_worker'],
  labour: ['daily_wage_worker'],
  // Hindi aliases
  बिजली: ['electrician'],
  प्लंबर: ['plumber'],
  बढ़ई: ['carpenter'],
  पेंटर: ['painter'],
  पार्लर: ['parlour_service'],
  मेहंदी: ['mehendi_artist'],
  सफाई: ['part_time_maid'],
  कामवाली: ['part_time_maid'],
  ड्राइवर: ['part_time_driver'],
  मैकेनिक: ['car_mechanic'],
  एसी: ['ac_repair'],
  फ्रिज: ['refrigerator_repair'],
  गीजर: ['geyser_repair'],
}

function getMatchingTaxonomyServiceIds(query: string): Set<string> {
  const q = query.trim().toLowerCase()
  const matched = new Set<string>()
  if (!q) return matched

  // 1. Check direct service name & id matches
  for (const s of ALL_SERVICES) {
    const en = s.name_en.toLowerCase()
    const hi = s.name_hi.toLowerCase()
    const idClean = s.id.replace(/_/g, ' ').toLowerCase()
    if (
      s.id.toLowerCase().includes(q) ||
      idClean.includes(q) ||
      q.includes(idClean) ||
      en.includes(q) ||
      q.includes(en) ||
      hi.includes(q)
    ) {
      matched.add(s.id)
    }
  }

  // 2. Check category group name & id matches
  for (const c of JUGNU_CATEGORIES) {
    const en = c.name_en.toLowerCase()
    const hi = c.name_hi.toLowerCase()
    const idClean = c.id.replace(/_/g, ' ').toLowerCase()
    if (
      c.id.toLowerCase().includes(q) ||
      idClean.includes(q) ||
      en.includes(q) ||
      hi.includes(q)
    ) {
      matched.add(c.id)
      for (const s of c.services) {
        matched.add(s.id)
      }
    }
  }

  // 3. Check synonym / alias mappings (ensuring short aliases like 'ac', 'car' respect word boundaries)
  const tokens = q.split(/\s+/)
  for (const [aliasWord, serviceIds] of Object.entries(SERVICE_ALIASES)) {
    const isShort = aliasWord.length <= 3
    const matchedAlias = isShort
      ? tokens.includes(aliasWord) || new RegExp(`(^|[^a-zA-Z0-9\u0900-\u097F])${aliasWord}([^a-zA-Z0-9\u0900-\u097F]|$)`, 'i').test(q)
      : (q.includes(aliasWord) || aliasWord.includes(q))

    if (matchedAlias) {
      for (const sid of serviceIds) {
        matched.add(sid)
      }
    }
  }

  return matched
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const { categories } = usePublicCatalog()
  const navigate = useNavigate()
  const aiAssistant = useAiAssistant()
  const { isAuthenticated } = useAuth()
  const isGuestMode = !isAuthenticated || (typeof window !== 'undefined' && sessionStorage.getItem('kaamgar_guest_mode') === 'true')

  // Top viewport scroll progress
  const { scrollYProgress } = useScroll()

  const handleBackToLogin = () => {
    sessionStorage.removeItem('kaamgar_guest_mode')
    window.dispatchEvent(new Event('storage'))
    navigate('/login')
  }

  // Search & Filter state — strictly decoupled
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedArea, setSelectedArea] = useState('')

  // Real worker stats from database
  const [workerStats, setWorkerStats] = useState<Record<string, CategoryWorkerStat>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  // Live worker list from database
  const [allWorkers, setAllWorkers] = useState<PublicWorker[]>([])
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)

  // Rotating placeholder suggestion
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const placeholders = [
    t('categories.electrician', 'Electrician'),
    t('categories.plumber', 'Plumber'),
    t('categories.ac_repair', 'AC Repair & Service'),
    t('categories.part_time_maid', 'Part-time Home Maid'),
    t('categories.parlour_service', 'Parlour Service'),
    t('categories.carpenter', 'Carpenter'),
    t('categories.painter', 'Painter'),
    t('categories.car_mechanic', 'Car Mechanic'),
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length)
    }, 2800)
    return () => clearInterval(timer)
  }, [placeholders.length])

  // Load worker stats and public workers
  useEffect(() => {
    let isMounted = true
    Promise.all([
      fetchCategoryWorkerStats().catch(() => ({})),
      fetchApprovedWorkers().catch(() => []),
    ])
      .then(([stats, workers]) => {
        if (isMounted) {
          setWorkerStats(stats)
          setAllWorkers(workers)
        }
      })
      .finally(() => {
        if (isMounted) setLoadingStats(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Close filter panel on click outside or Escape key without affecting search bar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
      }
    }

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFilterOpen])

  // Helper to get friendly name for any category or service
  const getCategoryDisplayName = (catId: string) => {
    const service = getServiceById(catId)
    if (service) return getCategoryName(service, i18n.language === 'hi' ? 'hi' : 'en')
    const categoryGroup = getCategoryById(catId)
    if (categoryGroup) return getCategoryName(categoryGroup, i18n.language === 'hi' ? 'hi' : 'en')
    return catId.replace(/_/g, ' ')
  }

  // Composed filter + search matching
  const matchingWorkers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const matchedServiceIds = query ? getMatchingTaxonomyServiceIds(query) : new Set<string>()

    return allWorkers.filter(worker => {
      // 1. Category Filter Check (if selectedCategory is active)
      if (selectedCategory) {
        const childServices = getServicesByCategoryId(selectedCategory)
        const targetIds = new Set<string>([selectedCategory, ...childServices.map(s => s.id)])
        const matchesCat = worker.categories.some(c => targetIds.has(c))
        if (!matchesCat) return false
      }

      // 2. Area Filter Check (if selectedArea is active)
      if (selectedArea) {
        if (!worker.areas.includes(selectedArea)) return false
      }

      // 3. Search Query Check (if searchQuery is active)
      if (query) {
        const matchesName = worker.name.toLowerCase().includes(query)
        const matchesTaxonomy = matchedServiceIds.size > 0 && worker.categories.some(c => matchedServiceIds.has(c))

        if (matchedServiceIds.size > 0) {
          // Specific service query (e.g. "parlour", "electrician", "AC repair", "mehendi", "plumber", "car mechanic"):
          // Must actually provide the canonical service (or match the worker's name directly).
          // Prevents unrelated bio keyword mentions from falsely qualifying a worker for a service they do not provide.
          if (!matchesTaxonomy && !matchesName) {
            return false
          }
        } else {
          // General free-text query (e.g. artisan name, specialty, or general bio search):
          const matchesBio = (worker.bio || '').toLowerCase().includes(query)
          const matchesCategoryDirect = worker.categories.some(c => {
            const cClean = c.replace(/_/g, ' ').toLowerCase()
            return c.toLowerCase().includes(query) || cClean.includes(query) || query.includes(cClean)
          })

          if (!matchesName && !matchesBio && !matchesCategoryDirect) {
            return false
          }
        }
      }

      return true
    })
  }, [allWorkers, selectedCategory, selectedArea, searchQuery])

  const hasActiveSearchOrFilter = Boolean(searchQuery.trim() || selectedCategory || selectedArea)
  const activeFilterCount = (selectedCategory ? 1 : 0) + (selectedArea ? 1 : 0)

  const clearAllSearchAndFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedArea('')
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsFilterOpen(false)
  }

  const handleQuickPick = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setIsFilterOpen(false)
  }

  return (
    <div className="min-h-screen bg-semantic-bg-primary text-semantic-text-primary relative">
      {/* Ultra-Realistic Viewport Scroll Progress Bar */}
      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-brand-500 to-emerald-400 origin-left z-50 shadow-sm shadow-brand-500/50 pointer-events-none"
      />

      {/* Exploration Guest Mode Banner with 1-Tap Back Button */}
      {isGuestMode && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 dark:from-brand-500/15 dark:via-zinc-900 dark:to-brand-500/15 border-b border-amber-500/30 py-2 px-3 sm:px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-brand-300 font-medium truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{t('guestBar.exploringAsGuest', 'You are exploring Jugnu in Guest Mode')}</span>
            </div>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-xs font-bold text-slate-900 dark:text-white transition-all cursor-pointer border border-amber-500/40 shrink-0 shadow-xs active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('common.backToLogin', 'Sign In / Register')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. URBAN COMPANY STYLE STICKY SEARCH BAR (Above Hero & Docks under Navbar) */}
      {/* ========================================================================= */}
      <div
        ref={searchContainerRef}
        className="sticky top-16 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 shadow-sm transition-all"
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 relative">
          {/* Location indicator & delivery speed banner */}
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 min-w-0">
              {isGuestMode && (
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 mr-1 pr-1.5 border-r border-slate-200 dark:border-zinc-700 cursor-pointer shrink-0 transition-colors"
                  title={t('common.backToLogin', 'Back to Login')}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('common.back', 'Back')}</span>
                </button>
              )}
              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                {selectedArea ? `${selectedArea} • ${t('home.city', 'Muzaffarnagar')}` : t('home.areaDefault', 'Muzaffarnagar (251001 & 251002)')}
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-700/50 shrink-0">
                ⚡ 30-45 mins
              </span>
            </div>

            {/* Independent Filter Panel Toggle Button */}
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              aria-expanded={isFilterOpen}
              aria-label="Toggle filter options"
              className={`text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 dark:bg-amber-500/15'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isFilterOpen ? t('common.close', 'Close Filters') : t('common.filter', 'Filters')}</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Input Box — Always visible, focused, and typeable */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative z-20 rounded-2xl border transition-all duration-200 flex items-center px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 hover:border-amber-500/50 focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0 mr-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`${t('common.search', 'Search for')} '${placeholders[placeholderIndex]}' (e.g. parlour, electrician, plumber) ...`}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
              aria-label="Search services or artisans"
            />

            {/* Clear Search Text Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  searchInputRef.current?.focus()
                }}
                className="p-1 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 mr-1.5 cursor-pointer transition-colors"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-xl shadow-md shadow-brand-500/20 whitespace-nowrap active:scale-95 cursor-pointer"
            >
              {t('common.search', 'Search')}
            </Button>
          </form>

          {/* Active Filter Pills Bar (Directly below search input, always accessible) */}
          {hasActiveSearchOrFilter && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/80">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mr-1">
                Active:
              </span>

              {/* Search Query Pill */}
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                  <span>Query: "{searchQuery.trim()}"</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:text-amber-950 dark:hover:text-white cursor-pointer ml-0.5"
                    aria-label="Remove search query"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Selected Category Pill */}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300">
                  <span>Service: {getCategoryDisplayName(selectedCategory)}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className="hover:text-blue-950 dark:hover:text-white cursor-pointer ml-0.5"
                    aria-label="Remove category filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Selected Area Pill */}
              {selectedArea && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                  <span>Area: {selectedArea}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedArea('')}
                    className="hover:text-emerald-950 dark:hover:text-white cursor-pointer ml-0.5"
                    aria-label="Remove area filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Clear All Action */}
              <button
                type="button"
                onClick={clearAllSearchAndFilters}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 ml-auto transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ===================================================================== */}
          {/* INDEPENDENT FILTER PANEL (Docked below search bar, auto-closes on pick) */}
          {/* ===================================================================== */}
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                ref={filterPanelRef}
                initial={{ opacity: 0, y: -6, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="absolute left-3 right-3 sm:left-6 sm:right-6 top-full mt-2 z-30 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl max-h-[65vh] overflow-y-auto space-y-4"
              >
                {/* Header with Title & Close button */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {t('home.filterPanelTitle', 'Filter Services & Local Areas')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Local Area Filter */}
                <div>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('home.stickyAreasTitle', 'Select Local Area')}</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArea('')
                        setIsFilterOpen(false)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        !selectedArea
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:text-white'
                      }`}
                    >
                      All Muzaffarnagar
                    </button>
                    {MUZAFFARNAGAR_PINCODES.map(pincode => (
                      <button
                        key={pincode}
                        type="button"
                        onClick={() => {
                          setSelectedArea(prev => (prev === pincode ? '' : pincode))
                          setIsFilterOpen(false)
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          selectedArea === pincode
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:text-white'
                        }`}
                      >
                        {pincode} - {pincode === '251001' ? t('home.cityNewMandi', 'City / New Mandi') : t('home.canttCivilLines', 'Cantt / Civil Lines')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Popular Search Shortcuts */}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>{t('home.stickyPopularSearches', 'Popular Searches')}</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SEARCHES.map(item => (
                      <button
                        key={item.labelKey}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(item.category)
                          setIsFilterOpen(false)
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                          {t(item.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Service Category Filter */}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('home.stickyCategoriesTitle', 'Select Service Category')}</span>
                    </h4>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">{t('home.tapApplyClose', 'Tap to apply & close')}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* All Services option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('')
                        setIsFilterOpen(false)
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        !selectedCategory
                          ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 shadow-sm'
                          : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate text-slate-900 dark:text-zinc-100">
                          {t('categories.all', 'All Services')}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                          View all
                        </p>
                      </div>
                    </button>

                    {/* Canonical Categories / Services */}
                    {CATEGORIES.map(cat => {
                      const Icon = iconMap[cat.icon as keyof typeof iconMap] || Wrench
                      const isSelected = selectedCategory === cat.id
                      const stat = workerStats[cat.id]
                      const totalCount = stat ? stat.total : 0

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(prev => (prev === cat.id ? '' : cat.id))
                            setIsFilterOpen(false)
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 shadow-sm'
                              : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate text-slate-900 dark:text-zinc-100">
                              {getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                              {totalCount > 0 ? `${totalCount} ${t('home.verified', 'Verified')}` : t('home.sameDay', 'Same-day')}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Bottom Filter Controls */}
                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('')
                      setSelectedArea('')
                      setIsFilterOpen(false)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer font-medium"
                  >
                    {t('common.clearFilters', 'Clear Filters')}
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsFilterOpen(false)}
                    className="text-xs font-bold px-4 cursor-pointer"
                  >
                    {t('common.done', 'Done')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DYNAMIC SEARCH & FILTER RESULTS SECTION (Appears when searching or filtering) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {hasActiveSearchOrFilter && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="py-8 sm:py-10 bg-slate-50/80 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 relative z-10"
          >
            <div className="container-app">
              <div className="max-w-5xl mx-auto">
                {/* Results Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{t('home.verifiedArtisans', 'Verified Artisans')}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        {matchingWorkers.length} {t('home.found', 'Found')}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                      {t('home.resultsSubtitle', 'Direct phone & WhatsApp connection • 0% platform fee • Aadhaar & Police verified')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearAllSearchAndFilters}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      {t('home.clearResults', 'Clear Results')}
                    </button>
                    <Link
                      to={`/search?${new URLSearchParams({
                        ...(searchQuery ? { q: searchQuery } : {}),
                        ...(selectedCategory ? { category: selectedCategory } : {}),
                        ...(selectedArea ? { area: selectedArea } : {}),
                      }).toString()}`}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>{t('home.fullDirectory', 'Full Directory')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Worker Results Grid */}
                {matchingWorkers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {matchingWorkers.map(worker => {
                      const catName = worker.categories && worker.categories.length > 0
                        ? worker.categories.map(c => getCategoryDisplayName(c)).join(' • ')
                        : getCategoryDisplayName('electrician')

                      return (
                        <div
                          key={worker.id}
                          className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-amber-500/50 dark:hover:border-amber-500/40 transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Top row: Avatar, Name, Verification, Availability */}
                            <div className="flex items-start gap-3.5">
                              <Avatar
                                name={worker.name}
                                src={worker.avatar || undefined}
                                size="lg"
                                className="shrink-0 ring-2 ring-amber-500/20"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    {worker.name}
                                  </h3>
                                  <span title={t('home.verifiedArtisan', 'Verified Artisan')}>
                                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                  </span>
                                </div>
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold truncate mt-0.5" title={catName}>
                                  {catName}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                                  <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                                    <Star className="w-3 h-3 fill-amber-500" />
                                    <span>{worker.rating > 0 ? worker.rating.toFixed(1) : t('home.noRatings', 'No ratings yet')}</span>
                                  </span>
                                  <span>•</span>
                                  <span>{worker.reviews} {t('common.reviews', 'reviews')}</span>
                                  <span>•</span>
                                  <span>{worker.experience} {t('home.yearsShort', 'yrs exp')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Bio / Services */}
                            {worker.bio && (
                              <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 mt-3 leading-relaxed">
                                {worker.bio}
                              </p>
                            )}

                            {/* Service Areas */}
                            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">
                                {t('home.areas', 'Areas')}: {worker.areas.join(', ') || t('home.allMuzaffarnagar', 'All Muzaffarnagar')}
                              </span>
                            </div>
                          </div>

                          {/* Footer action */}
                          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>{worker.available ? t('home.availableNow', 'Available Now') : t('home.acceptingCalls', 'Accepting Calls')}</span>
                            </span>
                            <Link
                              to={`/worker/${worker.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs active:scale-95 transition-all"
                            >
                              <span>{t('home.viewAndCall', 'View & Call')}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Empty state when query or filter yields no approved worker */
                  <div className="py-10 px-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center max-w-xl mx-auto shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                      {t('home.noMatchingArtisans', 'No matching verified artisans found')}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto mb-4">
                      {searchQuery
                        ? `We couldn't find an approved artisan matching "${searchQuery}" in Muzaffarnagar right now.`
                        : t('home.noApprovedMatch', 'No approved artisans match the selected category or area filters.')}
                    </p>

                    {/* Quick fallback category suggestions */}
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-2">
                        {t('home.tryCategories', 'Try one of our active categories:')}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {['plumber', 'electrician', 'parlour_service', 'ac_repair', 'carpenter'].map(catId => (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(catId)
                              setSearchQuery('')
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer"
                          >
                            {getCategoryDisplayName(catId)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={clearAllSearchAndFilters}
                        className="text-xs font-bold"
                      >
                        Reset All Filters
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => aiAssistant?.openAssistant?.('customer_booking')}
                        className="text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Bot className="w-3.5 h-3.5" />
              <span>{t('home.askAiAssistant', 'Ask AI Assistant')}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. HERO INTRODUCTION SECTION (Below Sticky Search Bar)                   */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/60 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pt-8 sm:pt-14 pb-8 border-b border-slate-200/80 dark:border-zinc-800/60">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 sm:w-[600px] h-64 bg-amber-500/10 dark:bg-brand-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container-app relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Hyperlocal Trust Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold tracking-wide mb-3.5 shadow-sm backdrop-blur-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t('home.heroBadge')}</span>
            </motion.div>

            {/* Main Headline (Option 3: Attractive & Crystal-Clear) */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.05 }}
              className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-3 sm:mb-4 drop-shadow-xs"
            >
              {t('home.heroTitle')}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.1 }}
              className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed"
            >
              {t('home.heroSubtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. AUTHENTIC SOCIAL PROOF STRIP (Strict Zero Fake Data • Verified Only)   */}
      {/* ========================================================================= */}
      <section className="py-5 sm:py-6 bg-slate-50/80 dark:bg-zinc-950 border-b border-slate-200/80 dark:border-zinc-800/60">
        <div className="container-app">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {t('home.statVerified')}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Aadhaar & Admin Approved
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 hover:border-amber-500/50 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-1">
                  <Percent className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {t('home.statCommission')}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Zero Middleman Markup
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-1">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {t('home.statDirect')}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {t('home.directWhatsapp', 'Direct WhatsApp & Call')}
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 hover:border-amber-500/50 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {allWorkers.length > 0 ? `${allWorkers.length}+ ${t('home.verifiedArtisans', 'Verified Artisans')}` : t('home.statHyperlocal')}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {t('home.dedicatedPincodes', 'Dedicated to 251001 & 251002')}
                </span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. THE REAL PROBLEM SECTION (Stage 3: Interactive Problem vs. Solution)   */}
      {/* ========================================================================= */}
      <section className="py-12 sm:py-16 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container-app relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-semibold tracking-wide mb-3 shadow-sm"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t('home.problemBadge')}</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.05 }}
              className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight"
            >
              {t('home.problemTitle')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.1 }}
              className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-2xl mx-auto leading-relaxed"
            >
              {t('home.problemSubtitle')}
            </motion.p>
          </div>

          {/* Interactive Comparison Columns */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {/* The Old Unorganized Way */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              whileHover={{ y: -6, scale: 1.012 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="rounded-3xl p-5 sm:p-6 bg-rose-50/50 dark:bg-zinc-900/90 border border-rose-200 dark:border-rose-500/30 relative overflow-hidden shadow-xl hover:border-rose-300 dark:hover:border-rose-500/50 hover:shadow-2xl transition-all"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-rose-200 dark:border-rose-500/20">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0" />
                    <span>{t('home.problemOldHeader')}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    {t('home.problemOldSub')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                  Unreliable
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { title: t('home.problem1OldTitle'), desc: t('home.problem1OldDesc') },
                  { title: t('home.problem2OldTitle'), desc: t('home.problem2OldDesc') },
                  { title: t('home.problem3OldTitle'), desc: t('home.problem3OldDesc') },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-950/70 border border-rose-100 dark:border-rose-500/20 flex items-start gap-3 transition-colors hover:bg-white dark:hover:bg-zinc-950/90 shadow-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* The Kaamgar Standard */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              whileHover={{ y: -6, scale: 1.012 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="rounded-3xl p-5 sm:p-6 bg-emerald-50/50 dark:bg-zinc-900/90 border border-emerald-200 dark:border-emerald-500/30 relative overflow-hidden shadow-xl hover:border-emerald-300 dark:hover:border-emerald-500/60 hover:shadow-2xl transition-all"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-200 dark:border-emerald-500/20">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{t('home.problemNewHeader')}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    {t('home.problemNewSub')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Direct & Trusted
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { title: t('home.problem1NewTitle'), desc: t('home.problem1NewDesc') },
                  { title: t('home.problem2NewTitle'), desc: t('home.problem2NewDesc') },
                  { title: t('home.problem3NewTitle'), desc: t('home.problem3NewDesc') },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-950/70 border border-emerald-100 dark:border-emerald-500/20 flex items-start gap-3 transition-colors hover:bg-white dark:hover:bg-zinc-950/90 shadow-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SOLUTION & POPULAR TRADE SERVICES (Stage 4: High Converting Services)  */}
      {/* ========================================================================= */}
      <section className="py-10 sm:py-14 bg-slate-50/60 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800">
        <div className="container-app relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-5 px-1">
              <div>
                <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('home.popularCategories', 'Popular Services')}</span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                    {t('home.sameDay', 'Same-Day')}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
                  {t('home.servicesSubtitle', 'Book verified local technicians with 0% commission')}
                </p>
              </div>

              <Link
                to="/search"
                className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <span>{t('common.viewAll', 'View All')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Grid of 6 Clean Cards with Motion Micro-Interactions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Card 1: InstaHelp (30-min Emergency Kaamgar) */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                onClick={() => navigate('/search?filter=quick')}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {t('home.instaHelp', 'InstaHelp (30 Mins)')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/25 px-2 py-0.5 rounded-full">
                  ⚡ {t('home.fastestArrival', 'Fastest Arrival')}
                </span>
              </motion.div>

              {/* Card 2: Parlour Service & Care */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                onClick={() => handleQuickPick('parlour_service')}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-pink-500/60 dark:hover:border-pink-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center shadow-sm"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/25 dark:border-pink-500/30 flex items-center justify-center text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform">
                  <Flower2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                  {t('categories.parlour_service', 'Parlour Service')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-500/10 border border-pink-200/60 dark:border-pink-500/25 px-2 py-0.5 rounded-full">
                  {t('home.personalCare', 'Personal Care')}
                </span>
              </motion.div>

              {/* Card 3: Carpenter & Woodwork */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                onClick={() => handleQuickPick('carpenter')}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center shadow-sm"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Scissors className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {t('categories.carpenter', 'Carpenter & Woodwork')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/25 px-2 py-0.5 rounded-full">
                  {t('home.furnitureFix', 'Furniture Fix')}
                </span>
              </motion.div>

              {/* Card 4: Part-time Home Maid */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                onClick={() => handleQuickPick('part_time_maid')}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center shadow-sm"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {t('categories.part_time_maid', 'Part-time Home Maid')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/25 px-2 py-0.5 rounded-full">
                  {t('home.homeHelp', 'Home Help')}
                </span>
              </motion.div>

              {/* Card 5: AC & Appliance Repair */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                onClick={() => handleQuickPick('ac_repair')}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-cyan-500/60 dark:hover:border-cyan-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center shadow-sm"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/25 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                  <Snowflake className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {t('categories.ac_repair', 'AC Repair & Service')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200/60 dark:border-cyan-500/25 px-2 py-0.5 rounded-full">
                  ⚡ {t('home.minutes', '44 mins')}
                </span>
              </motion.div>

              {/* Card 6: All Services (Grid Launcher) */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                onClick={() => {
                  setIsFilterOpen(true)
                  searchContainerRef.current?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center shadow-sm"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Grid className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {t('home.allServicesGrid', 'All Services')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/25 px-2 py-0.5 rounded-full">
                  {t('home.moreServices', 'Electrician, Plumber +')}
                </span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FEATURES / HOW IT WORKS (Stage 5: Simple 4-Step Process)               */}
      {/* ========================================================================= */}
      <section className="section bg-white dark:bg-zinc-950 py-12 sm:py-16 border-b border-slate-200 dark:border-zinc-800">
        <div className="container-app">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('home.howTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
              {t('home.howSubtitle')}
            </p>
          </div>

          {/* Timeline Grid with Connected Glowing Rail */}
          <div className="relative">
            {/* Connected Glowing Timeline Bar behind steps on desktop */}
            <div className="hidden md:block absolute top-7 left-14 right-14 h-1 bg-slate-200 dark:bg-zinc-800 rounded-full z-0 pointer-events-none overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                whileInView={{ width: '100%' }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full shadow-lg shadow-amber-500/30 dark:shadow-brand-500/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
              {[
                {
                  step: '01',
                  title: t('home.howStep1Title'),
                  desc: t('home.howStep1Desc'),
                  badge: t('home.howStep1Badge'),
                },
                {
                  step: '02',
                  title: t('home.howStep2Title'),
                  desc: t('home.howStep2Desc'),
                  badge: t('home.howStep2Badge'),
                },
                {
                  step: '03',
                  title: t('home.howStep3Title'),
                  desc: t('home.howStep3Desc'),
                  badge: t('home.howStep3Badge'),
                },
                {
                  step: '04',
                  title: t('home.howStep4Title'),
                  desc: t('home.howStep4Desc'),
                  badge: t('home.howStep4Badge'),
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 24, delay: idx * 0.1 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="relative p-5 rounded-2xl bg-slate-50/70 dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/60 dark:hover:border-amber-500/50 transition-all shadow-sm hover:shadow-md group"
                >
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-amber-600 dark:text-amber-400 font-mono font-black text-base shadow-xs group-hover:bg-amber-500 group-hover:text-white transition-all">
                      {item.step}
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-500/20">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* AI Assistant Quick Help Launcher Banner */}
          {aiAssistant && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="mt-8 max-w-2xl mx-auto p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-amber-500/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 border border-amber-500/25 dark:border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {t('home.aiUnsure', 'Not sure what repair you need?')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                    {t('home.aiDescription', 'Our AI Assistant diagnoses the issue and matches the right artisan in 10 seconds.')}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => aiAssistant.openAssistant('customer_booking')}
                className="text-xs font-bold px-4 py-1.5 shrink-0 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <span>{t('home.askAi', 'Ask AI →')}</span>
              </Button>
            </motion.div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. VERIFIED BOOKING REVIEW GUARANTEE (Stage 6: Zero Fake Reviews Policy)  */}
      {/* ========================================================================= */}
      <section className="py-12 sm:py-16 bg-slate-50/60 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 relative overflow-hidden">
        <div className="container-app relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-semibold tracking-wide mb-3 shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('home.reviewGuaranteeBadge')}</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.05 }}
              className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
            >
              {t('home.reviewGuaranteeTitle')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.1 }}
              className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-2xl mx-auto leading-relaxed"
            >
              {t('home.reviewGuaranteeSubtitle')}
            </motion.p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-md flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">
                {t('home.reviewPillar1Title')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t('home.reviewPillar1Desc')}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/40 dark:hover:border-amber-500/50 transition-all shadow-sm hover:shadow-md flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">
                {t('home.reviewPillar2Title')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t('home.reviewPillar2Desc')}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 hover:border-blue-500/40 dark:hover:border-blue-500/50 transition-all shadow-sm hover:shadow-md flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/25 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">
                {t('home.reviewPillar3Title')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t('home.reviewPillar3Desc')}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. DUAL AUDIENCE CONVERSION BANNERS (Stage 7: Citizen & Worker CTAs)      */}
      {/* ========================================================================= */}
      <section className="section bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 py-14">
        <div className="container-app">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: For Customers */}
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 border border-amber-200/80 dark:border-zinc-800 relative overflow-hidden flex flex-col justify-between shadow-md dark:shadow-lg"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 dark:bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <Badge variant="brand" size="sm" className="mb-3">
                  {t('homeCta.badgeVerified')}
                </Badge>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                  {t('homeCta.customerCardTitle')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-5">
                  {t('homeCta.customerCardSubtitle')}
                </p>
              </div>

              <div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/search')}
                  className="w-full sm:w-auto font-semibold px-6 shadow-md shadow-amber-500/20 text-xs sm:text-sm active:scale-95 cursor-pointer"
                >
                  <Search className="w-4 h-4 mr-2" />
                  <span>{t('homeCta.customerCardBtn')}</span>
                </Button>
              </div>
            </motion.div>

            {/* Card 2: For Workers */}
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-200/80 dark:border-emerald-500/30 relative overflow-hidden flex flex-col justify-between shadow-md dark:shadow-lg"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <Badge variant="success" size="sm" className="mb-3">
                  {t('homeCta.workerCardBadge', '0% Commission for Starting 3 Months')}
                </Badge>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                  {t('homeCta.workerCardTitle')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-5">
                  {t('homeCta.workerCardSubtitle')}
                </p>
              </div>

              <div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/register/worker')}
                  className="w-full sm:w-auto font-semibold px-6 border-emerald-600 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-xs sm:text-sm active:scale-95 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  <span>{t('homeCta.workerCardBtn')}</span>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}

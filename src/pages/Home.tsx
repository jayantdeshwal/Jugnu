import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Badge } from '@/ui'
import { usePublicCatalog } from '@/hooks/usePublicCatalog'
import { fetchCategoryWorkerStats, fetchApprovedWorkers, CategoryWorkerStat, PublicWorker } from '@/services/workers'
import { CATEGORIES, MUZAFFARNAGAR_PINCODES, getCategoryName } from '@kaamgar/shared'
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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  { label: 'Switchboard / MCB Repair', category: 'electrician' },
  { label: 'AC Filter & Gas Service', category: 'ac' },
  { label: 'Water Pipe Leakage', category: 'plumber' },
  { label: 'Deep Home Cleaning', category: 'cleaning' },
  { label: 'Men\'s Haircut & Beard', category: 'men_salon' },
  { label: 'Women\'s Facial & Spa', category: 'women_spa' },
  { label: 'Door Lock / Furniture Fix', category: 'carpenter' },
  { label: 'Wall Paint & Dampness', category: 'painter' },
]

export default function Home() {
  const { t, i18n } = useTranslation()
  const { categories } = usePublicCatalog()
  const navigate = useNavigate()

  // Search & Filter state
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Real worker stats from database
  const [workerStats, setWorkerStats] = useState<Record<string, CategoryWorkerStat>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  // Live worker list for instant search suggestions
  const [allWorkers, setAllWorkers] = useState<PublicWorker[]>([])
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Rotating placeholder suggestion
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const placeholders = [
    t('categories.electrician', 'Electrician'),
    t('categories.plumber', 'Plumber'),
    t('categories.ac', 'AC Technician'),
    t('categories.cleaning', 'Cleaning & Pest Control'),
    t('categories.men_salon', 'Men\'s Salon & Grooming'),
    t('categories.women_spa', 'Women\'s Salon & Spa'),
    t('categories.carpenter', 'Carpenter'),
    t('categories.painter', 'Painter'),
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

  // Close search overlay on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
      }
    }

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSearchOpen])

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSearchOpen(false)
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedArea) params.set('area', selectedArea)
    const queryString = params.toString()
    navigate(queryString ? `/search?${queryString}` : '/search')
  }

  const handleQuickPick = (categoryId: string) => {
    setIsSearchOpen(false)
    navigate(`/search?category=${categoryId}`)
  }

  const handleAreaSelect = (pincode: string) => {
    setSelectedArea(prev => (prev === pincode ? '' : pincode))
  }

  // Filter workers based on query in search drawer
  const filteredSuggestions = searchQuery.trim()
    ? allWorkers.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 4)
    : []

  return (
    <div className="min-h-screen bg-semantic-bg-primary text-semantic-text-primary">
      {/* ========================================================================= */}
      {/* 1. URBAN COMPANY STYLE STICKY SEARCH BAR (Anchored directly under header)  */}
      {/* ========================================================================= */}
      <div
        ref={searchContainerRef}
        className="sticky top-16 z-30 bg-surface-950/95 backdrop-blur-md border-b border-semantic-border-light shadow-md transition-all"
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
          {/* Location indicator & delivery speed banner (like UC1) */}
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <div className="flex items-center gap-1.5 text-xs text-semantic-text-secondary">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-semantic-text-primary truncate">
                {selectedArea ? `${selectedArea} • Muzaffarnagar` : 'Muzaffarnagar (251001 & 251002)'}
              </span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                ⚡ 30-45 mins
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSearchOpen(prev => !prev)}
              className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{isSearchOpen ? t('common.close', 'Close') : t('common.filter', 'Options')}</span>
            </button>
          </div>

          {/* Search Input Box */}
          <form
            onSubmit={handleSearchSubmit}
            className={`
              relative rounded-2xl border transition-all duration-200 flex items-center px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm
              ${isSearchOpen
                ? 'bg-surface-900 border-brand-500/80 ring-2 ring-brand-500/20'
                : 'bg-surface-850 hover:bg-surface-800 border-semantic-border-medium hover:border-brand-500/50'
              }
            `}
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400 shrink-0 mr-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onClick={() => setIsSearchOpen(true)}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`${t('common.search', 'Search for')} '${placeholders[placeholderIndex]}' ...`}
              className="w-full bg-transparent text-xs sm:text-sm text-semantic-text-primary placeholder:text-semantic-text-tertiary focus:outline-none"
              aria-label="Search services or artisans"
            />

            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-semantic-text-tertiary hover:text-semantic-text-primary mr-1"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Active filters indicator badge */}
            {(selectedCategory || selectedArea) && (
              <span className="mr-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40 hidden sm:inline-block">
                Active Filter
              </span>
            )}

            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-xl shadow-md shadow-brand-500/20 whitespace-nowrap active:scale-95"
            >
              {t('common.search', 'Search')}
            </Button>
          </form>

          {/* ===================================================================== */}
          {/* EXPANDING SEARCH OVERLAY / CATEGORIES DRAWER (when clicked)            */}
          {/* ===================================================================== */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.18 }}
                className="mt-2.5 p-4 rounded-2xl bg-surface-900 border border-semantic-border-medium shadow-2xl max-h-[75vh] overflow-y-auto space-y-4 animate-in"
              >
                {/* 1. All Service Categories Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-semantic-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-brand-400" />
                      <span>{t('home.stickyCategoriesTitle', 'All Service Categories')}</span>
                    </h4>
                    <span className="text-[11px] text-brand-400 font-medium">1-Click Direct Access</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categories.map(cat => {
                      const Icon = iconMap[cat.icon as keyof typeof iconMap] || Wrench
                      const isSelected = selectedCategory === cat.id
                      const stat = workerStats[cat.id]
                      const totalCount = stat ? stat.total : 0

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleQuickPick(cat.id)}
                          className={`
                            p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all
                            ${isSelected
                              ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                              : 'bg-surface-800/80 hover:bg-surface-750 border-semantic-border-light text-semantic-text-primary hover:border-brand-500/40'
                            }
                          `}
                        >
                          <div className="w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/25 flex items-center justify-center text-brand-400 shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">
                              {getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}
                            </p>
                            <p className="text-[10px] text-semantic-text-tertiary truncate">
                              {totalCount > 0 ? `${totalCount} Verified` : 'Same-day'}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Pincode / Area Filter Chips */}
                <div className="pt-2 border-t border-semantic-border-light/60">
                  <h4 className="text-xs font-bold text-semantic-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('home.stickyAreasTitle', 'Select Local Area')}</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedArea('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        !selectedArea
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                          : 'bg-surface-800 border-semantic-border-light text-semantic-text-secondary hover:text-white'
                      }`}
                    >
                      All Muzaffarnagar
                    </button>
                    {MUZAFFARNAGAR_PINCODES.map(pincode => (
                      <button
                        key={pincode}
                        type="button"
                        onClick={() => handleAreaSelect(pincode)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          selectedArea === pincode
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-surface-800 border-semantic-border-light text-semantic-text-secondary hover:text-white'
                        }`}
                      >
                        {pincode} - {pincode === '251001' ? 'City / New Mandi' : 'Cantt / Civil Lines'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Popular Common Searches */}
                <div className="pt-2 border-t border-semantic-border-light/60">
                  <h4 className="text-xs font-bold text-semantic-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('home.stickyPopularSearches', 'Popular Searches')}</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SEARCHES.map(item => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(item.category)
                          handleQuickPick(item.category)
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-surface-800/80 hover:bg-surface-700 border border-semantic-border-light text-semantic-text-secondary hover:text-white transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Live Worker Search Results (if typing) */}
                {filteredSuggestions.length > 0 && (
                  <div className="pt-2 border-t border-semantic-border-light/60">
                    <h4 className="text-xs font-bold text-semantic-text-secondary uppercase tracking-wider mb-2">
                      Matching Verified Artisans
                    </h4>
                    <div className="space-y-1.5">
                      {filteredSuggestions.map(worker => (
                        <div
                          key={worker.id}
                          onClick={() => {
                            setIsSearchOpen(false)
                            navigate(`/search?q=${encodeURIComponent(worker.name)}`)
                          }}
                          className="flex items-center justify-between p-2 rounded-xl bg-surface-800 hover:bg-surface-750 border border-semantic-border-light cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 font-bold flex items-center justify-center text-xs">
                              {worker.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{worker.name}</p>
                              <p className="text-[10px] text-semantic-text-tertiary capitalize">
                                {worker.categories.join(', ')} • {worker.experience} yrs exp
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{worker.rating > 0 ? worker.rating.toFixed(1) : '5.0'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-semantic-border-light flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory('')
                      setSelectedArea('')
                      setSearchQuery('')
                    }}
                    className="text-xs text-semantic-text-tertiary hover:text-white"
                  >
                    Clear All Filters
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSearchSubmit()}
                    className="text-xs font-bold px-5"
                  >
                    Apply & View Results →
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION & URBAN COMPANY HOMEPAGE GRID (Inspired by uc1.jpeg)       */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-surface-950 via-surface-900 to-surface-950 pt-8 pb-12 sm:pb-16 border-b border-semantic-border-light">
        <div className="container-app relative z-10">
          <div className="max-w-4xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>{t('home.heroBadge')}</span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight mb-2">
              {t('home.heroTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-semantic-text-secondary max-w-2xl mx-auto leading-relaxed">
              {t('home.heroSubtitle')}
            </p>
          </div>

          {/* ===================================================================== */}
          {/* URBAN COMPANY 3-COLUMN SERVICE CARDS (Exact match to uc1.jpeg layout) */}
          {/* ===================================================================== */}
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4 px-1">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <span>{t('home.popularCategories', 'Popular Services')}</span>
                  <span className="text-[10px] bg-brand-500/20 text-brand-300 font-bold px-2 py-0.5 rounded-full border border-brand-500/30">
                    Same-Day
                  </span>
                </h2>
                <p className="text-xs text-semantic-text-secondary mt-0.5">
                  Book verified local technicians with 0% commission
                </p>
              </div>

              <Link
                to="/search"
                className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
              >
                <span>{t('common.viewAll', 'View All')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Grid of 6 to 8 Clean Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Card 1: InstaHelp (30-min Emergency Kaamgar) */}
              <div
                onClick={() => navigate('/search?filter=quick')}
                className="group p-4 sm:p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-brand-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-brand-400 transition-colors">
                  {t('home.instaHelp', 'InstaHelp (30 Mins)')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  ⚡ Fastest Arrival
                </span>
              </div>

              {/* Card 2: Women's Salon & Spa */}
              <div
                onClick={() => handleQuickPick('women_spa')}
                className="group p-4 sm:p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-pink-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                  <Flower2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-pink-400 transition-colors">
                  {t('categories.women_spa', 'Women\'s Salon & Spa')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded-full">
                  Home Service
                </span>
              </div>

              {/* Card 3: Men's Salon & Massage */}
              <div
                onClick={() => handleQuickPick('men_salon')}
                className="group p-4 sm:p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-blue-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Scissors className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-blue-400 transition-colors">
                  {t('categories.men_salon', 'Men\'s Salon & Grooming')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Hair & Grooming
                </span>
              </div>

              {/* Card 4: Cleaning & Pest Control */}
              <div
                onClick={() => handleQuickPick('cleaning')}
                className="group p-4 sm:p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-emerald-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-emerald-400 transition-colors">
                  {t('categories.cleaning', 'Cleaning & Pest Control')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Deep Clean
                </span>
              </div>

              {/* Card 5: AC & Appliance Repair */}
              <div
                onClick={() => handleQuickPick('ac')}
                className="group p-4 sm:p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-cyan-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Snowflake className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-cyan-400 transition-colors">
                  {t('categories.ac', 'AC & Appliance Repair')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                  ⚡ 44 mins
                </span>
              </div>

              {/* Card 6: All Services (Grid Launcher) */}
              <div
                onClick={() => setIsSearchOpen(true)}
                className="group p-4 sm:p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-brand-500/60 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 mb-2.5 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform">
                  <Grid className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-brand-400 transition-colors">
                  {t('home.allServicesGrid', 'All Services')}
                </h3>
                <span className="mt-1 text-[10px] font-semibold text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full">
                  Electrician, Plumber +
                </span>
              </div>
            </div>
          </div>

          {/* Trust Metric Strip */}
          <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-semantic-border-light/40">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 text-center">
              <div className="p-2.5 sm:p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold text-semantic-text-primary leading-tight">
                  {t('home.statVerified')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2">
                <Percent className="w-4 h-4 text-brand-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold text-semantic-text-primary leading-tight">
                  {t('home.statCommission')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2">
                <PhoneCall className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold text-semantic-text-primary leading-tight">
                  {t('home.statDirect')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold text-semantic-text-primary leading-tight">
                  {t('home.statHyperlocal')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. ALL TRADES DIRECTORY & METRICS                                         */}
      {/* ========================================================================= */}
      <section className="section bg-semantic-bg-primary py-12">
        <div className="container-app">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('home.nativeServices', 'Verified Muzaffarnagar Services')}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-semantic-text-primary">
                {t('home.popularCategories')}
              </h2>
              <p className="text-xs sm:text-sm text-semantic-text-secondary mt-1 max-w-xl">
                {t('home.servicesSubtitle')}
              </p>
            </div>

            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors shrink-0"
            >
              <span>{t('home.viewAllServices')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {categories.map((cat, index) => {
              const Icon = iconMap[cat.icon as keyof typeof iconMap] || Truck
              const stat = workerStats[cat.id]
              const totalWorkers = stat ? stat.total : 0

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                >
                  <Link
                    to={`/search?category=${cat.id}`}
                    className="group block p-4 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="w-10 h-10 mb-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:bg-brand-500 group-hover:text-surface-950 transition-all duration-300 group-hover:scale-105">
                      <Icon className="w-5 h-5 transition-colors" />
                    </div>

                    <h3 className="font-semibold text-xs sm:text-sm text-semantic-text-primary group-hover:text-brand-400 transition-colors mb-1">
                      {getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}
                    </h3>

                    <div className="mb-3">
                      {loadingStats ? (
                        <span className="text-[11px] text-semantic-text-tertiary animate-pulse">
                          {t('common.loading', 'Loading...')}
                        </span>
                      ) : totalWorkers > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {totalWorkers === 1
                            ? t('home.workerCountAvailable', { count: totalWorkers })
                            : t('home.workerCountAvailablePlural', { count: totalWorkers })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-300/90 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                          Available Today
                        </span>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-semantic-border-light flex items-center justify-between text-xs text-semantic-text-tertiary group-hover:text-brand-400 transition-colors">
                      <span className="font-medium text-[11px]">Book Directly</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. WHY CHOOSE KAAMGAR: TRUST & QUALITY ASSURANCE PILLARS                 */}
      {/* ========================================================================= */}
      <section className="section bg-surface-900/60 border-y border-semantic-border-light py-12">
        <div className="container-app">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Trust & Quality Standard</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-semantic-text-primary">
              {t('home.whyTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-semantic-text-secondary mt-1">
              {t('home.whySubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <Card className="p-5 bg-surface-100 border border-semantic-border-light hover:border-emerald-500/40 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-semantic-text-primary mb-1.5">
                {t('home.whyPillar1Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar1Desc')}
              </p>
            </Card>

            <Card className="p-5 bg-surface-100 border border-semantic-border-light hover:border-brand-500/40 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-3">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-semantic-text-primary mb-1.5">
                {t('home.whyPillar2Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar2Desc')}
              </p>
            </Card>

            <Card className="p-5 bg-surface-100 border border-semantic-border-light hover:border-amber-500/40 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Percent className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-semantic-text-primary mb-1.5">
                {t('home.whyPillar3Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar3Desc')}
              </p>
            </Card>

            <Card className="p-5 bg-surface-100 border border-semantic-border-light hover:border-blue-500/40 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-semantic-text-primary mb-1.5">
                {t('home.whyPillar4Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar4Desc')}
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. HOW IT WORKS                                                           */}
      {/* ========================================================================= */}
      <section className="section bg-semantic-bg-primary py-12">
        <div className="container-app">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-semantic-text-primary">
              {t('home.howTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-semantic-text-secondary mt-1">
              {t('home.howSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {[
              {
                step: '01',
                title: t('home.howStep1Title'),
                desc: t('home.howStep1Desc'),
                badge: 'Pincode Filter',
              },
              {
                step: '02',
                title: t('home.howStep2Title'),
                desc: t('home.howStep2Desc'),
                badge: 'Verified Badges',
              },
              {
                step: '03',
                title: t('home.howStep3Title'),
                desc: t('home.howStep3Desc'),
                badge: 'Direct WhatsApp',
              },
              {
                step: '04',
                title: t('home.howStep4Title'),
                desc: t('home.howStep4Desc'),
                badge: 'Local Review',
              },
            ].map(item => (
              <div
                key={item.step}
                className="relative p-5 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-brand-500/30 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-black text-brand-500/30 font-mono">
                    {item.step}
                  </span>
                  <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                    {item.badge}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-semantic-text-primary mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-semantic-text-secondary leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. DUAL AUDIENCE CONVERSION BANNERS (CUSTOMER & WORKER)                  */}
      {/* ========================================================================= */}
      <section className="section bg-surface-950/80 border-t border-semantic-border-light py-14">
        <div className="container-app">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: For Customers */}
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-850 border border-semantic-border-light relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <Badge variant="brand" size="sm" className="mb-3">
                  {t('homeCta.badgeVerified')}
                </Badge>
                <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                  {t('homeCta.customerCardTitle')}
                </h3>
                <p className="text-xs text-semantic-text-secondary leading-relaxed mb-5">
                  {t('homeCta.customerCardSubtitle')}
                </p>
              </div>

              <div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/search')}
                  className="w-full sm:w-auto font-semibold px-6 shadow-lg shadow-brand-500/20 text-xs sm:text-sm"
                >
                  <Search className="w-4 h-4 mr-2" />
                  <span>{t('homeCta.customerCardBtn')}</span>
                </Button>
              </div>
            </div>

            {/* Card 2: For Workers */}
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-850 border border-emerald-500/30 relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <Badge variant="success" size="sm" className="mb-3">
                  {t('homeCta.workerCardBadge', '0% Commission for Starting 3 Months')}
                </Badge>
                <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                  {t('homeCta.workerCardTitle')}
                </h3>
                <p className="text-xs text-semantic-text-secondary leading-relaxed mb-5">
                  {t('homeCta.workerCardSubtitle')}
                </p>
              </div>

              <div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/register/worker')}
                  className="w-full sm:w-auto font-semibold px-6 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-xs sm:text-sm"
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  <span>{t('homeCta.workerCardBtn')}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
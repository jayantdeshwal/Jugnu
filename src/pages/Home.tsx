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
  AlertCircle,
  XCircle,
  Bot,
  ArrowLeft,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const aiAssistant = useAiAssistant()
  const { isAuthenticated } = useAuth()
  const isGuestMode = !isAuthenticated || (typeof window !== 'undefined' && sessionStorage.getItem('kaamgar_guest_mode') === 'true')

  const handleBackToLogin = () => {
    sessionStorage.removeItem('kaamgar_guest_mode')
    window.dispatchEvent(new Event('storage'))
    navigate('/login')
  }

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
      {/* Exploration Guest Mode Banner with 1-Tap Back Button */}
      {isGuestMode && (
        <div className="bg-gradient-to-r from-brand-500/15 via-surface-900 to-brand-500/15 border-b border-brand-500/30 py-2.5 px-3 sm:px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-brand-300 font-medium truncate">
              <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">{t('guestBar.exploringAsGuest', 'You are exploring Muzaffarnagar Kaamgar in Guest Mode')}</span>
            </div>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-750 text-xs font-bold text-white transition-all cursor-pointer border border-brand-500/40 shrink-0 shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
              <span>{t('common.backToLogin', 'Back to Login')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. URBAN COMPANY STYLE STICKY SEARCH BAR (Above Hero & Docks under Navbar) */}
      {/* ========================================================================= */}
      <div
        ref={searchContainerRef}
        className="sticky top-16 z-30 bg-surface-950/95 backdrop-blur-md border-b border-semantic-border-light shadow-md transition-all"
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 relative">
          {/* Location indicator & delivery speed banner */}
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <div className="flex items-center gap-1.5 text-xs text-semantic-text-secondary min-w-0">
              {isGuestMode && (
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 mr-1 pr-1.5 border-r border-semantic-border-medium cursor-pointer shrink-0 transition-colors"
                  title={t('common.backToLogin', 'Back to Login')}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('common.back', 'Back')}</span>
                </button>
              )}
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-semantic-text-primary truncate">
                {selectedArea ? `${selectedArea} • Muzaffarnagar` : 'Muzaffarnagar (251001 & 251002)'}
              </span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">
                ⚡ 30-45 mins
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSearchOpen(prev => !prev)}
              className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
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
                className="p-1 text-semantic-text-tertiary hover:text-semantic-text-primary mr-1 cursor-pointer"
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
              className="px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-xl shadow-md shadow-brand-500/20 whitespace-nowrap active:scale-95 cursor-pointer"
            >
              {t('common.search', 'Search')}
            </Button>
          </form>

          {/* ===================================================================== */}
          {/* EXPANDING SEARCH OVERLAY / CATEGORIES DRAWER (Floating Absolute Dropdown) */}
          {/* ===================================================================== */}
          <AnimatePresence>
            {isSearchOpen && (
              <>
                {/* Backdrop Click Dismiss */}
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
                  onClick={() => setIsSearchOpen(false)}
                />

                {/* Floating Absolute Dropdown Drawer */}
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-3 right-3 sm:left-6 sm:right-6 top-full mt-2 z-50 p-4 sm:p-5 rounded-2xl bg-surface-900/95 backdrop-blur-xl border border-semantic-border-medium shadow-2xl max-h-[70vh] overflow-y-auto space-y-4"
                >
                  {/* Top Bar with Back Button & Cross (Cut) Button */}
                  <div className="flex items-center justify-between pb-3 border-b border-semantic-border-light">
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-750 text-xs font-semibold text-semantic-text-secondary hover:text-white transition-colors cursor-pointer border border-semantic-border-light/60 active:scale-95"
                      aria-label="Back to Homepage"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
                      <span>{t('common.backToHome', 'Back to Home')}</span>
                    </button>

                    <span className="text-xs font-bold text-white uppercase tracking-wider hidden sm:inline-block">
                      {t('home.exploreServices', 'Explore Services & Areas')}
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="w-8 h-8 rounded-xl bg-surface-800 hover:bg-rose-500/20 text-semantic-text-tertiary hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer border border-semantic-border-light/60 active:scale-95"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. SELECT LOCAL AREA (On Top as requested) */}
                  <div>
                    <h4 className="text-xs font-bold text-semantic-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('home.stickyAreasTitle', 'Select Local Area')}</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedArea('')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
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

                  {/* 2. POPULAR SEARCHES (Second as requested) */}
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
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-surface-800/80 hover:bg-surface-750 border border-semantic-border-light text-semantic-text-secondary hover:text-white transition-colors cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. ALL SERVICE CATEGORIES (Third as requested, with 1-Click Direct Access) */}
                  <div className="pt-2 border-t border-semantic-border-light/60">
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
                              p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer
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
                      className="text-xs text-semantic-text-tertiary hover:text-white cursor-pointer"
                    >
                      Clear All Filters
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSearchOpen(false)}
                        className="text-xs font-medium px-3 border-semantic-border-light text-semantic-text-secondary hover:text-white cursor-pointer"
                      >
                        {t('common.close', 'Close')}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSearchSubmit()}
                        className="text-xs font-bold px-5 cursor-pointer"
                      >
                        Apply & View Results →
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HERO INTRODUCTION SECTION (Below Sticky Search Bar)                   */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-surface-950 via-surface-900 to-surface-950 pt-8 sm:pt-14 pb-8 border-b border-semantic-border-light/40">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 sm:w-[600px] h-64 bg-brand-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container-app relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Hyperlocal Trust Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold tracking-wide mb-3.5 shadow-sm backdrop-blur-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span>{t('home.heroBadge')}</span>
            </motion.div>

            {/* Main Headline (Option 3: Attractive & Crystal-Clear) */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.05 }}
              className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight mb-3 sm:mb-4 drop-shadow-sm"
            >
              {t('home.heroTitle')}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.1 }}
              className="text-xs sm:text-sm md:text-base text-semantic-text-secondary max-w-2xl mx-auto leading-relaxed"
            >
              {t('home.heroSubtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. AUTHENTIC SOCIAL PROOF STRIP (Strict Zero Fake Data • Verified Only)   */}
      {/* ========================================================================= */}
      <section className="py-5 sm:py-6 bg-surface-950 border-b border-semantic-border-light/40">
        <div className="container-app">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-surface-900/70 border border-semantic-border-light hover:border-emerald-500/40 transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {t('home.statVerified')}
                </span>
                <span className="text-[10px] text-semantic-text-tertiary">
                  Aadhaar & Admin Approved
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-surface-900/70 border border-semantic-border-light hover:border-brand-500/40 transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-1">
                  <Percent className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {t('home.statCommission')}
                </span>
                <span className="text-[10px] text-semantic-text-tertiary">
                  Zero Middleman Markup
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-surface-900/70 border border-semantic-border-light hover:border-blue-500/40 transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-1">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {t('home.statDirect')}
                </span>
                <span className="text-[10px] text-semantic-text-tertiary">
                  Direct WhatsApp & Call
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-surface-900/70 border border-semantic-border-light hover:border-amber-500/40 transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {allWorkers.length > 0 ? `${allWorkers.length}+ Verified Artisans` : t('home.statHyperlocal')}
                </span>
                <span className="text-[10px] text-semantic-text-tertiary">
                  Dedicated to 251001 & 251002
                </span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. THE REAL PROBLEM SECTION (Stage 3: Interactive Problem vs. Solution)   */}
      {/* ========================================================================= */}
      <section className="py-12 sm:py-16 bg-surface-900/40 border-b border-semantic-border-light relative overflow-hidden">
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
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold tracking-wide mb-3 shadow-sm"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('home.problemBadge')}</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.05 }}
              className="text-xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight"
            >
              {t('home.problemTitle')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.1 }}
              className="text-xs sm:text-sm text-semantic-text-secondary mt-2 max-w-2xl mx-auto leading-relaxed"
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
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="rounded-3xl p-5 sm:p-6 bg-surface-900/90 border border-rose-500/25 relative overflow-hidden shadow-xl"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-rose-500/20">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-rose-400 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{t('home.problemOldHeader')}</span>
                  </h3>
                  <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                    {t('home.problemOldSub')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Unreliable
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { title: t('home.problem1OldTitle'), desc: t('home.problem1OldDesc') },
                  { title: t('home.problem2OldTitle'), desc: t('home.problem2OldDesc') },
                  { title: t('home.problem3OldTitle'), desc: t('home.problem3OldDesc') },
                  { title: t('home.problem4OldTitle'), desc: t('home.problem4OldDesc') },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/15 flex items-start gap-3 transition-colors hover:bg-rose-950/30"
                  >
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-semantic-text-secondary mt-0.5 leading-snug">
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
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="rounded-3xl p-5 sm:p-6 bg-surface-900/90 border border-emerald-500/30 relative overflow-hidden shadow-xl"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-500/20">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{t('home.problemNewHeader')}</span>
                  </h3>
                  <p className="text-[11px] text-semantic-text-tertiary mt-0.5">
                    {t('home.problemNewSub')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Direct & Trusted
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { title: t('home.problem1NewTitle'), desc: t('home.problem1NewDesc') },
                  { title: t('home.problem2NewTitle'), desc: t('home.problem2NewDesc') },
                  { title: t('home.problem3NewTitle'), desc: t('home.problem3NewDesc') },
                  { title: t('home.problem4NewTitle'), desc: t('home.problem4NewDesc') },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3 transition-colors hover:bg-emerald-950/30"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-semantic-text-secondary mt-0.5 leading-snug">
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
      <section className="py-10 sm:py-14 bg-surface-950 border-b border-semantic-border-light">
        <div className="container-app relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-5 px-1">
              <div>
                <h2 className="text-base sm:text-xl font-extrabold text-white flex items-center gap-2">
                  <span>{t('home.popularCategories', 'Popular Services')}</span>
                  <span className="text-[10px] bg-brand-500/20 text-brand-300 font-bold px-2 py-0.5 rounded-full border border-brand-500/30">
                    Same-Day
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-semantic-text-secondary mt-0.5">
                  Book verified local technicians with 0% commission
                </p>
              </div>

              <Link
                to="/search"
                className="text-xs sm:text-sm font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
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
              </motion.div>

              {/* Card 2: Women's Salon & Spa */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
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
              </motion.div>

              {/* Card 3: Men's Salon & Massage */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
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
              </motion.div>

              {/* Card 4: Cleaning & Pest Control */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
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
              </motion.div>

              {/* Card 5: AC & Appliance Repair */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
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
              </motion.div>

              {/* Card 6: All Services (Grid Launcher) */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
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
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FEATURES / HOW IT WORKS (Stage 5: Simple 4-Step Process)               */}
      {/* ========================================================================= */}
      <section className="section bg-surface-900/50 py-12 sm:py-16 border-b border-semantic-border-light">
        <div className="container-app">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
              {t('home.howTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-semantic-text-secondary mt-1.5 leading-relaxed">
              {t('home.howSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
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
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24, delay: idx * 0.08 }}
                whileHover={{ y: -3, scale: 1.01 }}
                className="relative p-5 rounded-2xl bg-surface-100/95 border border-semantic-border-light hover:border-brand-500/40 transition-all shadow-md"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-black text-brand-500/30 font-mono">
                    {item.step}
                  </span>
                  <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                    {item.badge}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-semantic-text-secondary leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* AI Assistant Quick Help Launcher Banner */}
          {aiAssistant && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="mt-8 max-w-2xl mx-auto p-4 rounded-2xl bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-brand-500/10 border border-brand-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {i18n.language === 'hi' ? 'मरम्मत समझ नहीं आ रही? AI से पूछें' : 'Not sure what repair you need?'}
                  </h4>
                  <p className="text-[11px] text-semantic-text-secondary">
                    {i18n.language === 'hi' ? 'हमारा AI सहायक 10 सेकंड में सही मिस्त्री और रेट बताएगा' : 'Our AI Assistant diagnoses the issue & matches the right artisan in 10s.'}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => aiAssistant.openAssistant('customer_booking')}
                className="text-xs font-bold px-4 py-1.5 shrink-0 shadow-md shadow-brand-500/20 active:scale-95 cursor-pointer"
              >
                <span>{i18n.language === 'hi' ? 'AI से पूछें →' : 'Ask AI →'}</span>
              </Button>
            </motion.div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. VERIFIED BOOKING REVIEW GUARANTEE (Stage 6: Zero Fake Reviews Policy)  */}
      {/* ========================================================================= */}
      <section className="py-12 sm:py-16 bg-surface-950 border-b border-semantic-border-light relative overflow-hidden">
        <div className="container-app relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold tracking-wide mb-3 shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{t('home.reviewGuaranteeBadge')}</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.05 }}
              className="text-xl sm:text-3xl font-extrabold text-white tracking-tight"
            >
              {t('home.reviewGuaranteeTitle')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24, delay: 0.1 }}
              className="text-xs sm:text-sm text-semantic-text-secondary mt-2 max-w-2xl mx-auto leading-relaxed"
            >
              {t('home.reviewGuaranteeSubtitle')}
            </motion.p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-emerald-500/40 transition-all shadow-md flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white mb-1.5">
                {t('home.reviewPillar1Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.reviewPillar1Desc')}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-brand-500/40 transition-all shadow-md flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-3">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white mb-1.5">
                {t('home.reviewPillar2Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.reviewPillar2Desc')}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-5 rounded-2xl bg-surface-100/90 border border-semantic-border-light hover:border-blue-500/40 transition-all shadow-md flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white mb-1.5">
                {t('home.reviewPillar3Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.reviewPillar3Desc')}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. DUAL AUDIENCE CONVERSION BANNERS (Stage 7: Citizen & Worker CTAs)      */}
      {/* ========================================================================= */}
      <section className="section bg-surface-900/60 border-t border-semantic-border-light py-14">
        <div className="container-app">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: For Customers */}
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-850 border border-semantic-border-light relative overflow-hidden flex flex-col justify-between shadow-xl"
            >
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
                  className="w-full sm:w-auto font-semibold px-6 shadow-lg shadow-brand-500/20 text-xs sm:text-sm active:scale-95 cursor-pointer"
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
              className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-850 border border-emerald-500/30 relative overflow-hidden flex flex-col justify-between shadow-xl"
            >
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
                  className="w-full sm:w-auto font-semibold px-6 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-xs sm:text-sm active:scale-95 cursor-pointer"
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
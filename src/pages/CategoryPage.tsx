import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Wrench,
  Sparkles,
  Truck,
  Zap,
  Hammer,
  Paintbrush,
  Snowflake,
  Settings,
  Droplets,
  Flame,
  Scissors,
  Palette,
  User,
  Shirt,
  Car,
  ShieldAlert,
  Search,
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle2,
  HardHat,
} from 'lucide-react'
import { JUGNU_CATEGORIES, ServiceItem } from '@kaamgar/shared'
import { fetchCategoryWorkerStats, CategoryWorkerStat } from '@/services/workers'

// Icon resolver for category and service visuals
const iconMap: Record<string, React.ElementType> = {
  home: Home,
  wrench: Wrench,
  sparkles: Sparkles,
  truck: Truck,
  zap: Zap,
  hammer: Hammer,
  brush: Paintbrush,
  paintbrush: Paintbrush,
  'hard-hat': HardHat,
  'brick-wall': Wrench,
  snowflake: Snowflake,
  cog: Settings,
  droplets: Droplets,
  flame: Flame,
  scissors: Scissors,
  palette: Palette,
  user: User,
  shirt: Shirt,
  car: Car,
  'shield-alert': ShieldAlert,
}

export default function CategoryPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isHindi = i18n.language === 'hi'

  const [searchQuery, setSearchQuery] = useState('')
  const [workerStats, setWorkerStats] = useState<Record<string, CategoryWorkerStat>>({})

  // Two-Level Selection: Selected Category ID (Level 1: null -> 5 categories, Level 2: id -> services of that category)
  const selectedCategoryId = searchParams.get('c')
  const setSelectedCategoryId = (catId: string | null) => {
    if (catId) {
      setSearchParams({ c: catId })
    } else {
      setSearchParams({})
    }
  }

  useEffect(() => {
    fetchCategoryWorkerStats()
      .then(setWorkerStats)
      .catch(() => {})
  }, [])

  // Handle service selection: navigates into the existing worker discovery flow
  const handleServiceSelect = (service: ServiceItem) => {
    navigate(`/search?category=${encodeURIComponent(service.id)}`)
  }

  // Active Category details when in Level 2
  const activeCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    return JUGNU_CATEGORIES.find(c => c.id === selectedCategoryId) || null
  }, [selectedCategoryId])

  // Flat list of matching services when user actively searches across the platform
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []

    const matches: { service: ServiceItem; categoryName: string }[] = []
    JUGNU_CATEGORIES.forEach(category => {
      const catMatches =
        category.name_en.toLowerCase().includes(query) ||
        category.name_hi.toLowerCase().includes(query)

      category.services.forEach(service => {
        if (
          catMatches ||
          service.name_en.toLowerCase().includes(query) ||
          service.name_hi.toLowerCase().includes(query) ||
          service.id.toLowerCase().includes(query)
        ) {
          matches.push({
            service,
            categoryName: isHindi ? category.name_hi : category.name_en,
          })
        }
      })
    })

    return matches
  }, [searchQuery, isHindi])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      {/* Top Header & Search Bar */}
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 sticky top-14 md:top-16 z-30 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between mb-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('categoryPage.backToHome', 'Back to Home')}</span>
            </Link>

            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              0% Commission Direct
            </span>
          </div>

          {/* Heading */}
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('categoryPage.findAService', 'Find a Service')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              {activeCategory
                ? t(
                    'categoryPage.selectServicePrompt',
                    'Select a service to find verified workers'
                  )
                : t('categoryPage.chooseCategory', 'Choose a category')}
            </p>
          </div>

          {/* Search Box (Fast direct service finder) */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t(
                'categoryPage.searchPlaceholder',
                'Search services (e.g. Electrician, AC, Maid, Driver)...'
              )}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
              aria-label={t('categoryPage.searchLabel', 'What service do you need?')}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Stats if active */}
          {searchQuery.trim() && (
            <div className="flex items-center justify-between mt-2 px-1 text-xs text-slate-500 dark:text-zinc-400">
              <span>
                {t('categoryPage.servicesFound', { count: searchResults.length })}
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer"
              >
                {t('categoryPage.clearSearch', 'Clear Search')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {/* CASE A: Active Search Results View */}
        {searchQuery.trim() ? (
          <div>
            {searchResults.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="w-14 h-14 mx-auto mb-3 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {t('categoryPage.noServicesFound', { query: searchQuery })}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                  {t(
                    'categoryPage.noServicesDesc',
                    'Try searching for Electrician, Plumber, AC, Maid, Driver, or Mechanic.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md hover:brightness-105 transition-all cursor-pointer"
                >
                  {t('categoryPage.clearSearch', 'Clear Search')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {searchResults.map(({ service, categoryName }) => {
                  const ServiceIcon = iconMap[service.icon] || Wrench
                  const servicePrimary = isHindi ? service.name_hi : service.name_en
                  const serviceSecondary = isHindi ? service.name_en : service.name_hi
                  const stats = workerStats[service.id]

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleServiceSelect(service)}
                      className="group p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 shadow-xs hover:shadow-md transition-all active:scale-[0.98] text-left flex items-start gap-3 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                        <ServiceIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                            {servicePrimary}
                          </h3>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          {serviceSecondary}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800 text-[10px] text-slate-400 dark:text-zinc-500">
                          <span className="truncate font-medium text-amber-600 dark:text-amber-400/80">
                            {categoryName}
                          </span>
                          {stats && stats.total > 0 && (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {stats.total}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : activeCategory ? (
          /* CASE B: LEVEL 2 — Selected Category View (ONLY that category's services) */
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Obvious Back Button to Return to the 5 Categories */}
            <div>
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-amber-500" />
                <span>{t('categoryPage.allCategoriesBtn', '← All Categories')}</span>
              </button>
            </div>

            {/* Selected Category Banner */}
            {(() => {
              const CatIcon = iconMap[activeCategory.icon] || Wrench
              const primaryName = isHindi ? activeCategory.name_hi : activeCategory.name_en
              const secondaryName = isHindi ? activeCategory.name_en : activeCategory.name_hi

              return (
                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-amber-500/40 shadow-sm flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-bold flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                      <CatIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                        {primaryName}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                        {secondaryName}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 shrink-0">
                    {activeCategory.services.length} {t('common.services', 'services')}
                  </span>
                </div>
              )
            })()}

            {/* Subheading for Service Selection */}
            <div className="pt-2 px-1 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                {t('categoryPage.selectService', 'Select Service')}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Tap any service to find verified workers
              </span>
            </div>

            {/* ONLY Services Belonging to the Selected Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeCategory.services.map(service => {
                const ServiceIcon = iconMap[service.icon] || Wrench
                const servicePrimary = isHindi ? service.name_hi : service.name_en
                const serviceSecondary = isHindi ? service.name_en : service.name_hi
                const stats = workerStats[service.id]

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleServiceSelect(service)}
                    className="group p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 shadow-xs hover:shadow-md transition-all active:scale-[0.98] text-left flex items-start gap-3.5 cursor-pointer"
                  >
                    {/* Service Icon */}
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                      <ServiceIcon className="w-5 h-5" />
                    </div>

                    {/* Service Name & Subtext */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                          {servicePrimary}
                        </h3>
                        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0 ml-1" />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                        {serviceSecondary}
                      </p>
                      {stats && stats.total > 0 && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {stats.total} verified
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        ) : (
          /* CASE C: LEVEL 1 — Initial Screen: ONLY 5 Categories (0 services rendered) */
          <div className="space-y-3">
            {JUGNU_CATEGORIES.map(category => {
              const CatIcon = iconMap[category.icon] || Wrench
              const primaryName = isHindi ? category.name_hi : category.name_en
              const secondaryName = isHindi ? category.name_en : category.name_hi

              return (
                <div
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className="group p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 hover:border-amber-500/50 dark:hover:border-amber-500/50 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer select-none flex items-center justify-between"
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Category Branded Icon */}
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-xs">
                      <CatIcon className="w-6 h-6" />
                    </div>

                    {/* Category Titles */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {primaryName}
                        </h2>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                          {category.services.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                        {secondaryName}
                      </p>
                    </div>
                  </div>

                  {/* Navigation Arrow */}
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

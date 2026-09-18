import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
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
  Plus,
  Minus,
  X,
  CheckCircle2,
  HardHat,
} from 'lucide-react'
import { JUGNU_CATEGORIES, ServiceItem, CategoryGroup } from '@kaamgar/shared'
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
  const isHindi = i18n.language === 'hi'

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    home_repair: true, // First category open by default for immediate engagement
  })
  const [workerStats, setWorkerStats] = useState<Record<string, CategoryWorkerStat>>({})

  useEffect(() => {
    fetchCategoryWorkerStats()
      .then(setWorkerStats)
      .catch(() => {})
  }, [])

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  // Handle service selection: navigates into the existing worker discovery flow
  const handleServiceSelect = (service: ServiceItem) => {
    navigate(`/search?category=${encodeURIComponent(service.id)}`)
  }

  // Filtered categories and services based on user search input
  const { filteredCategories, totalMatchingServices } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return {
        filteredCategories: JUGNU_CATEGORIES,
        totalMatchingServices: JUGNU_CATEGORIES.reduce((acc, cat) => acc + cat.services.length, 0),
      }
    }

    let matchCount = 0
    const filtered = JUGNU_CATEGORIES.map(category => {
      // Check if category name matches
      const categoryMatches =
        category.name_en.toLowerCase().includes(query) ||
        category.name_hi.toLowerCase().includes(query)

      // Filter child services
      const matchingServices = category.services.filter(service => {
        return (
          categoryMatches ||
          service.name_en.toLowerCase().includes(query) ||
          service.name_hi.toLowerCase().includes(query) ||
          service.id.toLowerCase().includes(query)
        )
      })

      if (matchingServices.length > 0) {
        matchCount += matchingServices.length
        return {
          ...category,
          services: matchingServices,
        }
      }
      return null
    }).filter(Boolean) as CategoryGroup[]

    return {
      filteredCategories: filtered,
      totalMatchingServices: matchCount,
    }
  }, [searchQuery])

  // When search query is active, auto-expand all matching categories
  useEffect(() => {
    if (searchQuery.trim()) {
      const allOpen: Record<string, boolean> = {}
      filteredCategories.forEach(cat => {
        allOpen[cat.id] = true
      })
      setExpandedCategories(allOpen)
    }
  }, [searchQuery, filteredCategories])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      {/* Top Header & Search Bar */}
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 sticky top-14 md:top-16 z-30 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {/* Back to Home Button */}
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
              {t('categoryPage.title', 'Find the Right Service for Your Home')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              {t(
                'categoryPage.subtitle',
                'Verified local experts across Muzaffarnagar • 0% Commission direct pricing'
              )}
            </p>
          </div>

          {/* Search Box */}
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
                {t('categoryPage.servicesFound', { count: totalMatchingServices })}
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

      {/* Main Categories Accordion Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
        {filteredCategories.length === 0 ? (
          /* Empty Search Results State */
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
          /* The 5 Category Accordions */
          filteredCategories.map(category => {
            const isExpanded = !!expandedCategories[category.id]
            const CategoryIcon = iconMap[category.icon] || Wrench
            const primaryName = isHindi ? category.name_hi : category.name_en
            const secondaryName = isHindi ? category.name_en : category.name_hi

            return (
              <div
                key={category.id}
                className={`rounded-3xl border transition-all duration-200 overflow-hidden shadow-sm ${
                  isExpanded
                    ? 'bg-white dark:bg-zinc-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                    : 'bg-white/80 dark:bg-zinc-900/70 border-slate-200 dark:border-zinc-800/90 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Category Header Row (Expand / Collapse trigger) */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-850/50"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Category Icon */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${
                        isExpanded
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                          : 'bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <CategoryIcon className="w-5 h-5" />
                    </div>

                    {/* Category Titles */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight truncate">
                          {primaryName}
                        </h2>
                        <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                          {category.services.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                        {secondaryName}
                      </p>
                    </div>
                  </div>

                  {/* Expand / Collapse Control Button */}
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium hidden sm:inline">
                      {isExpanded ? 'Hide' : 'View'}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                        isExpanded
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-amber-500/50'
                      }`}
                    >
                      {isExpanded ? (
                        <Minus className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Collapsible Services Grid */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/40"
                    >
                      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {category.services.map(service => {
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
                              {/* Service Icon */}
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                                <ServiceIcon className="w-4 h-4" />
                              </div>

                              {/* Service Name & Subtext */}
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
                                {stats && stats.total > 0 && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
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
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

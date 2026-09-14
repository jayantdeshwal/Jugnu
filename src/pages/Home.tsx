import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Badge } from '@/ui'
import { usePublicCatalog } from '@/hooks/usePublicCatalog'
import { fetchCategoryWorkerStats, CategoryWorkerStat } from '@/services/workers'
import { CATEGORIES, MUZAFFARNAGAR_PINCODES, getCategoryName } from '@kaamgar/shared'
import {
  Search,
  Truck,
  Zap,
  Wrench,
  Hammer,
  Snowflake,
  Brush,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Star,
  MapPin,
  PhoneCall,
  MessageSquare,
  ArrowRight,
  Sparkles,
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
  Download,
} from 'lucide-react'
import { motion } from 'framer-motion'
import AppDownloadBanner from '@/components/AppDownloadBanner'
import { triggerPWAInstall } from '@/components/PWAInstallPrompt'

const iconMap: Record<string, any> = {
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  snowflake: Snowflake,
  brush: Brush,
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const { categories } = usePublicCatalog()
  const navigate = useNavigate()

  // Search state
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Real worker stats from database
  const [workerStats, setWorkerStats] = useState<Record<string, CategoryWorkerStat>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    let isMounted = true
    fetchCategoryWorkerStats()
      .then(stats => {
        if (isMounted) setWorkerStats(stats)
      })
      .catch(err => {
        console.warn('Failed to load category worker counts:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingStats(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedArea) params.set('area', selectedArea)
    const queryString = params.toString()
    navigate(queryString ? `/search?${queryString}` : '/search')
  }

  const handleQuickPick = (categoryId: string) => {
    navigate(`/search?category=${categoryId}`)
  }

  return (
    <div className="min-h-screen bg-semantic-bg-primary text-semantic-text-primary">
      {/* ========================================================================= */}
      {/* 1. HERO & SMART SEARCH SECTION                                            */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-surface-950 via-surface-900 to-surface-950 py-16 sm:py-24 border-b border-semantic-border-light">
        {/* Subtle decorative mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.06),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />

        <div className="container-app relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Top Eyebrow Badges & Quick Install Trigger */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2.5 mb-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold uppercase tracking-wider shadow-sm backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>{t('home.heroBadge')}</span>
              </div>

              <button
                type="button"
                onClick={() => triggerPWAInstall()}
                className="relative group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500 text-surface-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-105 active:scale-95 transition-all border border-amber-200/80 cursor-pointer"
              >
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-600"></span>
                </span>
                <Download className="w-3.5 h-3.5 animate-bounce text-surface-950" />
                <span className="font-extrabold">{t('pwa.installApp', 'Install App')}</span>
              </button>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight sm:leading-tight mb-5"
            >
              {t('home.heroTitle')}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg lg:text-xl text-semantic-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              {t('home.heroSubtitle')}
            </motion.p>

            {/* Smart Search Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-8"
            >
              <form
                onSubmit={handleSearchSubmit}
                className="bg-surface-900/90 border border-semantic-border-medium rounded-2xl p-2 sm:p-2.5 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-stretch gap-2"
              >
                {/* Field 1: Category Selector */}
                <div className="flex-1 min-w-[170px] flex items-center bg-surface-800/90 rounded-xl px-3 border border-semantic-border-light/60 transition-colors focus-within:border-brand-500/80">
                  <Wrench className="w-4 h-4 text-brand-400 shrink-0 mr-2" />
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full bg-transparent py-3 text-sm text-semantic-text-primary focus:outline-none cursor-pointer"
                    aria-label={t('home.searchSelectCategory')}
                  >
                    <option value="" className="bg-surface-900 text-white">
                      {t('home.searchSelectCategory')}
                    </option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id} className="bg-surface-900 text-white">
                        {getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 2: Area / Pincode Selector */}
                <div className="flex-1 min-w-[170px] flex items-center bg-surface-800/90 rounded-xl px-3 border border-semantic-border-light/60 transition-colors focus-within:border-emerald-500/80">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mr-2" />
                  <select
                    value={selectedArea}
                    onChange={e => setSelectedArea(e.target.value)}
                    className="w-full bg-transparent py-3 text-sm text-semantic-text-primary focus:outline-none cursor-pointer"
                    aria-label={t('home.searchSelectArea')}
                  >
                    <option value="" className="bg-surface-900 text-white">
                      {t('home.searchSelectArea')}
                    </option>
                    {MUZAFFARNAGAR_PINCODES.map(pincode => (
                      <option key={pincode} value={pincode} className="bg-surface-900 text-white">
                        {pincode} - {pincode === '251001' ? 'City / New Mandi' : 'Cantt / Civil Lines'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 3: Keyword Input */}
                <div className="flex-[1.4] min-w-[200px] flex items-center bg-surface-800/90 rounded-xl px-3 border border-semantic-border-light/60 transition-colors focus-within:border-brand-500/80">
                  <Search className="w-4 h-4 text-semantic-text-tertiary shrink-0 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('home.searchKeywordPlaceholder')}
                    className="w-full bg-transparent py-3 text-sm text-white placeholder:text-semantic-text-tertiary focus:outline-none"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-400 text-surface-950 font-bold rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 whitespace-nowrap transition-transform active:scale-[0.98]"
                >
                  <Search className="w-4 h-4" />
                  <span>{t('home.searchButton')}</span>
                </Button>
              </form>
            </motion.div>

            {/* Quick Category Chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              <span className="text-xs text-semantic-text-tertiary font-medium mr-1">
                {t('home.quickPicks')}
              </span>
              {categories.map(cat => {
                const Icon = iconMap[cat.icon as keyof typeof iconMap] || Wrench
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleQuickPick(cat.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800/60 border border-semantic-border-light/60 text-semantic-text-secondary hover:text-white hover:bg-surface-700/80 hover:border-brand-500/50 transition-all"
                  >
                    <Icon className="w-3.5 h-3.5 text-brand-400" />
                    <span>{getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}</span>
                  </button>
                )
              })}
            </motion.div>
          </div>
        </div>

        {/* Trust Metric Strip */}
        <div className="container-app mt-12 pt-8 border-t border-semantic-border-light/40">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-semantic-text-primary">
                {t('home.statVerified')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2.5">
              <Percent className="w-5 h-5 text-brand-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-semantic-text-primary">
                {t('home.statCommission')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2.5">
              <PhoneCall className="w-5 h-5 text-blue-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-semantic-text-primary">
                {t('home.statDirect')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-900/40 border border-semantic-border-light/30 flex items-center justify-center gap-2.5">
              <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-semantic-text-primary">
                {t('home.statHyperlocal')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. POPULAR SERVICES WITH REAL WORKER METRICS                              */}
      {/* ========================================================================= */}
      <section className="section bg-semantic-bg-primary">
        <div className="container-app">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Muzaffarnagar Directory</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-semantic-text-primary">
                {t('home.popularCategories')}
              </h2>
              <p className="text-sm text-semantic-text-secondary mt-1 max-w-xl">
                {t('home.servicesSubtitle')}
              </p>
            </div>

            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors shrink-0"
            >
              <span>{t('home.viewAllServices')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {categories.map((cat, index) => {
              const Icon = iconMap[cat.icon as keyof typeof iconMap] || Truck
              const stat = workerStats[cat.id]
              const totalWorkers = stat ? stat.total : 0

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.06 }}
                >
                  <Link
                    to={`/search?category=${cat.id}`}
                    className="group block p-6 rounded-2xl bg-surface-100 border border-semantic-border-light hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="w-14 h-14 mb-5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:bg-brand-500 group-hover:text-surface-950 transition-all duration-300 group-hover:scale-105">
                      <Icon className="w-7 h-7 transition-colors" />
                    </div>

                    <h3 className="font-bold text-base text-semantic-text-primary group-hover:text-brand-400 transition-colors mb-2">
                      {getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}
                    </h3>

                    {/* Real Database Indicator of Workers */}
                    <div className="mb-4">
                      {loadingStats ? (
                        <span className="text-xs text-semantic-text-tertiary animate-pulse">
                          {t('common.loading', 'Loading...')}
                        </span>
                      ) : totalWorkers > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {totalWorkers === 1
                            ? t('home.workerCountAvailable', { count: totalWorkers })
                            : t('home.workerCountAvailablePlural', { count: totalWorkers })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300/90 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                          {t('home.workerTakingReg')}
                        </span>
                      )}
                    </div>

                    <div className="pt-3 border-t border-semantic-border-light flex items-center justify-between text-xs text-semantic-text-tertiary group-hover:text-brand-400 transition-colors">
                      <span className="font-medium">Book Now</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. WHY CHOOSE KAAMGAR: TRUST & QUALITY ASSURANCE PILLARS                 */}
      {/* ========================================================================= */}
      <section className="section bg-surface-900/60 border-y border-semantic-border-light">
        <div className="container-app">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Trust & Quality Standard</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-semantic-text-primary">
              {t('home.whyTitle')}
            </h2>
            <p className="text-sm text-semantic-text-secondary mt-2">
              {t('home.whySubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light hover:border-emerald-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-semantic-text-primary mb-2">
                {t('home.whyPillar1Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar1Desc')}
              </p>
            </Card>

            {/* Pillar 2 */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light hover:border-brand-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-4">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-semantic-text-primary mb-2">
                {t('home.whyPillar2Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar2Desc')}
              </p>
            </Card>

            {/* Pillar 3 */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light hover:border-amber-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Percent className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-semantic-text-primary mb-2">
                {t('home.whyPillar3Title')}
              </h3>
              <p className="text-xs text-semantic-text-secondary leading-relaxed">
                {t('home.whyPillar3Desc')}
              </p>
            </Card>

            {/* Pillar 4 */}
            <Card className="p-6 bg-surface-100 border border-semantic-border-light hover:border-blue-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-semantic-text-primary mb-2">
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
      {/* 4. HOW IT WORKS TIMELINE                                                 */}
      {/* ========================================================================= */}
      <section className="section bg-semantic-bg-primary">
        <div className="container-app">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-semantic-text-primary">
              {t('home.howTitle')}
            </h2>
            <p className="text-sm text-semantic-text-secondary mt-2">
              {t('home.howSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {[
              {
                step: '01',
                title: t('home.step1Title'),
                desc: t('home.step1Desc'),
                icon: Search,
              },
              {
                step: '02',
                title: t('home.step2Title'),
                desc: t('home.step2Desc'),
                icon: Star,
              },
              {
                step: '03',
                title: t('home.step3Title'),
                desc: t('home.step3Desc'),
                icon: Calendar,
              },
              {
                step: '04',
                title: t('home.step4Title'),
                desc: t('home.step4Desc'),
                icon: MessageSquare,
              },
            ].map(({ step, title, desc, icon: StepIcon }, idx) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="p-6 rounded-2xl bg-surface-100 border border-semantic-border-light flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-brand-500/40 group-hover:text-brand-400 transition-colors">
                      {step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center text-brand-400">
                      <StepIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="font-bold text-base text-semantic-text-primary mb-2">
                    {title}
                  </h3>
                  <p className="text-xs text-semantic-text-secondary leading-relaxed">
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. DEDICATED APP DOWNLOAD SECTION                                         */}
      {/* ========================================================================= */}
      <AppDownloadBanner />

      {/* ========================================================================= */}
      {/* 6. DUAL AUDIENCE CONVERSION BANNERS (CUSTOMER & WORKER)                  */}
      {/* ========================================================================= */}
      <section className="section bg-surface-950/80 border-t border-semantic-border-light py-16">
        <div className="container-app">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Card 1: For Customers */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-850 border border-semantic-border-light relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <Badge variant="brand" size="sm" className="mb-4">
                  {t('homeCta.badgeVerified')}
                </Badge>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {t('homeCta.customerCardTitle')}
                </h3>
                <p className="text-sm text-semantic-text-secondary leading-relaxed mb-6">
                  {t('homeCta.customerCardSubtitle')}
                </p>
              </div>

              <div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/search')}
                  className="w-full sm:w-auto font-semibold px-8 shadow-lg shadow-brand-500/20"
                >
                  <Search className="w-4 h-4 mr-2" />
                  <span>{t('homeCta.customerCardBtn')}</span>
                </Button>
              </div>
            </div>

            {/* Card 2: For Workers */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-850 border border-emerald-500/30 relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <Badge variant="success" size="sm" className="mb-4">
                  {t('homeCta.workerCardBadge', '0% Commission for Starting 3 Months')}
                </Badge>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {t('homeCta.workerCardTitle')}
                </h3>
                <p className="text-sm text-semantic-text-secondary leading-relaxed mb-6">
                  {t('homeCta.workerCardSubtitle')}
                </p>
              </div>

              <div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/register?role=worker')}
                  className="w-full sm:w-auto font-semibold px-8 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
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
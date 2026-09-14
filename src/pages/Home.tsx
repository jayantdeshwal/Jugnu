import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Badge, Chip, Input } from '@/ui'
import { usePublicCatalog } from '@/hooks/usePublicCatalog'
import { Truck, Zap, Wrench, Hammer, Snowflake, Brush, Search, ArrowRight, Check, Star, MapPin, Shield, Users, Clock, Heart, Sparkles, ArrowDown } from 'lucide-react'
import { motion } from 'framer-motion'

const iconMap = {
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  snowflake: Snowflake,
  brush: Brush,
}

const trustBadges = [
  { icon: Shield, titleKey: 'home.trustBadges.verified', descKey: 'home.trustBadges.verifiedDesc' },
  { icon: Star, titleKey: 'home.trustBadges.rated', descKey: 'home.trustBadges.ratedDesc' },
  { icon: MapPin, titleKey: 'home.trustBadges.local', descKey: 'home.trustBadges.localDesc' },
]

export default function Home() {
  const { t } = useTranslation()
  const { categories } = usePublicCatalog()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const handleCategoryClick = (categoryId: string) => {
    setSearchParams({ category: categoryId })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const query = formData.get('query') as string
    const category = formData.get('category') as string
    const area = formData.get('area') as string

    const params: Record<string, string> = {}
    if (query) params.q = query
    if (category) params.category = category
    if (area) params.area = area

    const queryString = new URLSearchParams(params).toString()
    navigate(queryString ? `/search?${queryString}` : '/search')
  }

  return (
    <div className="min-h-screen bg-semantic-bg-primary">
      <section className="relative overflow-hidden bg-gradient-to-br from-surface-950 via-surface-900 to-surface-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 36v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 6V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-2 mb-6"
            >
              <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20">
                <Truck className="w-4 h-4 inline mr-1" />
                {t('home.trustBadges.localDesc')}
              </span>
              <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20">
                <Sparkles className="w-4 h-4 inline mr-1" />
                100% Verified Workers
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-6 text-balance"
            >
              {t('home.heroTitle')}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-lg lg:text-xl text-white/90 mb-8 max-w-2xl"
            >
              {t('home.heroSubtitle')}
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              onSubmit={handleSearch}
              className="flex flex-col sm:flex-row gap-3 max-w-xl"
            >
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                <Input
                  name="query"
                  placeholder={t('home.searchPlaceholder')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/60 focus:ring-white/50 focus:border-transparent"
                  leftIcon={<Search className="w-5 h-5" />}
                />
              </div>
              <Button type="submit" size="lg" className="whitespace-nowrap bg-brand-500 text-surface-950 hover:bg-brand-400 px-8 shadow-lg hover:shadow-xl">
                <Search className="w-5 h-5 mr-2" />
                {t('home.searchButton')}
              </Button>
            </motion.form>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {categories.map(cat => {
                return (
                  <Chip
                    key={cat.id}
                    variant="outline"
                    onClick={() => handleCategoryClick(cat.id)}
                    className="border-white/30 text-white hover:bg-white/10"
                  >
                    {t(`categories.${cat.id}`, { defaultValue: cat.name_en })}
                  </Chip>
                )
              })}
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-semantic-bg-primary to-transparent"
        />
      </section>

      <section className="section bg-semantic-bg-primary">
        <div className="container-app">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="section-header"
          >
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="section-title">{t('home.popularCategories')}</h2>
                <p className="section-subtitle">Find the right professional for your job</p>
              </div>
              <Link to="/search" className="hidden sm:flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium">
                {t('common.viewAll')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            {categories.map((cat, index) => {
              const Icon = iconMap[cat.icon as keyof typeof iconMap] || Truck
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <Link
                    to={`/search?category=${cat.id}`}
                    className="card-interactive group p-6 text-center"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                      <Icon className="w-8 h-8 text-brand-600 dark:text-brand-400 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="font-semibold text-semantic-text-primary group-hover:text-brand-600 transition-colors">
                      {t(`categories.${cat.id}`)}
                    </h3>
                    <p className="text-sm text-semantic-text-tertiary mt-1">
                      {Math.floor(Math.random() * 8) + 3} {t('common.workersAvailable')}
                    </p>
                    <div className="mt-4 pt-4 border-t border-semantic-border-light">
                      <ArrowRight className="w-5 h-5 mx-auto text-semantic-text-tertiary group-hover:text-brand-600 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      <section className="section bg-semantic-bg-secondary">
        <div className="container-app">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="section-title">{t('home.howItWorks')}</h2>
            <p className="section-subtitle mx-auto">Simple steps to get your job done</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid md:grid-cols-4 gap-8"
          >
            {[
              { step: 1, title: t('home.step1Title'), desc: t('home.step1Desc'), icon: Search },
              { step: 2, title: t('home.step2Title'), desc: t('home.step2Desc'), icon: Star },
              { step: 3, title: t('home.step3Title'), desc: t('home.step3Desc'), icon: Check },
              { step: 4, title: t('home.step4Title'), desc: t('home.step4Desc'), icon: Heart },
            ].map(({ step, title, desc, icon: Icon }) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: step * 0.1 }}
                className="text-center relative"
              >
                <div className="relative mb-6">
                  <div className="w-16 h-16 mx-auto bg-brand-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                    {step}
                  </div>
                  {step < 4 && (
                    <div className="hidden md:block absolute top-8 left-1/2 w-full h-1 bg-gradient-to-r from-brand-200 to-transparent" />
                  )}
                </div>
                <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center">
                  <Icon className="w-8 h-8 text-brand-600" />
                </div>
                <h3 className="font-semibold text-semantic-text-primary mb-2">{title}</h3>
                <p className="text-semantic-text-secondary">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section bg-semantic-bg-primary">
        <div className="container-app">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid md:grid-cols-3 gap-8"
          >
            {trustBadges.map(({ icon: Icon, titleKey, descKey }) => (
              <motion.div
                key={titleKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="text-center p-6"
              >
                <div className="w-14 h-14 mx-auto mb-4 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
                  <Icon className="w-7 h-7 text-brand-600" />
                </div>
                <h3 className="font-semibold text-semantic-text-primary mb-2">{t(titleKey)}</h3>
                <p className="text-semantic-text-secondary">{t(descKey)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section bg-brand-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 36v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 6V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl lg:text-4xl font-bold text-white mb-4"
          >
            Ready to find a worker?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-white/80 mb-8 max-w-2xl mx-auto"
          >
            Join thousands of customers in Muzaffarnagar who trust us for their home service needs.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button variant="secondary" size="lg" onClick={() => navigate('/search')} className="bg-brand-500 text-surface-950 hover:bg-brand-400 px-8 shadow-lg">
              <Search className="w-5 h-5 mr-2" />
              Find Workers Now
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 px-8" onClick={() => navigate('/register/worker')}>
              <Truck className="w-5 h-5 mr-2" />
              Register as Worker
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
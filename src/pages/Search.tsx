import { useEffect, useState, useMemo } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Button, Card, Avatar, Badge, RatingStars, Chip, Input } from '@/ui'
import { CATEGORIES, getCategoryName, getServicesByCategoryId, getServiceById, getCategoryById } from '@kaamgar/shared'
import { usePublicCatalog } from '@/hooks/usePublicCatalog'
import { Search as SearchIcon, Filter, MapPin, Star, Clock, CheckCircle, Truck, X, ChevronDown, ArrowRight, ArrowLeft, Power } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchApprovedWorkers } from '@/services/workers'

interface SearchWorker {
  id: string
  name: string
  category: string
  experience: number
  rating: number
  reviews: number
  areas: string[]
  bio: string
  avatar: string | null
  verified: boolean
  available: boolean
  categories?: string[]
}


const iconComponents = {
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  snowflake: Snowflake,
  brush: Brush,
}

import { Zap, Wrench, Hammer, Snowflake, Brush } from 'lucide-react'

function FilterPanel({ filtersOpen, setFiltersOpen, selectedCategory, setSelectedCategory, selectedArea, setSelectedArea, t, categories, serviceAreas, i18n }: any) {
  if (!filtersOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="container-app pb-4 border-t border-semantic-border-light bg-semantic-bg-secondary"
    >
      <div className="max-w-7xl mx-auto space-y-4 pt-4">
        <div>
          <label className="label">{t('common.category')}</label>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!selectedCategory} onClick={() => setSelectedCategory('')} variant="outline">
              {t('categories.all')}
            </Chip>
            {categories.map((cat: any) => (
              <Chip key={cat.id} selected={selectedCategory === cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)} variant="outline">
                {getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{t('common.area')}</label>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!selectedArea} onClick={() => setSelectedArea('')} variant="outline">
              {t('common.allAreas', 'All Areas')}
            </Chip>
            {serviceAreas.map((area: any) => (
              <Chip key={area.id} selected={selectedArea === area.pincode} onClick={() => setSelectedArea(selectedArea === area.pincode ? '' : area.pincode)} variant="outline">
                {area.locality} ({area.pincode})
              </Chip>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  )
}

function ResultsHeader({ filteredWorkers, selectedCategory, t, getCategoryName, CATEGORIES, i18n }: any) {
  const currentItem = selectedCategory
    ? getServiceById(selectedCategory) || getCategoryById(selectedCategory) || CATEGORIES.find((c: any) => c.id === selectedCategory)
    : null

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-semantic-text-primary">{t('nav.search')}</h1>
          <p className="text-semantic-text-secondary mt-1">
            {filteredWorkers.length} {t('common.workersFound') || 'workers found'}
            {selectedCategory && currentItem && ` - ${getCategoryName(currentItem, i18n.language === 'hi' ? 'hi' : 'en')}`}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ t, clearFilters }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
      <Truck className="w-16 h-16 mx-auto text-semantic-text-tertiary mb-4" />
      <h3 className="text-lg font-medium text-semantic-text-primary mb-2">{t('common.noWorkersFound', 'No workers found')}</h3>
      <p className="text-semantic-text-secondary mb-6">{t('common.adjustFilters', 'Try adjusting your filters or search terms')}</p>
      <Button variant="outline" onClick={clearFilters}>{t('common.clearFilters', 'Clear Filters')}</Button>
    </motion.div>
  )
}

function WorkerGrid({ filteredWorkers, t, iconComponents, CATEGORIES, getCategoryName, i18n, quoteServiceRequestId }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ staggerChildren: 0.08 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredWorkers.map((worker: any, index: number) => {
        const workerCats = worker.categories && worker.categories.length > 0 ? worker.categories : [worker.category]
        const catLabel = workerCats.map((cId: string) => {
          const cObj = CATEGORIES.find((c: typeof CATEGORIES[0]) => c.id === cId)
          return cObj ? getCategoryName(cObj, i18n.language === 'hi' ? 'hi' : 'en') : cId
        }).join(' • ')

        return (
          <motion.div key={worker.id} style={{ transitionDelay: `${index * 80}ms` }}>
            <Link to={`/worker/${worker.id}`} state={quoteServiceRequestId ? { serviceRequestId: quoteServiceRequestId } : undefined} className="card-interactive group">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={worker.name} size="lg" src={worker.avatar} status={worker.available ? 'online' : 'busy'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-semantic-text-primary truncate">{worker.name}</h3>
                      {worker.verified && (
                        <Badge variant="brand" dot className="ml-2">
                          {t('workerCard.verified', 'Verified')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-semantic-text-secondary">
                      <span className="flex items-center gap-1" title={catLabel}>
                        {React.createElement(
                          iconComponents[worker.category as keyof typeof iconComponents] || Truck,
                          { className: 'w-4 h-4' }
                        )}
                        <span className="truncate max-w-[200px]">{catLabel}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {t('workerCard.experience', { years: worker.experience })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <RatingStars rating={worker.rating} size="sm" showValue />
                      <span className="text-sm text-semantic-text-tertiary">({worker.reviews} {t('common.reviews', 'Reviews')})</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-sm text-semantic-text-tertiary">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{worker.areas.join(', ')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-semantic-border-light flex items-center justify-between">
                  <span className="text-sm">
                    {worker.available ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle className="w-4 h-4" />
                        {t('workerCard.available', 'Available')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <Power className="w-4 h-4" />
                        {t('workerCard.unavailable', 'Unavailable')}
                      </span>
                    )}
                  </span>
                  {worker.available ? (
                    <Button size="sm" variant="primary">{t('workerCard.bookNow', 'Book Now')} <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  ) : (
                    <Button size="sm" variant="secondary" disabled className="opacity-60 cursor-not-allowed">
                      {t('workerProfile.unavailable', 'Unavailable')}
                    </Button>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function SearchResults({ filteredWorkers, selectedCategory, isLoadingWorkers, t, getCategoryName, CATEGORIES, iconComponents, EmptyState, WorkerGrid, i18n, quoteServiceRequestId }: any) {
  return (
    <>
      <ResultsHeader filteredWorkers={filteredWorkers} selectedCategory={selectedCategory} t={t} getCategoryName={getCategoryName} CATEGORIES={CATEGORIES} i18n={i18n} />
      {isLoadingWorkers ? (
        <div className="py-16 text-center text-semantic-text-tertiary">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">{t('common.loadingWorkers', 'Loading verified workers...')}</p>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <EmptyState t={t} clearFilters={() => {}} />
      ) : (
        <WorkerGrid filteredWorkers={filteredWorkers} t={t} iconComponents={iconComponents} CATEGORIES={CATEGORIES} getCategoryName={getCategoryName} i18n={i18n} quoteServiceRequestId={quoteServiceRequestId} />
      )}
    </>
  )
}

export default function Search() {
  const { t, i18n } = useTranslation()
  const { categories, serviceAreas } = usePublicCatalog()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(searchParams.get('filters') || searchParams.get('view') === 'services' || searchParams.get('category'))
  )
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [selectedArea, setSelectedArea] = useState(searchParams.get('area') || '')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [workerData, setWorkerData] = useState<SearchWorker[]>([])
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true)
  const quoteServiceRequestId = location.state?.quoteServiceRequestId as string | undefined

  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat !== null) {
      setSelectedCategory(cat)
    }
    const q = searchParams.get('q')
    if (q !== null) {
      setSearchQuery(q)
    }
    const area = searchParams.get('area')
    if (area !== null) {
      setSelectedArea(area)
    }
    if (searchParams.get('view') === 'services' || searchParams.get('filters') || searchParams.get('category')) {
      setFiltersOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    let isMounted = true

    fetchApprovedWorkers()
      .then(workers => {
        if (!isMounted) return
        setWorkerData(workers.map(worker => ({
          ...worker,
          category: worker.categories[0] || '',
        })))
      })
      .catch((err) => {
        console.warn('Error fetching workers:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoadingWorkers(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const filteredWorkers = useMemo(() => {
    let workers = [...workerData]
    // Only currently available approved providers can receive a quote request.
    workers = workers.filter(w => w.available)
    if (selectedCategory) {
      const childServices = getServicesByCategoryId(selectedCategory)
      const targetIds = new Set<string>([selectedCategory])
      childServices.forEach(s => targetIds.add(s.id))

      workers = workers.filter(w => targetIds.has(w.category) || (w.categories && w.categories.some((c: string) => targetIds.has(c))))
    }
    if (selectedArea) workers = workers.filter(w => w.areas.includes(selectedArea))
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      workers = workers.filter(w => {
        const matchesName = w.name.toLowerCase().includes(query)
        const matchesBio = (w.bio || '').toLowerCase().includes(query)
        const allCats = w.categories && w.categories.length > 0 ? w.categories : [w.category]
        const matchesCat = allCats.some((catId: string) => {
          const cObj = CATEGORIES.find((c: typeof CATEGORIES[0]) => c.id === catId)
          const nameEn = cObj?.name_en || catId
          const nameHi = cObj?.name_hi || catId
          return catId.toLowerCase().includes(query) || nameEn.toLowerCase().includes(query) || nameHi.toLowerCase().includes(query)
        })
        return matchesName || matchesBio || matchesCat
      })
    }
    return workers
  }, [workerData, selectedCategory, selectedArea, searchQuery])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params: Record<string, string> = {}
    if (searchQuery) params.q = searchQuery
    if (selectedCategory) params.category = selectedCategory
    if (selectedArea) params.area = selectedArea
    setSearchParams(params)
  }

  const clearFilters = () => { setSelectedCategory(''); setSelectedArea(''); setSearchQuery(''); setSearchParams({}) }
  const hasFilters = selectedCategory || selectedArea || searchQuery

  return (
    <div className="min-h-screen bg-semantic-bg-secondary">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-semantic-bg-primary border-b border-semantic-border-light sticky top-0 z-30"
      >
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-850 hover:bg-surface-800 text-xs font-semibold text-semantic-text-secondary hover:text-white border border-semantic-border-light transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
              <span>{t('common.backToHome', 'Back to Home')}</span>
            </Link>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-tertiary" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('home.searchPlaceholder')} className="pl-12" leftIcon={<SearchIcon className="w-5 h-5" />} />
            </div>
            <Button type="submit" variant="primary" className="whitespace-nowrap">
              <SearchIcon className="w-5 h-5 mr-2" /> {t('common.search')}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Button variant={filtersOpen ? 'primary' : 'secondary'} size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-2">
              <Filter className="w-4 h-4" /> {t('common.filter')}
            </Button>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center gap-2"><X className="w-4 h-4" /> {t('common.clear')}</Button>}
          </div>
        </div>

        <AnimatePresence>
          <FilterPanel filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedArea={selectedArea} setSelectedArea={setSelectedArea} t={t} categories={categories} serviceAreas={serviceAreas} i18n={i18n} />
        </AnimatePresence>
      </motion.div>

      <div className="container-app py-8">
        <SearchResults filteredWorkers={filteredWorkers} selectedCategory={selectedCategory} isLoadingWorkers={isLoadingWorkers} t={t} getCategoryName={getCategoryName} CATEGORIES={categories} iconComponents={iconComponents} EmptyState={EmptyState} WorkerGrid={WorkerGrid} i18n={i18n} quoteServiceRequestId={quoteServiceRequestId} />
      </div>
    </div>
  )
}

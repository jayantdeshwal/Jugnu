import { useEffect, useState, useMemo } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, Avatar, Badge, RatingStars, Chip, Input } from '@/ui'
import { getCategoryName } from '@kaamgar/shared'
import { usePublicCatalog } from '@/hooks/usePublicCatalog'
import { Search as SearchIcon, Filter, MapPin, Star, Clock, CheckCircle, Truck, X, ChevronDown, ArrowRight, Power } from 'lucide-react'
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

const MOCK_WORKERS: SearchWorker[] = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    category: 'electrician',
    experience: 12,
    rating: 4.8,
    reviews: 124,
    areas: ['251001', '251002'],
    bio: 'Licensed electrician with 12+ years experience. Specializes in home wiring, inverter installation, and electrical repairs.',
    avatar: null,
    verified: true,
    available: true,
  },
  {
    id: '2',
    name: 'Mohammad Ali',
    category: 'plumber',
    experience: 8,
    rating: 4.6,
    reviews: 89,
    areas: ['251001'],
    bio: 'Expert in pipe fitting, bathroom fittings, water tank installation, and drainage solutions.',
    avatar: null,
    verified: true,
    available: true,
  },
  {
    id: '3',
    name: 'Suresh Sharma',
    category: 'carpenter',
    experience: 15,
    rating: 4.9,
    reviews: 67,
    areas: ['251001', '251002'],
    bio: 'Custom furniture, modular kitchen, wardrobe installation, and wood repair specialist.',
    avatar: null,
    verified: true,
    available: false,
  },
  {
    id: '4',
    name: 'Ramesh Yadav',
    category: 'ac',
    experience: 10,
    rating: 4.7,
    reviews: 156,
    areas: ['251001', '251002'],
    bio: 'AC installation, repair, gas filling, and maintenance for all brands. Split & window AC expert.',
    avatar: null,
    verified: true,
    available: true,
  },
  {
    id: '5',
    name: 'Prem Singh',
    category: 'painter',
    experience: 7,
    rating: 4.5,
    reviews: 43,
    areas: ['251002'],
    bio: 'Interior & exterior painting, texture work, waterproofing, and wall repair services.',
    avatar: null,
    verified: false,
    available: true,
  },
  {
    id: '6',
    name: 'Vikram Singh',
    category: 'electrician',
    experience: 5,
    rating: 4.4,
    reviews: 28,
    areas: ['251001'],
    bio: 'Young electrician specializing in modern home automation, LED lighting, and smart switches.',
    avatar: null,
    verified: true,
    available: true,
  },
]

const iconComponents = {
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  snowflake: Snowflake,
  brush: Brush,
}

import { Zap, Wrench, Hammer, Snowflake, Brush } from 'lucide-react'

function FilterPanel({ filtersOpen, setFiltersOpen, selectedCategory, setSelectedCategory, selectedArea, setSelectedArea, sortBy, setSortBy, t, categories, serviceAreas }: any) {
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
                {getCategoryName(cat, t('common.language') === 'हिंदी' ? 'hi' : 'en')}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{t('common.area')}</label>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!selectedArea} onClick={() => setSelectedArea('')} variant="outline">
              All Areas
            </Chip>
            {serviceAreas.map((area: any) => (
              <Chip key={area.id} selected={selectedArea === area.pincode} onClick={() => setSelectedArea(selectedArea === area.pincode ? '' : area.pincode)} variant="outline">
                {area.locality} ({area.pincode})
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{t('common.sort')}</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'rating', label: t('common.rating') },
              { value: 'experience', label: t('common.experience') },
              { value: 'reviews', label: t('common.reviews') },
            ].map(({ value, label }) => (
              <Chip key={value} selected={sortBy === value} onClick={() => setSortBy(value as any)} variant="outline">
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ResultsHeader({ filteredWorkers, selectedCategory, t, getCategoryName, CATEGORIES }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-semantic-text-primary">{t('nav.search')}</h1>
          <p className="text-semantic-text-secondary mt-1">
            {filteredWorkers.length} {t('common.workersFound') || 'workers found'}
            {selectedCategory && ` - ${getCategoryName(CATEGORIES.find((c: typeof CATEGORIES[0]) => c.id === selectedCategory)!, 'en')}`}
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
      <h3 className="text-lg font-medium text-semantic-text-primary mb-2">No workers found</h3>
      <p className="text-semantic-text-secondary mb-6">Try adjusting your filters or search terms</p>
      <Button variant="outline" onClick={clearFilters}>{t('common.clear')} Filters</Button>
    </motion.div>
  )
}

function WorkerGrid({ filteredWorkers, t, iconComponents, CATEGORIES, getCategoryName }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ staggerChildren: 0.08 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredWorkers.map((worker: any, index: number) => {
        const cat = CATEGORIES.find((c: typeof CATEGORIES[0]) => c.id === worker.category)
        return (
          <motion.div key={worker.id} style={{ transitionDelay: `${index * 80}ms` }}>
            <Link to={`/worker/${worker.id}`} className="card-interactive group">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={worker.name} size="lg" src={worker.avatar} status={worker.available ? 'online' : 'busy'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-semantic-text-primary truncate">{worker.name}</h3>
                      {worker.verified && (
                        <Badge variant="brand" dot className="ml-2">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-semantic-text-secondary">
                      <span className="flex items-center gap-1">
                        {React.createElement(
                          iconComponents[worker.category as keyof typeof iconComponents] || Truck,
                          { className: 'w-4 h-4' }
                        )}
                        {cat ? getCategoryName(cat, 'en') : worker.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {t('workerCard.experience', { years: worker.experience })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <RatingStars rating={worker.rating} size="sm" showValue />
                      <span className="text-sm text-semantic-text-tertiary">({worker.reviews} Reviews)</span>
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
                        Available
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <Power className="w-4 h-4" />
                        Unavailable
                      </span>
                    )}
                  </span>
                  {worker.available ? (
                    <Button size="sm" variant="primary">Book Now <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  ) : (
                    <Button size="sm" variant="secondary" disabled className="opacity-60 cursor-not-allowed">
                      Unavailable
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

function SearchResults({ filteredWorkers, selectedCategory, t, getCategoryName, CATEGORIES, iconComponents, EmptyState, WorkerGrid }: any) {
  const cat = CATEGORIES.find((c: typeof CATEGORIES[0]) => c.id === selectedCategory)

  return (
    <>
      <ResultsHeader filteredWorkers={filteredWorkers} selectedCategory={selectedCategory} t={t} getCategoryName={getCategoryName} CATEGORIES={CATEGORIES} />
      {filteredWorkers.length === 0 ? (
        <EmptyState t={t} clearFilters={() => {}} />
      ) : (
        <WorkerGrid filteredWorkers={filteredWorkers} t={t} iconComponents={iconComponents} CATEGORIES={CATEGORIES} getCategoryName={getCategoryName} />
      )}
    </>
  )
}

export default function Search() {
  const { t } = useTranslation()
  const { categories, serviceAreas } = usePublicCatalog()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [selectedArea, setSelectedArea] = useState(searchParams.get('area') || '')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [sortBy, setSortBy] = useState<'rating' | 'experience' | 'reviews'>('rating')
  const [workerData, setWorkerData] = useState<SearchWorker[]>(MOCK_WORKERS)

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
      .catch(() => {
        // Keep the local demo workers visible until the public directory is configured.
      })

    return () => {
      isMounted = false
    }
  }, [])

  const filteredWorkers = useMemo(() => {
    let workers = [...workerData]
    if (selectedCategory) workers = workers.filter(w => w.category === selectedCategory)
    if (selectedArea) workers = workers.filter(w => w.areas.includes(selectedArea))
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      workers = workers.filter(w => w.name.toLowerCase().includes(query) || w.bio.toLowerCase().includes(query) || getCategoryName({ id: w.category, name_en: w.category, name_hi: w.category, icon: '', sort_order: 0 }, 'en').toLowerCase().includes(query))
    }
    workers.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating
        case 'experience': return b.experience - a.experience
        case 'reviews': return b.reviews - a.reviews
        default: return 0
      }
    })
    return workers
  }, [workerData, selectedCategory, selectedArea, searchQuery, sortBy])

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
          <FilterPanel filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedArea={selectedArea} setSelectedArea={setSelectedArea} sortBy={sortBy} setSortBy={setSortBy} t={t} categories={categories} serviceAreas={serviceAreas} />
        </AnimatePresence>
      </motion.div>

      <div className="container-app py-8">
        <SearchResults filteredWorkers={filteredWorkers} selectedCategory={selectedCategory} t={t} getCategoryName={getCategoryName} CATEGORIES={categories} iconComponents={iconComponents} EmptyState={EmptyState} WorkerGrid={WorkerGrid} />
      </div>
    </div>
  )
}
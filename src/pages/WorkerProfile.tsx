import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Button, Card, Avatar, Badge, RatingStars, Chip, Input, Tabs, TabList, Tab, TabPanel, Modal } from '@/ui'
import { CATEGORIES, getCategoryName } from '@kaamgar/shared'
import { Star, MapPin, Clock, CheckCircle, Truck, ArrowLeft, Phone, MessageCircle, Zap, Wrench, Hammer, Snowflake, Brush, Calendar, Shield, Award, TrendingUp, AlertCircle, Power } from 'lucide-react'
import { motion } from 'framer-motion'
import { fetchApprovedWorker } from '@/services/workers'
import { fetchWorkerReviews, ReviewItem } from '@/services/reviews'

const iconComponents = {
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  snowflake: Snowflake,
  brush: Brush,
}

const MOCK_WORKER = {
  id: '1',
  name: 'Rajesh Kumar',
  category: 'electrician',
  experience: 12,
  rating: 4.8,
  reviews: 124,
  areas: ['251001', '251002'],
  bio: 'Licensed electrician with 12+ years experience. Specializes in home wiring, inverter installation, and electrical repairs. Available for emergency services.',
  avatar: null,
  verified: true,
  available: true,
  phone: '+919876543210',
  services: ['Home Wiring', 'Inverter Installation', 'Fan/Light Installation', 'Switch Board Repair', 'MCB/DB Installation', 'Emergency Repairs'],
  completedJobs: 89,
  responseRate: 95,
  avgResponseTime: '15 min',
}

export default function WorkerProfile() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [worker, setWorker] = useState<any>(null)
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookingDraft, setBookingDraft] = useState({ date: '', time: '', pincode: '' })
  const [showContactNotice, setShowContactNotice] = useState(false)

  useEffect(() => {
    let isMounted = true

    if (!id) {
      setError('Worker profile not found')
      setIsLoading(false)
      setIsLoadingReviews(false)
      return
    }

    Promise.all([
      fetchApprovedWorker(id),
      fetchWorkerReviews(id),
    ])
      .then(([nextWorker, liveReviews]) => {
        if (!isMounted) return
        if (!nextWorker) {
          setError('Worker profile not found')
          return
        }
        setWorker({
          ...nextWorker,
          category: nextWorker.categories[0] || '',
          phone: null,
          services: [
            'Home Repairs',
            'Installation & Maintenance',
            'Emergency Inspection',
            'General Service',
          ],
          completedJobs: Math.max(nextWorker.reviews * 2, 12),
          responseRate: 96,
          avgResponseTime: '15 min',
        })
        setReviewsList(liveReviews)
      })
      .catch(() => {
        if (isMounted) setError('Unable to load worker profile')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
          setIsLoadingReviews(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [id])

  if (isLoading) {
    return <div className="min-h-screen bg-semantic-bg-secondary flex items-center justify-center text-semantic-text-secondary">Loading worker profile...</div>
  }

  if (error || !worker) {
    return (
      <div className="min-h-screen bg-semantic-bg-secondary flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-semibold text-semantic-text-primary">{error || 'Worker profile not found'}</h1>
          <Link to="/search" className="mt-5 inline-flex text-brand-500 hover:text-brand-400">Back to Search</Link>
        </Card>
      </div>
    )
  }

  const cat = CATEGORIES.find(c => c.id === worker.category)
  const Icon = iconComponents[worker.category as keyof typeof iconComponents] || Truck

  return (
    <div className="min-h-screen bg-semantic-bg-secondary">
      <div className="bg-semantic-bg-primary border-b border-semantic-border-light">
        <div className="container-app py-4">
          <Link to="/search" className="inline-flex items-center gap-2 text-semantic-text-secondary hover:text-semantic-text-primary text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
        </div>
      </div>

      <div className="container-app py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid lg:grid-cols-3 gap-8"
        >
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="card p-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="relative">
                  <Avatar name={worker.name} size="2xl" src={worker.avatar || undefined} status={worker.available ? 'online' : 'busy'} />
                  {worker.verified && (
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="brand" dot className="px-2 py-1">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl lg:text-3xl font-bold text-semantic-text-primary">{worker.name}</h1>
                  <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-semantic-text-secondary">
                    <span className="flex items-center gap-1">
                      <Icon className="w-4 h-4" />
                      {cat ? getCategoryName(cat, 'en') : worker.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {t('workerCard.experience', { years: worker.experience })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      <RatingStars rating={worker.rating} size="sm" showValue />
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
                    {worker.areas.map((area: string) => (
                      <Badge key={area} variant="outline" className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="flex-1 sm:flex-none group" onClick={() => navigate(`/booking/${worker.id}`)}>
                    <Truck className="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
                    {t('workerProfile.bookNow')}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setShowContactNotice(true)}>
                    <Phone className="w-5 h-5 mr-2" />
                    {t('common.call')}
                  </Button>
                </div>
              </div>
            </motion.div>

            <Tabs defaultValue="about" className="space-y-6">
              <TabList className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-lg" aria-label="Worker details">
                <Tab value="about" className="px-4 py-2 text-sm font-medium rounded-md transition-colors">{t('workerProfile.about')}</Tab>
                <Tab value="services" className="px-4 py-2 text-sm font-medium rounded-md transition-colors">{t('workerProfile.services')}</Tab>
                <Tab value="reviews" className="px-4 py-2 text-sm font-medium rounded-md transition-colors">{t('workerProfile.reviews')}</Tab>
              </TabList>

              <TabPanel value="about" className="animate-in">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-semantic-text-primary mb-4">{t('workerProfile.about')}</h2>
                  <p className="text-semantic-text-secondary whitespace-pre-line leading-relaxed">{worker.bio}</p>
                </Card>
              </TabPanel>

              <TabPanel value="services" className="animate-in">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-semantic-text-primary">{t('workerProfile.services')}</h2>
                    <Badge variant="brand">{worker.services.length} Services</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {worker.services.map((service: string) => (
                      <Chip key={service} variant="outline">{service}</Chip>
                    ))}
                  </div>
                </Card>
              </TabPanel>

              <TabPanel value="reviews" className="animate-in">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-semantic-text-primary">{t('workerProfile.reviews')}</h2>
                    <span className="text-sm text-semantic-text-tertiary">
                      {reviewsList.length} {reviewsList.length === 1 ? 'Review' : 'Reviews'}
                    </span>
                  </div>

                  {isLoadingReviews ? (
                    <div className="py-8 text-center text-semantic-text-secondary">Loading reviews...</div>
                  ) : reviewsList.length === 0 ? (
                    <div className="py-10 text-center">
                      <Star className="w-10 h-10 mx-auto text-semantic-text-tertiary/60 mb-3" />
                      <p className="text-semantic-text-primary font-medium">No reviews yet</p>
                      <p className="text-sm text-semantic-text-secondary mt-1 max-w-sm mx-auto">
                        Be the first customer to book and share your feedback for this worker!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviewsList.map((review, index) => (
                        <motion.div
                          key={review.id || index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-semantic-border-light pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Avatar name={review.customer_name} src={review.customer_avatar || undefined} size="sm" />
                              <div>
                                <p className="font-medium text-semantic-text-primary">{review.customer_name}</p>
                                <p className="text-xs text-semantic-text-tertiary">
                                  {new Date(review.created_at).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                            <RatingStars rating={review.rating} size="sm" />
                          </div>
                          {review.comment && (
                            <p className="text-semantic-text-secondary text-sm leading-relaxed mt-1">
                              {review.comment}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabPanel>
            </Tabs>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-semantic-text-primary">Book Service</h2>
                  <Badge variant={worker.available ? 'success' : 'warning'}>
                    {worker.available ? 'Available' : t('workerProfile.unavailable', 'Currently Unavailable')}
                  </Badge>
                </div>

                {!worker.available && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
                    <span>{t('booking.workerUnavailableWarning', 'This worker is currently unavailable/off-duty and cannot accept new bookings right now.')}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="label">{t('booking.selectDate')}</label>
                    <Input 
                      type="date" 
                      className="input" 
                      disabled={!worker.available}
                      min={new Date().toISOString().split('T')[0]} 
                      value={bookingDraft.date} 
                      onChange={e => setBookingDraft(prev => ({ ...prev, date: e.target.value }))} 
                      leftIcon={<Calendar className="w-5 h-5" />} 
                    />
                  </div>
                  <div>
                    <label className="label">{t('booking.selectTime')}</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-tertiary" />
                      <select 
                        disabled={!worker.available} 
                        className="input pl-10 disabled:opacity-60 disabled:cursor-not-allowed" 
                        value={bookingDraft.time} 
                        onChange={e => setBookingDraft(prev => ({ ...prev, time: e.target.value }))}
                      >
                        <option value="">{t('common.select')}</option>
                        <option value="9:00">9:00 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="14:00">2:00 PM</option>
                        <option value="16:00">4:00 PM</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('booking.pincode')}</label>
                    <Input 
                      type="text" 
                      disabled={!worker.available} 
                      placeholder="251001" 
                      maxLength={6} 
                      value={bookingDraft.pincode} 
                      onChange={e => setBookingDraft(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} 
                      className="input" 
                      leftIcon={<MapPin className="w-5 h-5" />} 
                    />
                  </div>
                  <Button 
                    variant={worker.available ? "primary" : "secondary"} 
                    className="w-full" 
                    size="lg" 
                    disabled={!worker.available}
                    onClick={() => navigate(`/booking/${worker.id}`, { state: { bookingDraft } })}
                  >
                    {worker.available ? t('booking.confirmBooking') : t('workerProfile.unavailable', 'Currently Unavailable')}
                  </Button>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="p-6 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-semantic-text-primary">Need Help?</h3>
                    <p className="text-sm text-semantic-text-secondary">Call us for assistance</p>
                  </div>
                </div>
                <Button variant="primary" className="w-full">
                  <Phone className="w-5 h-5 mr-2" />
                  Call Support
                </Button>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-brand-600" />
                  </div>
                  <p className="text-2xl font-bold text-semantic-text-primary">{worker.completedJobs}</p>
                  <p className="text-sm text-semantic-text-secondary">Completed Jobs</p>
                </Card>
                <Card className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-brand-600" />
                  </div>
                  <p className="text-2xl font-bold text-semantic-text-primary">{worker.responseRate}%</p>
                  <p className="text-sm text-semantic-text-secondary">Response Rate</p>
                </Card>
                <Card className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-brand-600" />
                  </div>
                  <p className="text-2xl font-bold text-semantic-text-primary">{worker.avgResponseTime}</p>
                  <p className="text-sm text-semantic-text-secondary">Avg Response</p>
                </Card>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Direct Contact Privacy Notice Modal */}
      <Modal
        isOpen={showContactNotice}
        onClose={() => setShowContactNotice(false)}
        title="Direct Contact & Booking"
        description="Worker privacy & verified connections"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-200/80 border border-semantic-border-light flex items-start gap-3 text-sm">
            <Shield className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
            <p className="text-semantic-text-secondary leading-relaxed">
              To protect local service professionals from unsolicited calls, direct phone numbers and WhatsApp links are provided immediately once a booking request is made.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => {
                setShowContactNotice(false)
                navigate(`/booking/${worker.id}`)
              }}
            >
              <Truck className="w-4 h-4" />
              <span>Book Service Now</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowContactNotice(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
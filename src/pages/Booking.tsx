import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button, Card, Modal, Avatar, Badge } from '@kaamgar/ui'
import { CATEGORIES, getCategoryName, getServiceById } from '@kaamgar/shared'
import { ArrowLeft, Calendar, Clock, MapPin, Check, AlertCircle, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { fetchApprovedWorker } from '@/services/workers'
import { getSupabaseClient } from '@/lib/supabase'
import { createBookingQuoteRequest, createServiceRequest } from '@/services/quotes'
import { attachProblemImage, removeProblemImage, uploadProblemImage, validateFile } from '@/services/storage'
import { sanitizeErrorMessage } from '@/utils/errors'

export default function Booking() {
  const { t, i18n } = useTranslation()
  const { workerId } = useParams<{ workerId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const existingServiceRequestId = location.state?.serviceRequestId as string | undefined
  const selectedServiceId = location.state?.serviceId as string | undefined
  const { user, isAuthenticated } = useAuth()
  const [worker, setWorker] = useState<any>(null)
  const [loadingWorker, setLoadingWorker] = useState(true)
  const cat = CATEGORIES.find(c => c.id === worker?.category)
  
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState(() => ({
    date: location.state?.bookingDraft?.date || '',
    time: location.state?.bookingDraft?.time || '',
    address: '',
    pincode: location.state?.bookingDraft?.pincode || '',
    notes: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [quoteRequested, setQuoteRequested] = useState(false)
  const [responseHours, setResponseHours] = useState('24')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [createdServiceRequestId, setCreatedServiceRequestId] = useState<string | null>(null)
  const [problemImage, setProblemImage] = useState<File | null>(null)
  const [problemImagePreview, setProblemImagePreview] = useState<string | null>(null)
  const [problemImagePath, setProblemImagePath] = useState<string | null>(null)
  const imagePickerRef = useRef<HTMLInputElement>(null)
  const cameraPickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!workerId) {
      setLoadingWorker(false)
      return
    }
    fetchApprovedWorker(workerId)
      .then(setWorker)
      .catch(() => setWorker(null))
      .finally(() => setLoadingWorker(false))
  }, [workerId])

  useEffect(() => {
    if (!existingServiceRequestId) return
    let isMounted = true
    ;(getSupabaseClient() as any)
      .from('service_requests')
      .select('scheduled_for, pincode, address, notes')
      .eq('id', existingServiceRequestId)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (!isMounted || error || !data) return
        const scheduled = new Date(data.scheduled_for)
        setFormData(prev => ({
          ...prev,
          date: scheduled.toISOString().slice(0, 10),
          time: scheduled.toTimeString().slice(0, 5),
          pincode: data.pincode,
          address: data.address,
          notes: data.notes || '',
        }))
      })
    return () => { isMounted = false }
  }, [existingServiceRequestId])

  useEffect(() => () => {
    if (problemImagePreview) URL.revokeObjectURL(problemImagePreview)
  }, [problemImagePreview])

  const handleProblemImage = (file: File | undefined) => {
    if (!file) return
    const validation = validateFile(file, { maxSizeMb: 8, allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] })
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, image: validation.error || t('booking.problemImageInvalid', 'Please choose a valid image.') }))
      return
    }
    if (problemImagePreview) URL.revokeObjectURL(problemImagePreview)
    setProblemImage(file)
    setProblemImagePreview(URL.createObjectURL(file))
    setProblemImagePath(null)
    setErrors(prev => ({ ...prev, image: '' }))
  }

  const clearProblemImage = () => {
    if (problemImagePreview) URL.revokeObjectURL(problemImagePreview)
    setProblemImage(null)
    setProblemImagePreview(null)
    setProblemImagePath(null)
    setErrors(prev => ({ ...prev, image: '' }))
  }
  
  const validateStep = () => {
    const newErrors: Record<string, string> = {}
    
    if (step === 1) {
      if (!formData.date) newErrors.date = t('errors.required')
      if (!formData.time) newErrors.time = t('errors.required')
    }
    
    if (step === 2) {
      if (!formData.address.trim()) newErrors.address = t('errors.required')
      if (!formData.pincode.trim()) newErrors.pincode = t('errors.required')
      else if (!/^\d{6}$/.test(formData.pincode)) newErrors.pincode = 'Enter valid 6-digit pincode'
      else if (worker && worker.areas?.length > 0 && !worker.areas.includes(formData.pincode)) {
        newErrors.pincode = t('booking.workerDoesNotCoverPincode', 'This worker does not serve the selected pincode.')
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep()) {
      setShowConfirm(true)
    }
  }
  
  const confirmBooking = async () => {
    if (!isAuthenticated || !user || !worker) {
      navigate('/login')
      return
    }

    setIsSubmitting(true)
    setBookingError('')
    setErrors({})

    try {
      const normalizedTime = formData.time.padStart(5, '0')
      const scheduledAt = new Date(`${formData.date}T${normalizedTime}:00`)

      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error('Please select a valid date and time')
      }

      if (worker.areas?.length > 0 && !worker.areas.includes(formData.pincode)) {
        throw new Error(t('booking.workerDoesNotCoverPincode', 'This worker does not serve the selected pincode.'))
      }

      const canonicalServiceId = selectedServiceId && getServiceById(selectedServiceId)?.id
      const serviceRequestId = existingServiceRequestId || createdServiceRequestId || await createServiceRequest({
        categoryId: canonicalServiceId || worker.categories[0],
        pincode: formData.pincode,
        scheduledFor: scheduledAt.toISOString(),
        address: formData.address,
        notes: formData.notes,
      })
      if (!existingServiceRequestId && !createdServiceRequestId) setCreatedServiceRequestId(serviceRequestId)

      if (problemImage && !problemImagePath) {
        const storagePath = await uploadProblemImage(problemImage, user.id, serviceRequestId)
        try {
          await attachProblemImage({
            serviceRequestId,
            customerId: user.id,
            storagePath,
            mimeType: problemImage.type,
            fileSize: problemImage.size,
          })
        } catch (attachmentError) {
          await removeProblemImage(storagePath)
          throw attachmentError
        }
        setProblemImagePath(storagePath)
      }
      const deadline = new Date(Date.now() + Number(responseHours) * 60 * 60 * 1000).toISOString()
      await createBookingQuoteRequest({
        serviceRequestId,
        workerId: worker.id,
        responseDeadlineAt: deadline,
      })

      setQuoteRequested(true)
      setShowConfirm(false)
    } catch (bookingError) {
      const rawMessage = bookingError && typeof bookingError === 'object' && 'message' in bookingError
        ? String((bookingError as { message?: unknown }).message || '')
        : ''
      const message = rawMessage.includes('ACTIVE_SERVICE_REQUEST_EXISTS')
        ? t('booking.activeServiceRequestExists', 'You already have an active request for this service. Please complete or cancel it before creating another one.')
        : sanitizeErrorMessage(bookingError, 'Unable to create booking. Please try again.')
      setBookingError(message)
      setShowConfirm(false)
      setErrors(prev => ({ ...prev, form: message }))
    } finally {
      setIsSubmitting(false)
    }
  }
  
  if (loadingWorker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-semantic-bg-primary text-semantic-text-secondary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-semantic-bg-primary">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-semantic-text-tertiary mb-4" />
          <h2 className="text-xl font-semibold text-semantic-text-primary mb-2">{t('errors.notFound', 'Worker not found')}</h2>
          <Link to="/search" className="text-brand-400 hover:underline">
            {t('common.back', 'Back')} / {t('nav.search', 'Find Workers')}
          </Link>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-semantic-bg-primary">
      <div className="bg-semantic-bg-secondary border-b border-semantic-border-light">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/search" className="inline-flex items-center gap-2 text-semantic-text-secondary hover:text-semantic-text-primary text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back', 'Back')} / {t('nav.search', 'Find Workers')}</span>
          </Link>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Avatar name={worker.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-semantic-text-primary">{worker.name}</h1>
                <Badge variant={worker.available ? 'success' : 'warning'}>
                  {worker.available ? t('workerCard.available', 'Available') : t('workerProfile.unavailable', 'Currently Unavailable')}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-semantic-text-secondary">
                <span className="flex items-center gap-1">
                  {cat && <span>{getCategoryName(cat, i18n.language === 'hi' ? 'hi' : 'en')}</span>}
                </span>
                <span className="flex items-center gap-1 text-yellow-400">
                  <span>★</span>
                  {worker.rating}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {quoteRequested ? (
          <div className="text-center py-12 bg-surface-100 border border-semantic-border-light rounded-xl p-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-semantic-text-primary mb-2">Quote Requested</h2>
            <p className="text-semantic-text-secondary mb-6">Your request was sent to {worker.name}. A booking will be created only after you accept the provider's quote.</p>
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => navigate('/bookings')}>
              View Quote Requests
            </Button>
          </div>
        ) : (
          <Card className="p-6 bg-surface-100 border border-semantic-border-light">
            {worker.available === false && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <h3 className="font-semibold text-sm">{t('workerProfile.unavailable', 'Currently Unavailable')}</h3>
                  <p className="text-xs text-amber-200/90 mt-1">
                    {t('booking.workerUnavailableWarning', 'This worker is currently unavailable/off-duty and cannot accept new bookings right now.')}
                  </p>
                </div>
              </div>
            )}
            {errors.form && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {errors.form}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-semantic-text-primary mb-4">{t('booking.title')}</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="label text-semantic-text-secondary">{t('booking.selectDate')}</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-tertiary pointer-events-none" />
                      <input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="input pl-10 bg-surface-200 border-semantic-border-light text-semantic-text-primary [color-scheme:dark]"
                      />
                    </div>
                    {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date}</p>}
                  </div>
                  <div>
                    <label className="label text-semantic-text-secondary">{t('booking.selectTime')}</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-tertiary pointer-events-none" />
                      <select
                        value={formData.time}
                        onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        className="input pl-10 bg-surface-200 border-semantic-border-light text-semantic-text-primary"
                      >
                        <option value="">{t('common.select')}</option>
                        <option value="09:00">9:00 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="12:00">12:00 PM</option>
                        <option value="14:00">2:00 PM</option>
                        <option value="15:00">3:00 PM</option>
                        <option value="16:00">4:00 PM</option>
                        <option value="17:00">5:00 PM</option>
                      </select>
                    </div>
                    {errors.time && <p className="mt-1 text-xs text-red-400">{errors.time}</p>}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="label text-semantic-text-secondary">{t('booking.enterAddress')}</label>
                  <textarea
                    value={formData.address}
                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder={t('booking.addressPlaceholder')}
                    rows={3}
                    className="input bg-surface-200 border-semantic-border-light text-semantic-text-primary placeholder:text-semantic-text-tertiary"
                  />
                  {errors.address && <p className="mt-1 text-xs text-red-400">{errors.address}</p>}
                </div>
                
                <div className="mb-4">
                  <label className="label text-semantic-text-secondary">{t('booking.pincode')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-tertiary pointer-events-none" />
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={e => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                      placeholder="251001"
                      maxLength={6}
                      className="input pl-10 bg-surface-200 border-semantic-border-light text-semantic-text-primary placeholder:text-semantic-text-tertiary"
                    />
                  </div>
                  {errors.pincode && <p className="mt-1 text-xs text-red-400">{errors.pincode}</p>}
                </div>
                
                <div className="mb-6">
                  <label className="label text-semantic-text-secondary">{t('booking.notesPlaceholder')}</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('booking.notesPlaceholder')}
                    rows={3}
                    className="input bg-surface-200 border-semantic-border-light text-semantic-text-primary placeholder:text-semantic-text-tertiary"
                  />
                </div>

                <div className="mb-6 rounded-xl border border-semantic-border-light bg-surface-200/40 p-4">
                  <p className="text-sm font-semibold text-semantic-text-primary">{t('booking.problemImageTitle', 'Add photo of the problem (optional)')}</p>
                  <p className="mt-1 text-xs text-semantic-text-secondary">{t('booking.problemImageHint', 'A clear photo can help the worker understand the issue before responding.')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input ref={cameraPickerRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => handleProblemImage(event.target.files?.[0])} />
                    <input ref={imagePickerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => handleProblemImage(event.target.files?.[0])} />
                    <Button type="button" variant="outline" size="sm" onClick={() => cameraPickerRef.current?.click()}>
                      {t('booking.takePhoto', 'Take Photo')}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => imagePickerRef.current?.click()}>
                      {t('booking.chooseImage', 'Choose Image')}
                    </Button>
                  </div>
                  {problemImagePreview && (
                    <div className="mt-4 flex items-start gap-3">
                      <img src={problemImagePreview} alt={t('booking.problemImagePreview', 'Selected problem')} className="h-24 w-24 rounded-xl object-cover border border-semantic-border-light" />
                      <div className="space-y-2">
                        <p className="text-xs text-semantic-text-secondary break-all">{problemImage?.name}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={clearProblemImage}>
                          {t('common.remove', 'Remove')}
                        </Button>
                      </div>
                    </div>
                  )}
                  {errors.image && <p className="mt-2 text-xs text-red-400">{errors.image}</p>}
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button variant="secondary" type="button" onClick={() => navigate(-1)} className="flex-1">
                  {t('common.cancel')}
                </Button>
                <Button 
                  variant="primary" 
                  type="submit" 
                  disabled={worker.available === false} 
                  className="flex-1"
                >
                  Request Quote
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
      
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={t('booking.confirmBooking')}
        description={t('booking.bookingConfirmDesc', { name: worker.name })}
      >
        <div className="space-y-4">
          {bookingError && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {bookingError}
            </div>
          )}
          <div className="flex items-center gap-3 p-4 bg-surface-200/80 border border-semantic-border-light rounded-lg">
            <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="font-medium text-semantic-text-primary">{t('booking.confirmTitle')}</p>
              <p className="text-xs text-semantic-text-secondary">{t('booking.confirmDesc')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm bg-surface-200/40 p-4 rounded-lg border border-semantic-border-light">
            <div>
              <p className="text-xs text-semantic-text-secondary">{t('booking.selectDate')}</p>
              <p className="font-medium text-semantic-text-primary mt-0.5">{formData.date}</p>
            </div>
            <div>
              <p className="text-xs text-semantic-text-secondary">{t('booking.selectTime')}</p>
              <p className="font-medium text-semantic-text-primary mt-0.5">{formData.time}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-semantic-text-secondary">{t('booking.pincode')}</p>
              <p className="font-medium text-semantic-text-primary mt-0.5">{formData.pincode}</p>
            </div>
          </div>

          <div>
            <label className="label text-semantic-text-secondary">Provider response deadline</label>
            <select
              value={responseHours}
              onChange={event => setResponseHours(event.target.value)}
              className="input w-full bg-surface-200 border-semantic-border-light text-semantic-text-primary"
            >
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={confirmBooking} loading={isSubmitting} className="flex-1">
              Request Quote
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

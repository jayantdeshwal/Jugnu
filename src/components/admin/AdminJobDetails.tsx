import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, IndianRupee, MapPin, Receipt, User, X } from 'lucide-react'
import { Badge, Button, Card, RatingStars } from '@kaamgar/ui'
import { formatJobReference, getCategoryName } from '@kaamgar/shared'
import {
  AdminJobDetails as AdminJobDetailsData,
  AdminJobDetailStatus,
  fetchAdminJobDetails,
} from '@/services/adminJobs'

interface AdminJobDetailsProps {
  bookingId: string
  onClose: () => void
}

const statusLabels: Record<AdminJobDetailStatus, { key: string; fallback: string }> = {
  pending: { key: 'admin.bookingStatus.pending', fallback: 'Pending' },
  accepted: { key: 'admin.bookingStatus.accepted', fallback: 'Accepted' },
  rejected: { key: 'admin.bookingStatus.rejected', fallback: 'Rejected' },
  in_progress: { key: 'admin.bookingStatus.inProgress', fallback: 'In Progress' },
  payment_pending: { key: 'admin.bookingStatus.paymentPending', fallback: 'Payment Pending' },
  completed: { key: 'admin.bookingStatus.completed', fallback: 'Completed' },
  cancelled: { key: 'admin.bookingStatus.cancelled', fallback: 'Cancelled' },
  disputed: { key: 'admin.bookingStatus.disputed', fallback: 'Disputed' },
}

function statusVariant(status: AdminJobDetailStatus): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'completed') return 'success'
  if (status === 'pending' || status === 'payment_pending') return 'warning'
  if (status === 'accepted' || status === 'in_progress') return 'info'
  return 'danger'
}

function dateTime(value: string | null | undefined, fallback = '—') {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : fallback
}

function money(amount: number | null | undefined, currency = 'INR') {
  return amount == null ? '—' : `${currency} ${amount.toFixed(2)}`
}

function valueLabel(value: string, t: (key: string, fallback: string) => string) {
  return t(`admin.jobDetails.statusValues.${value}`, value.replace(/_/g, ' '))
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</span>
      <span className="text-sm text-slate-900 dark:text-zinc-100 break-words">{value || '—'}</span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-4 bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-600 dark:text-amber-400">{icon}</span>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </Card>
  )
}

function DatasetMessage({ unavailable, empty, unavailableText, emptyText }: { unavailable: boolean; empty: boolean; unavailableText: string; emptyText: string }) {
  if (unavailable) return <p className="text-sm text-amber-700 dark:text-amber-300">{unavailableText}</p>
  if (empty) return <p className="text-sm text-slate-500 dark:text-zinc-400">{emptyText}</p>
  return null
}

export default function AdminJobDetails({ bookingId, onClose }: AdminJobDetailsProps) {
  const { t, i18n } = useTranslation()
  const [details, setDetails] = useState<AdminJobDetailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setDetails(null)
    fetchAdminJobDetails(bookingId)
      .then(data => {
        if (active) setDetails(data)
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : t('admin.jobDetails.loadError', 'Unable to load Job details'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [bookingId, t])

  const unavailable = (key: keyof NonNullable<AdminJobDetailsData['errors']>) => Boolean(details?.errors[key])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45">
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="w-full max-w-6xl rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
          <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">{t('admin.jobDetails.title', 'Job details')}</p>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatJobReference(bookingId as any)}</h2>
            </div>
            <Button variant="ghost" onClick={onClose} aria-label={t('admin.jobDetails.close', 'Close')} className="p-2">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {loading && <div className="p-10 text-center text-sm text-slate-500 dark:text-zinc-400">{t('admin.jobDetails.loading', 'Loading Job history...')}</div>}
          {!loading && error && (
            <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {!loading && details && (
            <div className="p-4 sm:p-6 space-y-4">
              <Card className="p-5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{t('admin.jobDetails.summary', 'Current state summary')}</p>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">{getCategoryName(details.category, i18n.language as any) || details.booking.category_id}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{formatJobReference(details.booking.id)}</p>
                  </div>
                  <Badge variant={statusVariant(details.booking.status)}>{t(statusLabels[details.booking.status].key, statusLabels[details.booking.status].fallback)}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                  <DetailRow label={t('admin.jobDetails.customer', 'Customer')} value={details.customer?.full_name || t('admin.jobDetails.unavailable', 'Information unavailable')} />
                  <DetailRow label={t('admin.jobDetails.worker', 'Worker')} value={details.worker?.full_name || t('admin.jobDetails.unavailable', 'Information unavailable')} />
                  <DetailRow label={t('admin.jobDetails.scheduled', 'Scheduled')} value={dateTime(details.booking.scheduled_at, t('admin.jobDetails.immediate', 'Immediate dispatch'))} />
                  <DetailRow
                    label={t('admin.jobDetails.amount', 'Amount')}
                    value={
                      details.paymentSummary
                        ? money(details.paymentSummary.final_payable_amount, details.paymentSummary.currency || 'INR')
                        : details.payment
                        ? money(details.payment.amount, details.payment.currency)
                        : money(details.quotes.find(q => q.status === 'accepted')?.amount)
                    }
                  />
                  <DetailRow label={t('admin.jobDetails.created', 'Created')} value={dateTime(details.booking.created_at)} />
                  <DetailRow label={t('admin.jobDetails.updated', 'Last updated')} value={dateTime(details.booking.updated_at)} />
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title={t('admin.jobDetails.customerSection', 'Customer')} icon={<User className="w-4 h-4" />}>
                  {unavailable('customer') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.customerUnavailable', 'Customer information unavailable')} emptyText="" /> : (
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label={t('admin.jobDetails.name', 'Name')} value={details.customer?.full_name || t('admin.jobDetails.unavailable', 'Information unavailable')} />
                      <DetailRow label={t('admin.jobDetails.phone', 'Phone')} value={details.customer?.phone || '—'} />
                      <DetailRow label={t('admin.jobDetails.bookingRelationship', 'Relationship')} value={t('admin.jobDetails.bookingCustomer', 'Booking customer')} />
                    </div>
                  )}
                </Section>
                <Section title={t('admin.jobDetails.workerSection', 'Worker')} icon={<User className="w-4 h-4" />}>
                  {unavailable('worker') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.workerUnavailable', 'Worker information unavailable')} emptyText="" /> : (
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label={t('admin.jobDetails.name', 'Name')} value={details.worker?.full_name || t('admin.jobDetails.unavailable', 'Information unavailable')} />
                      <DetailRow label={t('admin.jobDetails.phone', 'Phone')} value={details.worker?.phone || '—'} />
                      <DetailRow label={t('admin.jobDetails.approval', 'Approval')} value={details.worker?.approval_status || '—'} />
                      <DetailRow label={t('admin.jobDetails.bookingRelationship', 'Relationship')} value={t('admin.jobDetails.assignedWorker', 'Assigned worker')} />
                      <div className="col-span-2">
                        <DetailRow
                          label={t('admin.jobDetails.workerServices', 'Services / Categories')}
                          value={
                            details.worker?.categories && details.worker.categories.length > 0
                              ? details.worker.categories.map(c => getCategoryName(c, i18n.language as any)).join(', ')
                              : t('admin.jobDetails.noCategories', 'No categories assigned')
                          }
                        />
                      </div>
                    </div>
                  )}
                </Section>
              </div>

              <Section title={t('admin.jobDetails.sourceRequest', 'Original service request')} icon={<FileText className="w-4 h-4" />}>
                {unavailable('serviceRequest') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.sourceUnavailable', 'Source request unavailable')} emptyText="" /> : !details.serviceRequest ? <DatasetMessage unavailable={false} empty unavailableText="" emptyText={t('admin.jobDetails.sourceUnavailable', 'Source request unavailable')} /> : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <DetailRow label={t('admin.jobDetails.requestId', 'Request ID')} value={details.serviceRequest.id} />
                      <DetailRow label={t('admin.jobDetails.requestStatus', 'Request status')} value={valueLabel(details.serviceRequest.status, t)} />
                      <DetailRow label={t('admin.jobDetails.area', 'Area / pincode')} value={`${details.serviceRequest.pincode}`} />
                      <DetailRow label={t('admin.jobDetails.requestedFor', 'Requested for')} value={dateTime(details.serviceRequest.scheduled_for)} />
                      <DetailRow label={t('admin.jobDetails.created', 'Created')} value={dateTime(details.serviceRequest.created_at)} />
                    </div>
                    <div><p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-500">{t('admin.jobDetails.description', 'Description / notes')}</p><p className="text-sm text-slate-900 dark:text-zinc-100 mt-1 whitespace-pre-wrap">{details.serviceRequest.notes || '—'}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-500">{t('admin.jobDetails.address', 'Address')}</p><p className="text-sm text-slate-900 dark:text-zinc-100 mt-1 flex gap-1"><MapPin className="w-4 h-4 shrink-0 text-amber-500" />{details.serviceRequest.address}</p></div>
                    {details.serviceRequest.attachments.length > 0 && <div className="flex flex-wrap gap-2">{details.serviceRequest.attachments.map(attachment => attachment.signed_url ? <a key={attachment.id} href={attachment.signed_url} target="_blank" rel="noreferrer" className="text-xs text-amber-700 dark:text-amber-300 underline">{t('admin.jobDetails.viewAttachment', 'View attachment')}</a> : null)}</div>}
                  </div>
                )}
              </Section>

              <Section title={t('admin.jobDetails.quoteHistory', 'Quote history')} icon={<Clock className="w-4 h-4" />}>
                {unavailable('quotes') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.quotesUnavailable', 'Quote history unavailable')} emptyText="" /> : <>
                  <DatasetMessage unavailable={false} empty={details.quotes.length === 0 && details.quoteRequests.length === 0} unavailableText="" emptyText={t('admin.jobDetails.noQuotes', 'No quote history')} />
                  <div className="space-y-2">{details.quoteRequests.map(request => { const quote = details.quotes.find(item => item.quote_request_id === request.id); return <div key={request.id} className="rounded-xl border border-slate-200 dark:border-zinc-700 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{quote ? money(quote.amount) : t('admin.jobDetails.noQuoteSubmitted', 'No quote submitted')}</span><div className="flex gap-2"><Badge variant={quote?.status === 'accepted' ? 'success' : 'outline'}>{valueLabel(quote?.status || request.status, t)}</Badge>{quote?.status === 'accepted' && <Badge variant="success">{t('admin.jobDetails.acceptedQuote', 'Accepted quote')}</Badge>}</div></div><p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{t('admin.jobDetails.requested', 'Requested')} {dateTime(request.created_at || request.requested_at)}{quote?.details ? ` · ${quote.details}` : ''}</p></div> })}</div>
                  {details.quotes.filter(quote => !details.quoteRequests.some(request => request.id === quote.quote_request_id)).map(quote => <div key={quote.id} className="rounded-xl border border-slate-200 dark:border-zinc-700 p-3"><span className="text-sm font-semibold">{money(quote.amount)}</span> <Badge variant={quote.status === 'accepted' ? 'success' : 'outline'}>{valueLabel(quote.status, t)}</Badge></div>)}
                </>}
              </Section>

              <Section title={t('admin.jobDetails.additionalCharges', 'Additional charges')} icon={<IndianRupee className="w-4 h-4" />}>
                {unavailable('changeRequests') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.chargesUnavailable', 'Additional-charge history unavailable')} emptyText="" /> : <>
                  <DatasetMessage unavailable={false} empty={details.changeRequests.length === 0} unavailableText="" emptyText={t('admin.jobDetails.noCharges', 'No additional charges')} />
                  <div className="space-y-2">{details.changeRequests.map(change => <div key={change.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 p-3"><div><p className="text-sm font-semibold">{money(change.amount)}</p><p className="text-xs text-slate-500 dark:text-zinc-400">{change.reason}</p></div><div className="text-right"><Badge variant={change.status === 'approved' ? 'success' : change.status === 'pending' ? 'warning' : 'danger'}>{valueLabel(change.status, t)}</Badge><p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{dateTime(change.decided_at || change.created_at)}</p></div></div>)}</div>
                  <div className="mt-3 text-xs text-slate-600 dark:text-zinc-400">{t('admin.jobDetails.approvedTotal', 'Approved additions')}: {money(details.changeRequests.filter(change => change.status === 'approved').reduce((sum, change) => sum + change.amount, 0))}</div>
                </>}
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title={t('admin.jobDetails.payment', 'Payment')} icon={<IndianRupee className="w-4 h-4" />}>
                  {unavailable('payment') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.paymentUnavailable', 'Payment details unavailable')} emptyText="" /> : !details.payment ? <DatasetMessage unavailable={false} empty unavailableText="" emptyText={t('admin.jobDetails.paymentNotCreated', 'Payment not created yet')} /> : <div className="grid grid-cols-2 gap-4"><DetailRow label={t('admin.jobDetails.status', 'Status')} value={valueLabel(details.payment.status, t)} /><DetailRow label={t('admin.jobDetails.amount', 'Amount')} value={money(details.payment.amount, details.payment.currency)} /><DetailRow label={t('admin.jobDetails.method', 'Method')} value={valueLabel(details.payment.payment_method || '—', t)} /><DetailRow label={t('admin.jobDetails.customerConfirmed', 'Customer confirmed')} value={dateTime(details.payment.customer_confirmed_at)} /><DetailRow label={t('admin.jobDetails.workerConfirmed', 'Worker confirmed')} value={dateTime(details.payment.worker_confirmed_at)} /><DetailRow label={t('admin.jobDetails.paidAt', 'Paid at')} value={dateTime(details.payment.paid_at)} /></div>}
                </Section>
                <Section title={t('admin.jobDetails.receipt', 'Receipt')} icon={<Receipt className="w-4 h-4" />}>
                  {unavailable('receipt') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.receiptUnavailable', 'Receipt details unavailable')} emptyText="" /> : !details.receipt ? <DatasetMessage unavailable={false} empty unavailableText="" emptyText={t('admin.jobDetails.receiptNotGenerated', 'Receipt not generated')} /> : <div className="grid grid-cols-2 gap-4"><DetailRow label={t('admin.jobDetails.receiptNumber', 'Receipt number')} value={details.receipt.receipt_number} /><DetailRow label={t('admin.jobDetails.paymentReference', 'Payment reference')} value={details.receipt.payment_id} /><DetailRow label={t('admin.jobDetails.amount', 'Amount')} value={money(details.receipt.amount, details.receipt.currency)} /><DetailRow label={t('admin.jobDetails.method', 'Method')} value={valueLabel(details.receipt.payment_method, t)} /><DetailRow label={t('admin.jobDetails.paidAt', 'Paid at')} value={dateTime(details.receipt.paid_at)} /><DetailRow label={t('admin.jobDetails.created', 'Created')} value={dateTime(details.receipt.created_at)} /></div>}
                </Section>
              </div>

              <Section title={t('admin.jobDetails.review', 'Review')} icon={<CheckCircle className="w-4 h-4" />}>
                {unavailable('review') ? <DatasetMessage unavailable empty={false} unavailableText={t('admin.jobDetails.reviewUnavailable', 'Review details unavailable')} emptyText="" /> : !details.review ? <DatasetMessage unavailable={false} empty unavailableText="" emptyText={t('admin.jobDetails.noReview', 'No review yet')} /> : <div className="space-y-2"><RatingStars rating={details.review.rating} showValue /><p className="text-sm text-slate-900 dark:text-zinc-100">{details.review.comment || '—'}</p><p className="text-xs text-slate-500 dark:text-zinc-400">{dateTime(details.review.created_at)}</p></div>}
              </Section>

              <Section title={t('admin.jobDetails.timeline', 'Job timeline')} icon={<Calendar className="w-4 h-4" />}>
                {details.timeline.length === 0 ? <p className="text-sm text-slate-500 dark:text-zinc-400">{t('admin.jobDetails.noTimeline', 'No authoritative timeline events available')}</p> : <div className="space-y-3">{details.timeline.map(event => <div key={event.key} className="flex gap-3 items-start"><span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 shrink-0" /><div><p className="text-sm text-slate-900 dark:text-zinc-100">{t(`admin.jobDetails.events.${event.translationKey || event.key}`, event.label)}</p><p className="text-xs text-slate-500 dark:text-zinc-400">{dateTime(event.timestamp)}</p></div></div>)}</div>}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

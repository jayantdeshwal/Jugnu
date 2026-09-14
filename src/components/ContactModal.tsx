import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Avatar, Badge } from '@kaamgar/ui'
import { Phone, MessageSquare, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react'
import { formatPhoneDisplay, getTelUrl, getWhatsAppUrl } from '@/utils/contact'

export interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  name: string
  roleLabel?: string
  phone?: string | null
  avatar?: string | null
  whatsappMessage?: string
  bookingContext?: {
    category?: string
    scheduledAt?: string
    address?: string
  }
}

export default function ContactModal({
  isOpen,
  onClose,
  name,
  roleLabel = 'Contact',
  phone,
  avatar,
  whatsappMessage,
  bookingContext,
}: ContactModalProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!phone) return
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API is restricted
      const input = document.createElement('input')
      input.value = phone
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const telUrl = getTelUrl(phone)
  const waUrl = getWhatsAppUrl(phone, whatsappMessage)
  const displayPhone = formatPhoneDisplay(phone)

  const displayRoleLabel =
    roleLabel === 'Customer'
      ? t('bookings.customer', 'Customer')
      : roleLabel === 'Service Professional'
      ? t('bookings.serviceProfessional', 'Service Professional')
      : roleLabel === 'Contact'
      ? t('common.contact', 'Contact')
      : roleLabel

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('contactModal.title', 'Contact Details')}
      description={t('contactModal.subtitle', 'Direct phone and WhatsApp communication')}
      size="md"
    >
      <div className="space-y-5">
        {/* Contact Info Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-200/80 border border-semantic-border-light">
          <Avatar name={name} src={avatar || undefined} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-semantic-text-primary truncate">{name}</h3>
              {displayRoleLabel && (
                <Badge variant="info" size="sm">
                  {displayRoleLabel}
                </Badge>
              )}
            </div>
            {phone ? (
              <p className="mt-1 text-sm font-semibold text-brand-400 font-mono tracking-wide">
                {displayPhone}
              </p>
            ) : (
              <p className="mt-1 text-xs text-semantic-text-secondary">{t('contactModal.noPhone', 'Phone number not registered')}</p>
            )}
          </div>
        </div>

        {/* Booking Reference Context (if provided) */}
        {bookingContext && (
          <div className="p-3 rounded-lg bg-surface-100 border border-semantic-border-light text-xs text-semantic-text-secondary space-y-1">
            {bookingContext.category && (
              <p>
                <span className="font-semibold text-semantic-text-primary">{t('contactModal.service', 'Service')}:</span>{' '}
                {bookingContext.category}
              </p>
            )}
            {bookingContext.scheduledAt && (
              <p>
                <span className="font-semibold text-semantic-text-primary">{t('contactModal.schedule', 'Schedule')}:</span>{' '}
                {bookingContext.scheduledAt}
              </p>
            )}
            {bookingContext.address && (
              <p className="truncate">
                <span className="font-semibold text-semantic-text-primary">{t('contactModal.address', 'Address')}:</span>{' '}
                {bookingContext.address}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {phone ? (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Call Button */}
              <a
                href={telUrl}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
              >
                <Phone className="w-4 h-4" />
                <span>{t('contactModal.callNow', 'Call Now')}</span>
              </a>

              {/* WhatsApp Button */}
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-500 text-surface-950 font-bold transition-colors shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('contactModal.chatWhatsApp', 'WhatsApp')}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>

            {/* Copy Phone Number */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 border-semantic-border-medium hover:bg-surface-200 text-semantic-text-primary"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">{t('contactModal.numberCopied', 'Number Copied!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-semantic-text-secondary" />
                  <span>{t('contactModal.copyNumber', 'Copy Phone Number')}</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t('contactModal.noPhone', 'Phone number not registered')}</p>
              <p className="text-xs text-amber-400/90 mt-1">
                {t('contactModal.unableToContact', 'Phone number is not available for direct calling.')}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

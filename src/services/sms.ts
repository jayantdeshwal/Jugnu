/**
 * Client SMS Notification Dispatcher
 * Calls the Supabase Edge Function 'send-booking-sms' to trigger transactional SMS.
 */

import { getSupabaseClient } from '@/lib/supabase'

export interface BookingCreatedSmsParams {
  workerPhone?: string
  workerId?: string
  workerName: string
  customerName: string
  serviceCategory: string
  scheduledAt: string
  bookingId?: string
}

export interface BookingAcceptedSmsParams {
  customerPhone: string
  customerName?: string
  workerName: string
  workerPhone: string
  serviceCategory: string
  scheduledAt: string
  bookingId?: string
}

export async function sendBookingCreatedSms(params: BookingCreatedSmsParams): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke('send-booking-sms', {
      body: {
        event: 'booking_created',
        recipient_phone: params.workerPhone || undefined,
        worker_id: params.workerId || undefined,
        recipient_name: params.workerName,
        worker_name: params.workerName,
        customer_name: params.customerName,
        service_category: params.serviceCategory,
        scheduled_at: params.scheduledAt,
        booking_id: params.bookingId,
      },
    })

    if (error) {
      console.warn('[sendBookingCreatedSms] Edge function returned notice:', error.message)
      return false
    }

    console.log('[sendBookingCreatedSms] SMS triggered:', data)
    return true
  } catch (err) {
    // Non-blocking: fail silently if edge function is offline/not deployed
    console.warn('[sendBookingCreatedSms] Failed to dispatch SMS:', err)
    return false
  }
}

export async function sendBookingAcceptedSms(params: BookingAcceptedSmsParams): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke('send-booking-sms', {
      body: {
        event: 'booking_accepted',
        recipient_phone: params.customerPhone,
        recipient_name: params.workerName,
        worker_name: params.workerName,
        service_category: params.serviceCategory,
        scheduled_at: params.scheduledAt,
        booking_id: params.bookingId,
      },
    })

    if (error) {
      console.warn('[sendBookingAcceptedSms] Edge function returned notice:', error.message)
      return false
    }

    console.log('[sendBookingAcceptedSms] SMS triggered:', data)
    return true
  } catch (err) {
    console.warn('[sendBookingAcceptedSms] Failed to dispatch SMS:', err)
    return false
  }
}

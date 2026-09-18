/**
 * Client SMS Notification Dispatcher
 * Calls the Supabase Edge Function 'send-booking-sms' to trigger transactional SMS.
 * The Edge Function validates caller JWT and authoritatively resolves recipient phone from DB.
 */

import { getSupabaseClient } from '@/lib/supabase'

export interface BookingCreatedSmsParams {
  bookingId?: string
  workerId?: string
  workerPhone?: string
  workerName?: string
  customerName?: string
  serviceCategory?: string
  scheduledAt?: string
}

export interface BookingAcceptedSmsParams {
  bookingId?: string
  customerPhone?: string
  customerName?: string
  workerName?: string
  workerPhone?: string
  serviceCategory?: string
  scheduledAt?: string
}

export async function sendBookingCreatedSms(params: BookingCreatedSmsParams): Promise<boolean> {
  if (!params.bookingId) {
    console.warn('[sendBookingCreatedSms] Server-authoritative SMS requires valid bookingId')
    return false
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke('send-booking-sms', {
      body: {
        event: 'booking_created',
        booking_id: params.bookingId,
      },
    })

    if (error) {
      console.warn('[sendBookingCreatedSms] Edge function notice:', error.message)
      return false
    }

    console.log('[sendBookingCreatedSms] SMS dispatched:', data)
    return true
  } catch (err) {
    // Non-blocking: fail silently if edge function is offline/not configured
    console.warn('[sendBookingCreatedSms] Failed to dispatch SMS:', err)
    return false
  }
}

export async function sendBookingAcceptedSms(params: BookingAcceptedSmsParams): Promise<boolean> {
  if (!params.bookingId) {
    console.warn('[sendBookingAcceptedSms] Server-authoritative SMS requires valid bookingId')
    return false
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke('send-booking-sms', {
      body: {
        event: 'booking_accepted',
        booking_id: params.bookingId,
      },
    })

    if (error) {
      console.warn('[sendBookingAcceptedSms] Edge function notice:', error.message)
      return false
    }

    console.log('[sendBookingAcceptedSms] SMS dispatched:', data)
    return true
  } catch (err) {
    console.warn('[sendBookingAcceptedSms] Failed to dispatch SMS:', err)
    return false
  }
}

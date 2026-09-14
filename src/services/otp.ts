/**
 * MSG91 OTP Widget Integration Service
 * Manages script loading, polling for initialization, and triggering the SendOTP / Verify widget.
 */

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void
    msg91OtpConfig?: Record<string, unknown>
    libLoaded?: boolean
  }
}

const MSG91_WIDGET_ID =
  import.meta.env.VITE_MSG91_WIDGET_ID || '36696b6b4232313630363837'
const MSG91_TOKEN_AUTH =
  import.meta.env.VITE_MSG91_TOKEN_AUTH || '569945Tz82Zg5V6aa3e785P1'

const PRIMARY_CDN = 'https://verify.msg91.com/otp-provider.js'
const BACKUP_CDN = 'https://verify.phone91.com/otp-provider.js'

let scriptLoadingPromise: Promise<boolean> | null = null

/**
 * Actively polls window.initSendOTP every 50ms up to timeoutMs.
 * Ensures we don't fail just because the bundle takes a few ticks to parse.
 */
function waitForInitSendOTP(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (typeof window.initSendOTP === 'function') return Promise.resolve(true)

  const startTime = Date.now()
  return new Promise<boolean>((resolve) => {
    const interval = setInterval(() => {
      if (typeof window.initSendOTP === 'function') {
        clearInterval(interval)
        resolve(true)
      } else if (Date.now() - startTime >= timeoutMs) {
        clearInterval(interval)
        resolve(false)
      }
    }, 50)
  })
}

/**
 * Loads the MSG91 OTP Provider script and ensures window.initSendOTP is ready.
 */
export async function loadMsg91Script(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // 1. Check if already ready
  if (typeof window.initSendOTP === 'function') return true

  // 2. Poll briefly if script was preloaded in index.html
  const preloadedReady = await waitForInitSendOTP(800)
  if (preloadedReady) return true

  // 3. Avoid duplicate injection
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = (async () => {
    try {
      // Check if tag exists already
      let scriptTag = document.querySelector<HTMLScriptElement>(
        `script[src="${PRIMARY_CDN}"], script[src="${BACKUP_CDN}"]`
      )

      if (!scriptTag) {
        scriptTag = document.createElement('script')
        scriptTag.src = PRIMARY_CDN
        scriptTag.async = true
        scriptTag.onerror = () => {
          console.warn('[MSG91] Primary CDN failed, attempting secondary CDN...')
          if (scriptTag) {
            scriptTag.src = BACKUP_CDN
          }
        }
        document.head.appendChild(scriptTag)
      }

      // Wait up to 4 seconds for window.initSendOTP to become ready
      const ready = await waitForInitSendOTP(4000)
      if (ready) {
        console.log('[MSG91] OTP Provider SDK successfully loaded and initialized.')
        return true
      }

      console.warn(
        '[MSG91] Script did not expose initSendOTP within timeout. Possible adblocker or network restriction.'
      )
      return false
    } catch (err) {
      console.error('[MSG91] Unexpected error loading script:', err)
      return false
    } finally {
      // Do not permanently cache failure so future user clicks can retry
      scriptLoadingPromise = null
    }
  })()

  return scriptLoadingPromise
}

export interface OtpWidgetOptions {
  identifier?: string // 10-digit mobile number
  onSuccess: (data: unknown) => void
  onFailure: (error: unknown) => void
}

/**
 * Triggers the MSG91 OTP Widget modal.
 */
export async function openOtpWidget(options: OtpWidgetOptions): Promise<boolean> {
  const isLoaded = await loadMsg91Script()

  // Format identifier: 10-digit Indian phone number => '919876543210'
  // Inside MSG91 SDK, it prepends '+' if not present, creating '+919876543210'
  let cleanPhone = options.identifier ? options.identifier.replace(/\D/g, '') : ''
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`
  }

  if (isLoaded && typeof window.initSendOTP === 'function') {
    try {
      const configuration = {
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        identifier: cleanPhone || undefined,
        exposeMethods: false,
        success: (data: unknown) => {
          console.log('[MSG91 OTP Success]', data)
          options.onSuccess(data)
        },
        failure: (error: unknown) => {
          console.warn('[MSG91 OTP Failure]', error)
          options.onFailure(error)
        },
      }

      console.log('[MSG91] Initializing OTP widget with identifier:', cleanPhone)
      window.initSendOTP(configuration)
      return true
    } catch (err) {
      console.error('[MSG91] Error invoking initSendOTP:', err)
      options.onFailure(err)
      return false
    }
  }

  console.warn('[MSG91] SDK unavailable (verify.msg91.com may be blocked by adblock/shields or offline).')
  return false
}

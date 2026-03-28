declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: MidtransSnapOptions) => void
      embed: (token: string, options?: MidtransSnapOptions) => void
    }
  }
}

export type MidtransSnapOptions = {
  onSuccess?: (result: unknown) => void
  onPending?: (result: unknown) => void
  onError?: (result: unknown) => void
  onClose?: () => void
}

const SNAP_SCRIPT_ID = 'midtrans-snap-script'

export function loadMidtransScript(clientKey: string, isProduction = false): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(SNAP_SCRIPT_ID)) {
      if (window.snap) {
        resolve()
      } else {
        const check = setInterval(() => {
          if (window.snap) {
            clearInterval(check)
            resolve()
          }
        }, 100)
        setTimeout(() => {
          clearInterval(check)
          reject(new Error('Snap script timeout'))
        }, 5000)
      }
      return
    }

    const script = document.createElement('script')
    script.id = SNAP_SCRIPT_ID
    script.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'
    script.setAttribute('data-client-key', clientKey)
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Midtrans Snap'))
    document.body.appendChild(script)
  })
}

export function openSnapPayment(
  token: string,
  options?: MidtransSnapOptions
): void {
  if (!window.snap) {
    throw new Error('Midtrans Snap belum dimuat')
  }
  window.snap.pay(token, options)
}

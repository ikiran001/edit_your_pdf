/**
 * Optional public URL for tips/donations (e.g. Razorpay Payment Link: https://razorpay.me/@yourhandle).
 * Set `VITE_SUPPORT_PAYMENT_URL` at build time. Empty → support block is hidden.
 */
export function getSupportPaymentUrl() {
  const raw = import.meta.env.VITE_SUPPORT_PAYMENT_URL
  if (typeof raw !== 'string') return ''
  const s = raw.trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    return u.href
  } catch {
    return ''
  }
}

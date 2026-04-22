import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useSubscription } from './SubscriptionContext.jsx'
import {
  createRazorpayOrderRequest,
  verifyRazorpayPaymentRequest,
} from '../lib/subscriptionApi.js'

function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout.'))
    document.body.appendChild(s)
  })
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   initialPlan?: 'monthly' | 'yearly',
 *   onPaid?: () => void,
 * }} props
 */
export default function UpgradePlanModal({ open, onClose, initialPlan = 'monthly', onPaid }) {
  const { getFreshIdToken } = useAuth()
  const { razorpayKeyId, checkoutConfigured, refresh } = useSubscription()
  const [plan, setPlan] = useState(initialPlan)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!open) return
    setPlan(initialPlan)
    if (!checkoutConfigured || !razorpayKeyId) {
      setMessage(
        'Payments are not enabled on the API yet. In your server dashboard (e.g. Render), add environment variables RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from the Razorpay dashboard, save, and restart the service. Then reload this page.'
      )
    } else {
      setMessage(null)
    }
  }, [open, initialPlan, checkoutConfigured, razorpayKeyId])

  const runCheckout = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      if (!checkoutConfigured || !razorpayKeyId) {
        setMessage('Payments are not configured on the server yet. Please try again later.')
        return
      }
      await loadRazorpayScript()
      const orderRes = await createRazorpayOrderRequest(getFreshIdToken, plan)
      if (!orderRes.ok || !orderRes.data?.orderId) {
        setMessage(orderRes.data?.message || orderRes.data?.error || 'Could not start checkout.')
        return
      }
      const { orderId, keyId } = orderRes.data
      const key = keyId || razorpayKeyId
      const opts = {
        key,
        order_id: orderId,
        name: 'pdfpilot Pro',
        description: plan === 'yearly' ? 'Pro — Yearly (₹999)' : 'Pro — Monthly (₹99)',
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => {
            /* user closed — not an error */
          },
        },
        handler: (response) => {
          void (async () => {
            setBusy(true)
            setMessage(null)
            try {
              const v = await verifyRazorpayPaymentRequest(getFreshIdToken, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan,
              })
              if (!v.ok) {
                setMessage(v.data?.message || v.data?.error || 'Payment verification failed.')
                return
              }
              await refresh()
              onPaid?.()
              onClose()
            } catch (e) {
              setMessage(e?.message || 'Verification failed.')
            } finally {
              setBusy(false)
            }
          })()
        },
      }
      const rz = new window.Razorpay(opts)
      rz.on('payment.failed', (ev) => {
        const desc = ev?.error?.description || ev?.error?.reason || 'Payment failed.'
        setMessage(String(desc))
        setBusy(false)
      })
      rz.open()
    } catch (e) {
      setMessage(e?.message || 'Checkout could not start.')
    } finally {
      setBusy(false)
    }
  }, [
    checkoutConfigured,
    getFreshIdToken,
    onClose,
    onPaid,
    plan,
    razorpayKeyId,
    refresh,
  ])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eyp-upgrade-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          className="fx-focus-ring absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => {
            if (!busy) onClose()
          }}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="eyp-upgrade-title" className="pr-10 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Upgrade to Pro
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Free accounts can download up to <strong>3 PDFs per day</strong> (UTC midnight reset). Pro
          includes <strong>unlimited</strong> downloads from the editor and Saved PDFs.
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Billing is <strong>manual renewal</strong>: there is no automatic card charge. Buy again
          before expiry to stay on Pro.
        </p>
        <div className="mt-4 grid gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-600">
            <input
              type="radio"
              name="eyp-plan"
              checked={plan === 'monthly'}
              onChange={() => setPlan('monthly')}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">₹99 / month</span>
              <span className="mt-0.5 block text-xs text-zinc-500">30 days from purchase</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-600">
            <input
              type="radio"
              name="eyp-plan"
              checked={plan === 'yearly'}
              onChange={() => setPlan('yearly')}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">₹999 / year</span>
              <span className="mt-0.5 block text-xs text-zinc-500">365 days — best value</span>
            </span>
          </label>
        </div>
        {message ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {message}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="fx-focus-ring rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            onClick={() => void runCheckout()}
          >
            {busy ? 'Please wait…' : 'Pay with Razorpay'}
          </button>
          <button
            type="button"
            disabled={busy}
            className="fx-focus-ring rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={onClose}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

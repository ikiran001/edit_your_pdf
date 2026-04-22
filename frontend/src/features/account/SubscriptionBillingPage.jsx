import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { useSubscription } from '../../subscription/SubscriptionContext.jsx'
import UpgradePlanModal from '../../subscription/UpgradePlanModal.jsx'
import { cancelSubscriptionRequest } from '../../lib/subscriptionApi.js'

function formatInrFromPaise(paise) {
  const n = Number(paise)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n / 100)
  } catch {
    return `₹${(n / 100).toFixed(2)}`
  }
}

function formatIso(value) {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

export default function SubscriptionBillingPage() {
  const { getFreshIdToken } = useAuth()
  const { me, loading, error, refresh, checkoutConfigured } = useSubscription()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelMsg, setCancelMsg] = useState(null)

  const sub = me?.subscription
  const daily = me?.dailyDownloads
  const payments = me?.payments || []

  const onCancel = useCallback(async () => {
    if (!sub?.isPaid) return
    if (!window.confirm('Mark subscription as cancelled? You keep Pro until the expiry date; plans do not auto-renew.')) return
    setCancelBusy(true)
    setCancelMsg(null)
    try {
      const r = await cancelSubscriptionRequest(getFreshIdToken)
      if (!r.ok) {
        setCancelMsg(r.data?.message || r.data?.error || 'Could not update.')
        return
      }
      setCancelMsg(r.data?.message || 'Updated.')
      await refresh()
    } catch (e) {
      setCancelMsg(e?.message || 'Could not update.')
    } finally {
      setCancelBusy(false)
    }
  }, [getFreshIdToken, refresh, sub?.isPaid])

  return (
    <ToolPageShell
      title="Subscription & billing"
      subtitle="Plan, usage, and Razorpay payment references."
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white/90 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Current plan</h2>
          {loading && !me ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Plan</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {sub?.planLabel || 'Free'}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Renewal</dt>
                <dd>
                  {sub?.autoRenew
                    ? 'Automatic (card)'
                    : 'Manual — purchase again before expiry to extend Pro.'}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Pro active until</dt>
                <dd>{sub?.isPaid ? formatIso(sub?.expiresAt) : '—'}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Cancellation</dt>
                <dd>
                  {sub?.cancellationRequested
                    ? 'You asked to cancel — benefits stay until expiry (no auto-charge).'
                    : 'Not cancelled'}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Downloads today (UTC)</dt>
                <dd>
                  {daily?.unlimited
                    ? 'Unlimited (Pro)'
                    : `${daily?.usedToday ?? 0} / ${daily?.limit ?? 3} — resets ${formatIso(daily?.resetsAtUtc)}`}
                </dd>
              </div>
            </dl>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="fx-focus-ring rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              onClick={() => setUpgradeOpen(true)}
              disabled={!checkoutConfigured}
              title={!checkoutConfigured ? 'Payments not configured on API' : undefined}
            >
              {sub?.isPaid ? 'Extend or change plan' : 'Upgrade to Pro'}
            </button>
            {sub?.isPaid ? (
              <button
                type="button"
                disabled={cancelBusy || sub?.cancellationRequested}
                className="fx-focus-ring rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void onCancel()}
              >
                {sub?.cancellationRequested ? 'Cancellation noted' : 'Cancel subscription'}
              </button>
            ) : null}
            <Link
              to="/my-documents"
              className="fx-focus-ring inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Saved PDFs
            </Link>
          </div>
          {cancelMsg ? (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{cancelMsg}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white/90 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Payment history</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Razorpay payment and order IDs are stored for your records. Use the receipt link when
            Razorpay provides one.
          </p>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No payments yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-700">
              {payments.map((p) => (
                <li key={p.id} className="py-3 text-sm">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {p.planLabel || p.planKey || 'Payment'}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {formatInrFromPaise(p.amountPaise)} ·{' '}
                    {p.createdAt ? formatIso(p.createdAt) : '—'}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
                    Payment {p.razorpayPaymentId || p.id}
                    {p.razorpayOrderId ? ` · Order ${p.razorpayOrderId}` : ''}
                  </div>
                  {p.invoiceUrl ? (
                    <a
                      href={p.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-indigo-600 underline dark:text-cyan-400"
                    >
                      Receipt / invoice
                    </a>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      No hosted receipt URL — check email from Razorpay for the tax invoice.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Upgrades apply as soon as payment is verified on the server. If you switch from Pro Monthly
          to Pro Yearly, the new period stacks from the later of “now” or your current expiry (yearly
          after an active yearly term still stacks from the latest expiry). Buying monthly while on
          yearly starts after your yearly term ends.
        </p>
      </div>

      <UpgradePlanModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onPaid={() => void refresh()}
      />
    </ToolPageShell>
  )
}

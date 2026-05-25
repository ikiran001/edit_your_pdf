import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  FolderOpen,
  Infinity as InfinityIcon,
  Mail,
  MessageSquare,
  Receipt,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
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

function PlanCompareCell({ children, className = '' }) {
  return (
    <td
      className={`px-3 py-4 text-center align-middle text-sm text-zinc-700 dark:text-zinc-300 ${className}`}
    >
      {children}
    </td>
  )
}

function PlanCompareCheck() {
  return (
    <span className="inline-flex justify-center" title="Included">
      <Check className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">Included</span>
    </span>
  )
}

function DetailRow({ icon, label, children }) {
  const IconGlyph = icon
  return (
    <li className="flex gap-3 rounded-lg py-2.5 pl-1 sm:items-start">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        <IconGlyph className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{children}</div>
      </div>
    </li>
  )
}

export default function SubscriptionBillingPage() {
  const { getFreshIdToken } = useAuth()
  const { me, loading, error, refresh } = useSubscription()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelMsg, setCancelMsg] = useState(null)

  const sub = me?.subscription
  const daily = me?.dailyDownloads
  const payments = me?.payments || []

  const used = daily?.usedToday ?? 0
  const limit = daily?.limit ?? 3
  const downloadPct = useMemo(() => {
    if (daily?.unlimited) return 100
    if (!limit) return 0
    return Math.min(100, Math.round((used / limit) * 100))
  }, [daily?.unlimited, used, limit])

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
      subtitle="Your plan, download usage, and Razorpay receipts."
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {error ? (
          <div
            className="flex gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-50"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <p className="min-w-0 leading-relaxed">{error}</p>
          </div>
        ) : null}

        {/* Plan spotlight */}
        <section className="overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-white to-violet-50/80 shadow-lg ring-1 ring-indigo-900/5 dark:border-indigo-500/30 dark:from-indigo-950/50 dark:via-zinc-900 dark:to-violet-950/30 dark:ring-white/5">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-cyan-400">
                  Your plan
                </p>
                {loading && !me ? (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Loading your account…</p>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                        {sub?.planLabel || 'Free'}
                      </h2>
                      {sub?.isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300 dark:ring-emerald-400/30">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          Pro active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-400/25 dark:text-zinc-300 dark:ring-zinc-500/30">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {sub?.isPaid ? (
                        <>
                          Thanks for supporting pdfpilot. Your Pro access runs until{' '}
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {formatIso(sub?.expiresAt)}
                          </span>
                          . Renew manually anytime before then.
                        </>
                      ) : (
                        <>
                          Free includes editing and saving PDFs. Downloads from the editor and Saved PDFs
                          are limited to <strong>3 per calendar day (UTC)</strong>. Pro removes that cap.
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  className="fx-focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.99] dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  onClick={() => setUpgradeOpen(true)}
                >
                  <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                  {sub?.isPaid ? 'Extend or change plan' : 'Upgrade to Pro'}
                </button>
                <Link
                  to="/my-documents"
                  className="fx-focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-white/90 px-5 py-3 text-sm font-semibold text-indigo-900 shadow-sm transition hover:bg-white dark:border-indigo-500/40 dark:bg-zinc-950/60 dark:text-indigo-100 dark:hover:bg-zinc-900"
                >
                  <FolderOpen className="h-4 w-4 opacity-80" aria-hidden />
                  Saved PDFs
                </Link>
              </div>
            </div>

            {!loading && me && !daily?.unlimited ? (
              <div className="mt-6 rounded-xl border border-white/60 bg-white/70 p-4 shadow-inner dark:border-zinc-700/80 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
                    <Download className="h-4 w-4 text-indigo-600 dark:text-cyan-400" aria-hidden />
                    Downloads today (UTC)
                  </span>
                  <span className="tabular-nums text-sm font-semibold text-zinc-900 dark:text-white">
                    {used} / {limit}
                  </span>
                </div>
                <div
                  className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800"
                  role="progressbar"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={limit}
                  aria-label={`Downloads used today: ${used} of ${limit}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out dark:from-cyan-500 dark:to-indigo-500"
                    style={{ width: `${downloadPct}%` }}
                  />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Resets {formatIso(daily?.resetsAtUtc)}
                </p>
              </div>
            ) : null}

            {!loading && me && daily?.unlimited ? (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Unlimited downloads while Pro is active.
              </div>
            ) : null}

            {sub?.isPaid ? (
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-indigo-200/50 pt-6 dark:border-indigo-500/20">
                <button
                  type="button"
                  disabled={cancelBusy || sub?.cancellationRequested}
                  className="fx-focus-ring rounded-lg border border-zinc-300/90 bg-white/90 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => void onCancel()}
                >
                  <RefreshCw
                    className={`mr-1.5 inline h-3.5 w-3.5 ${cancelBusy ? 'animate-spin' : ''}`}
                    aria-hidden
                  />
                  {sub?.cancellationRequested ? 'Cancellation noted' : 'Cancel subscription'}
                </button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No auto-charge — you keep Pro until the date above.
                </p>
              </div>
            ) : null}
            {cancelMsg ? (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{cancelMsg}</p>
            ) : null}
          </div>
        </section>

        {!loading && me && !sub?.isPaid ? (
          <section
            aria-label="Why upgrade to Pro"
            className="overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/40 dark:via-zinc-900/80 dark:to-cyan-950/30 sm:p-8"
          >
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200">
                <Sparkles className="h-3 w-3" aria-hidden />
                Pro · ₹99/mo · ₹999/yr
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Get every Pro feature for less than ₹3/day
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
                Pro pays for itself the first time you stop manually retyping a scan or hunting through a 60-page contract for one clause.
              </p>
            </div>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <li className="flex gap-3 rounded-xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-zinc-900/60">
                <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">Chat with PDF</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Ask any question, get answers with page citations — for contracts, research papers, manuals.
                  </p>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-zinc-900/60">
                <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">Server OCR</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Turn scans and photos into searchable, copy-paste-ready PDFs (English + Hindi included).
                  </p>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-zinc-900/60">
                <InfinityIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">Unlimited downloads</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    No 3-per-day cap. Process whole batches of invoices, statements, or scans in one sitting.
                  </p>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-zinc-900/60">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">Priority support</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Email us with a PDF that's misbehaving — we'll respond and dig in.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
                Secure Razorpay checkout
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
                Manual renewal — no auto-debit
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
                Cancel any time
              </span>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="fx-focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                onClick={() => setUpgradeOpen(true)}
              >
                <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                Upgrade to Pro
              </button>
            </div>
          </section>
        ) : null}

        {!loading && me ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:p-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Compare all features
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-center text-sm text-zinc-500 dark:text-zinc-400">
              Free covers everyday edits. Pro unlocks AI Chat with PDF, server OCR, and removes the daily download cap.
            </p>
            <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/60">
                    <th
                      scope="col"
                      className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      Feature
                    </th>
                    <th
                      scope="col"
                      className="w-[22%] px-3 py-4 text-center text-sm font-bold text-zinc-900 dark:text-white"
                    >
                      Free
                    </th>
                    <th
                      scope="col"
                      className="w-[28%] px-3 py-4 text-center text-sm font-bold text-zinc-900 dark:text-white"
                    >
                      <span className="block">Pro</span>
                      <span className="mt-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        ₹99/mo · ₹999/yr
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      Edit &amp; convert PDFs in the browser
                    </th>
                    <PlanCompareCell>
                      <PlanCompareCheck />
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <PlanCompareCheck />
                    </PlanCompareCell>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      Save PDFs to your account
                    </th>
                    <PlanCompareCell>
                      <PlanCompareCheck />
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <PlanCompareCheck />
                    </PlanCompareCell>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      Daily downloads (editor + Saved PDFs)
                    </th>
                    <PlanCompareCell>
                      <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                        {limit} / day (UTC)
                      </span>
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">Unlimited</span>
                    </PlanCompareCell>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      Chat with PDF (AI — ask anything about your document)
                    </th>
                    <PlanCompareCell>
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">Unlimited</span>
                    </PlanCompareCell>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      OCR PDF (scans → searchable text on the server)
                    </th>
                    <PlanCompareCell>
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <PlanCompareCheck />
                    </PlanCompareCell>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      Priority email support
                    </th>
                    <PlanCompareCell>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Community</span>
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <PlanCompareCheck />
                    </PlanCompareCell>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      Payment & renewal
                    </th>
                    <PlanCompareCell>
                      <span className="text-zinc-500 dark:text-zinc-400">Free tier</span>
                    </PlanCompareCell>
                    <PlanCompareCell>
                      <span className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                        Razorpay · manual renewal, no auto-debit
                      </span>
                    </PlanCompareCell>
                  </tr>
                </tbody>
              </table>
            </div>
            {!sub?.isPaid ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  className="fx-focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  onClick={() => setUpgradeOpen(true)}
                >
                  <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                  Upgrade to Pro
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {!loading && me && !sub?.isPaid ? (
          <section
            aria-label="Common questions"
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:p-8"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Common questions</h3>
            <dl className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Will my card be auto-charged?</dt>
                <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  No. Pro renewals are manual on the monthly and yearly plans — you choose when to renew, so there are no surprise charges.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Can I cancel at any time?</dt>
                <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Yes. Cancellation stops the next renewal; you keep Pro access until your current period ends.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Is my PDF used to train AI?</dt>
                <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  No. Chat with PDF sends extracted text to the AI provider just to answer your question; we don't store conversations and the document is removed from our server shortly after your session.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Does Free still work?</dt>
                <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Yes — every editor and conversion tool stays free, with a 3-download-per-day cap. Pro unlocks AI Chat, server OCR, and removes the cap.
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {/* Compact billing details */}
        {!loading && me ? (
          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Billing details</h3>
            <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
              <DetailRow icon={RefreshCw} label="Renewal">
                {sub?.autoRenew
                  ? 'Automatic (card)'
                  : 'Manual — purchase again before expiry to extend Pro.'}
              </DetailRow>
              <DetailRow icon={CalendarClock} label="Pro active until">
                {sub?.isPaid ? formatIso(sub?.expiresAt) : '— (upgrade to set a date)'}
              </DetailRow>
              <DetailRow icon={ShieldCheck} label="Cancellation">
                {sub?.cancellationRequested
                  ? 'Noted — benefits stay until expiry.'
                  : 'Not cancelled'}
              </DetailRow>
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Receipt className="h-4 w-4 text-indigo-600 dark:text-cyan-400" aria-hidden />
                Payment history
              </h3>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Razorpay references and receipt links (when Razorpay provides a URL).
              </p>
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Receipt className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">No payments yet</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                After you complete a Pro purchase, receipts and Razorpay IDs will show up here.
              </p>
              {!sub?.isPaid ? (
                <button
                  type="button"
                  className="fx-focus-ring mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                  onClick={() => setUpgradeOpen(true)}
                >
                  Upgrade to Pro
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-800">
              {payments.map((p) => (
                <li key={p.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {p.planLabel || p.planKey || 'Payment'}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatInrFromPaise(p.amountPaise)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {p.createdAt ? formatIso(p.createdAt) : '—'}
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                    {p.razorpayPaymentId || p.id}
                    {p.razorpayOrderId ? ` · ${p.razorpayOrderId}` : ''}
                  </p>
                  {p.invoiceUrl ? (
                    <a
                      href={p.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
                    >
                      Open receipt
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      No hosted receipt link — check your Razorpay email for the invoice.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="group rounded-xl border border-zinc-200/90 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <summary className="cursor-pointer list-none text-sm font-medium text-zinc-700 marker:content-none dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              How plan changes work
              <ArrowRight className="h-3.5 w-3.5 transition group-open:rotate-90" aria-hidden />
            </span>
          </summary>
          <p className="mt-3 border-t border-zinc-200/80 pt-3 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Upgrades apply as soon as Razorpay payment is verified on the server. Monthly and yearly
            periods generally stack from the later of &quot;now&quot; or your current Pro end date; if you
            already have yearly Pro and buy monthly, the monthly time starts after yearly ends.
          </p>
        </details>
      </div>

      <UpgradePlanModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onPaid={() => void refresh()}
      />
    </ToolPageShell>
  )
}

import { Link } from 'react-router-dom'
import { FileText, Upload } from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { BRAND_NAME, TAGLINE } from '../../shared/constants/branding.js'
import {
  HERO_GLOBAL_USAGE_LINE,
  HERO_TRUST_STATS,
  HERO_TRUST_SYNC_HINT,
} from '../../shared/constants/heroTrustMetrics.js'

function trackEditEntry() {
  trackFeatureUsed(ANALYTICS_TOOL.edit_pdf)
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-indigo-200/30 bg-gradient-to-b from-indigo-50/80 via-white to-transparent px-4 pb-10 pt-6 dark:border-indigo-500/10 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-transparent md:px-10 md:pb-14 md:pt-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.22),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-cyan-400/90">
          {BRAND_NAME}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl dark:text-white">
          Edit and download PDFs instantly
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
          Fast, simple, and secure PDF editing directly in your browser. No installs. No hassle.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{TAGLINE}</p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/tools/edit-pdf"
            onClick={trackEditEntry}
            className="fx-focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 active:scale-[0.99] dark:bg-cyan-600 dark:shadow-cyan-900/30 dark:hover:bg-cyan-500"
          >
            <Upload className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
            Edit your PDF now
          </Link>
          <Link
            to="/tools/edit-pdf?sample=1"
            onClick={trackEditEntry}
            className="fx-focus-ring inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-zinc-300 bg-white/90 px-6 py-4 text-base font-semibold text-zinc-800 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/80 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-800"
          >
            <FileText className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
            Try sample PDF
          </Link>
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-zinc-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/50">
          <div className="grid gap-3 sm:grid-cols-3">
            {HERO_TRUST_STATS.map((row, i) => (
              <div
                key={row.label}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-center dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <p className="text-xl font-bold tabular-nums text-indigo-700 dark:text-cyan-300">
                  {row.value}
                  {i === 2 ? <span className="ml-0.5">🚀</span> : null}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-snug text-zinc-600 dark:text-zinc-400">
                  {row.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
            Based on a recent 7-day site snapshot ({HERO_TRUST_SYNC_HINT}). Numbers are rounded and updated when usage
            changes.
          </p>
          <p className="mt-2 text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">{HERO_GLOBAL_USAGE_LINE}</p>
        </div>
      </div>
    </section>
  )
}

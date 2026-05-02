import { Link } from 'react-router-dom'
import { FileText, Upload } from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { BRAND_NAME, TAGLINE } from '../../shared/constants/branding.js'

function trackEditEntry() {
  trackFeatureUsed(ANALYTICS_TOOL.edit_pdf)
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-indigo-200/30 bg-gradient-to-b from-indigo-50/90 via-white to-violet-50/40 px-4 pb-10 pt-6 dark:border-indigo-500/15 dark:from-indigo-950/35 dark:via-zinc-950 dark:to-fuchsia-950/25 md:px-8 md:pb-14 md:pt-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_70%_55%_at_15%_0%,rgba(244,63,94,0.14),transparent_55%),radial-gradient(ellipse_65%_50%_at_85%_5%,rgba(99,102,241,0.16),transparent_50%),radial-gradient(ellipse_55%_45%_at_50%_35%,rgba(34,211,238,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_70%_55%_at_15%_0%,rgba(244,63,94,0.1),transparent_55%),radial-gradient(ellipse_65%_50%_at_85%_5%,rgba(129,140,248,0.14),transparent_50%),radial-gradient(ellipse_55%_45%_at_50%_40%,rgba(34,211,238,0.08),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-2 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-xs font-semibold uppercase tracking-[0.2em] text-transparent dark:from-cyan-400 dark:via-fuchsia-400 dark:to-amber-300">
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
      </div>
    </section>
  )
}

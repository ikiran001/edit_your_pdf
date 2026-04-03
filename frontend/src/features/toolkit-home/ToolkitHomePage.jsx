import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import ToolCard from '../../shared/components/ToolCard.jsx'
import ThemeToggle from '../../shared/components/ThemeToggle.jsx'
import { TOOL_REGISTRY } from '../../shared/constants/toolRegistry.js'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

export default function ToolkitHomePage() {
  return (
    <div className="min-h-svh bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header px-4 py-5 md:px-10">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-cyan-400">
              <Sparkles className="h-5 w-5 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]" aria-hidden />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-cyan-300/90">
                letsEditPDF
              </span>
            </div>
            <h1 className="mt-3 bg-gradient-to-r from-zinc-900 via-indigo-700 to-violet-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl dark:from-white dark:via-cyan-200 dark:to-indigo-300">
              PDF toolkit
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 md:text-base dark:text-zinc-400">
              All-in-one tools to edit, convert, sign, and unlock PDFs — fast, private, and built for
              your browser.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <section
        className="mx-auto max-w-6xl px-4 py-10 md:px-10 md:py-14"
        style={{ animation: 'toolkitFade 0.6s ease-out both' }}
      >
        <h2 className="mb-6 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-cyan-400/85">
          Choose a tool
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {TOOL_REGISTRY.map((tool) => (
            <div key={tool.id} className="min-h-[200px]">
              <ToolCard tool={tool} />
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-xs text-zinc-500 dark:text-zinc-500">
          <Link
            to="/tools/edit-pdf"
            onClick={() => trackFeatureUsed(ANALYTICS_TOOL.edit_pdf)}
            className="text-indigo-600 underline-offset-2 transition hover:text-violet-600 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            Jump straight to Edit PDF
          </Link>
          {' · '}
          Files are processed in your session; review our README for API hosting on GitHub Pages.
        </p>
      </section>
    </div>
  )
}

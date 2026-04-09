import { Link } from 'react-router-dom'
import ToolCard from '../../shared/components/ToolCard.jsx'
import ThemeToggle from '../../shared/components/ThemeToggle.jsx'
import BrandLogoLink from '../../shared/components/BrandLogoLink.jsx'
import { TOOL_REGISTRY } from '../../shared/constants/toolRegistry.js'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { BRAND_NAME, TAGLINE } from '../../shared/constants/branding.js'

export default function ToolkitHomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header px-4 py-4 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandLogoLink />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 text-center md:px-10 md:pb-10 md:pt-6">
        <h1 className="bg-gradient-to-r from-zinc-900 via-indigo-700 to-violet-700 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl dark:from-white dark:via-cyan-200 dark:to-indigo-300">
          {BRAND_NAME}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg font-medium text-zinc-700 md:text-xl dark:text-zinc-300">
          Edit, compress, merge and manage PDFs instantly — no login required.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{TAGLINE}</p>
      </section>

      <section
        className="mx-auto max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-10"
        style={{ animation: 'toolkitFade 0.6s ease-out both' }}
      >
        <h2 className="mb-6 text-center font-mono text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-cyan-400/85">
          Choose a tool
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {TOOL_REGISTRY.map((tool) => (
            <div key={tool.id} className="aspect-square min-h-0 sm:aspect-auto sm:min-h-[200px]">
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

      <footer className="mt-auto border-t border-indigo-200/40 bg-white/40 px-4 py-8 text-center text-xs text-zinc-500 dark:border-indigo-500/15 dark:bg-zinc-950/40 dark:text-zinc-400">
        <p className="m-0 font-medium text-zinc-600 dark:text-zinc-300">© 2026 pdfpilot</p>
        <p className="mt-2 mb-0">
          <span className="cursor-default" title="Coming soon">
            Privacy
          </span>
          {' · '}
          <span className="cursor-default" title="Coming soon">
            Terms
          </span>
        </p>
      </footer>
    </div>
  )
}

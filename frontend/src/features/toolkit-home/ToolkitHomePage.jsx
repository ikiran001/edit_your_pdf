import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import ToolCard from '../../shared/components/ToolCard.jsx'
import ThemeToggle from '../../shared/components/ThemeToggle.jsx'
import { TOOL_REGISTRY } from '../../shared/constants/toolRegistry.js'

export default function ToolkitHomePage() {
  return (
    <div className="min-h-svh bg-gradient-to-br from-zinc-50 via-white to-indigo-100/40 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/40 dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white/70 px-4 py-5 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/70 md:px-10">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wider">letsEditPDF</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl dark:text-white">
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
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
          <Link to="/tools/edit-pdf" className="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
            Jump straight to Edit PDF
          </Link>
          {' · '}
          Files are processed in your session; review our README for API hosting on GitHub Pages.
        </p>
      </section>
    </div>
  )
}

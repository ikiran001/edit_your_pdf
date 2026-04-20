import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import ToolCard from '../../shared/components/ToolCard.jsx'
import ThemeToggle from '../../shared/components/ThemeToggle.jsx'
import AccountMenu from '../../shared/components/AccountMenu.jsx'
import BrandLogoLink from '../../shared/components/BrandLogoLink.jsx'
import LegalFooter from '../../shared/components/LegalFooter.jsx'
import { TOOL_REGISTRY } from '../../shared/constants/toolRegistry.js'
import HeroSection from './HeroSection.jsx'
import { peekFeedbackPrompt } from '../../lib/reviewPromptStorage.js'

function matchesToolSearch(tool, q) {
  if (!q) return true
  const hay = `${tool.title} ${tool.description} ${tool.id} ${tool.path}`.toLowerCase()
  return hay.includes(q)
}

export default function ToolkitHomePage() {
  const navigate = useNavigate()
  const [toolQuery, setToolQuery] = useState('')
  const q = toolQuery.trim().toLowerCase()

  const filteredTools = useMemo(() => TOOL_REGISTRY.filter((t) => matchesToolSearch(t, q)), [q])

  useEffect(() => {
    if (!peekFeedbackPrompt()) return
    navigate('/feedback?from=download', { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header relative z-40 px-4 py-4 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandLogoLink />
          <div className="flex items-center gap-2">
            <AccountMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <HeroSection />

      <section className="fx-toolkit-fade mx-auto max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-10">
        <h2 className="mb-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-cyan-400/85">
          Choose a tool
        </h2>
        <div className="mx-auto mb-6 max-w-lg" role="search">
          <label htmlFor="toolkit-tool-search" className="sr-only">
            Search tools by name or task
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              aria-hidden
            />
            <input
              id="toolkit-tool-search"
              type="search"
              value={toolQuery}
              onChange={(e) => setToolQuery(e.target.value)}
              placeholder="Search tools (e.g. merge, scan, watermark)…"
              autoComplete="off"
              spellCheck={false}
              className="fx-focus-ring w-full rounded-xl border border-zinc-200 bg-white/90 py-2.5 pl-10 pr-10 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            {toolQuery ? (
              <button
                type="button"
                onClick={() => setToolQuery('')}
                className="fx-focus-ring absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>
          {q ? (
            <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {filteredTools.length === 0
                ? `No tools match “${toolQuery.trim()}”. Try another word or clear the search.`
                : `Showing ${filteredTools.length} of ${TOOL_REGISTRY.length} tools`}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {filteredTools.map((tool) => (
            <div key={tool.id} className="aspect-square min-h-0 sm:aspect-auto sm:min-h-[200px]">
              <ToolCard tool={tool} />
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-xs text-zinc-500 dark:text-zinc-500">
          Files are processed in your session. Need the raw API? See the project README for self-hosting on GitHub
          Pages.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link
            to="/feedback"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            Share feedback
          </Link>
          <span className="text-zinc-400 dark:text-zinc-600"> · </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-500">Ratings and comments are shown only after real submissions.</span>
        </p>
      </section>

      <LegalFooter className="py-8" />
    </div>
  )
}

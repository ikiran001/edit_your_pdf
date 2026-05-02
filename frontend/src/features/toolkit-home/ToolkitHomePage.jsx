import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import ToolCard from '../../shared/components/ToolCard.jsx'
import SiteHeaderActions from '../../shared/components/SiteHeaderActions.jsx'
import BrandLogoLink from '../../shared/components/BrandLogoLink.jsx'
import LegalFooter from '../../shared/components/LegalFooter.jsx'
import { TOOL_REGISTRY } from '../../shared/constants/toolRegistry.js'
import HeroSection from './HeroSection.jsx'
import ToolkitNavMenus from './ToolkitNavMenus.jsx'
import { peekFeedbackPrompt } from '../../lib/reviewPromptStorage.js'

function matchesToolSearch(tool, q, t) {
  if (!q) return true
  const title = t(`tool.${tool.id}.title`, { defaultValue: tool.title })
  const desc = t(`tool.${tool.id}.description`, { defaultValue: tool.description })
  const hay = `${title} ${desc} ${tool.id} ${tool.path}`.toLowerCase()
  return hay.includes(q)
}

export default function ToolkitHomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [toolQuery, setToolQuery] = useState('')
  const q = toolQuery.trim().toLowerCase()

  const filteredTools = useMemo(
    () => TOOL_REGISTRY.filter((tool) => matchesToolSearch(tool, q, t)),
    [q, t, i18n.language]
  )

  useEffect(() => {
    if (!peekFeedbackPrompt()) return
    navigate('/feedback?from=download', { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header relative z-40 px-4 py-3 md:px-8">
        <div className="mx-auto grid max-w-[min(100%,96rem)] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-6">
          <BrandLogoLink className="min-w-0 justify-self-start" />
          <div className="flex shrink-0 items-center justify-end gap-2 lg:col-start-3 lg:row-start-1">
            <SiteHeaderActions />
          </div>
          <div className="col-span-2 -mx-4 min-w-0 overflow-x-auto px-4 pb-0.5 [scrollbar-width:thin] lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:px-0 lg:pb-0">
            <ToolkitNavMenus />
          </div>
        </div>
      </header>

      <main
        id="site-main"
        tabIndex={-1}
        className="flex flex-1 flex-col scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 dark:focus-visible:ring-cyan-400/35"
      >
        <HeroSection />

        <section className="fx-toolkit-fade relative isolate mx-auto w-full max-w-[min(100%,96rem)] flex-1 px-4 py-6 md:px-8 md:py-10">
        <h2 className="mb-4 bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-center font-mono text-sm font-semibold uppercase tracking-[0.18em] text-transparent dark:from-cyan-300 dark:via-fuchsia-400 dark:to-amber-300">
          {t('home.chooseTool')}
        </h2>
        <div className="mx-auto mb-6 max-w-2xl" role="search">
          <label htmlFor="toolkit-tool-search" className="sr-only">
            {t('home.searchPlaceholder')}
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
              placeholder={t('home.searchPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              className="fx-focus-ring w-full rounded-xl border border-zinc-200 bg-white/90 py-2.5 pl-10 pr-10 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            {toolQuery ? (
              <button
                type="button"
                onClick={() => setToolQuery('')}
                className="fx-focus-ring absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>
          {q ? (
            <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {filteredTools.length === 0
                ? t('home.searchNoResults', { query: toolQuery.trim() })
                : t('home.searchShowing', { n: filteredTools.length, total: TOOL_REGISTRY.length })}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredTools.map((tool) => (
            <div key={tool.id} className="aspect-square min-h-0 sm:aspect-auto sm:min-h-[200px]">
              <ToolCard tool={tool} />
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-xs text-zinc-500 dark:text-zinc-500">{t('home.footerProcessing')}</p>
        <p className="mt-6 text-center text-sm">
          <Link
            to="/feedback"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            {t('footer.shareFeedback')}
          </Link>
          <span className="text-zinc-400 dark:text-zinc-600"> · </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-500">{t('home.ratingsNote')}</span>
        </p>
        </section>
      </main>

      <LegalFooter className="py-8" />
    </div>
  )
}

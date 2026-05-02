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

/** Header + main shell: full viewport width; horizontal padding only (no max-width rail). */
const TOOLKIT_SHELL_X = 'px-3 sm:px-5 md:px-8 lg:px-10 xl:px-14 2xl:px-16'

export default function ToolkitHomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [toolQuery, setToolQuery] = useState('')
  const q = toolQuery.trim().toLowerCase()

  const filteredTools = useMemo(
    () => TOOL_REGISTRY.filter((tool) => matchesToolSearch(tool, q, t)),
    [q, t, i18n.language]
  )

  const showingAllTools = filteredTools.length === TOOL_REGISTRY.length

  useEffect(() => {
    if (!peekFeedbackPrompt()) return
    navigate('/feedback?from=download', { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className={`fx-glass-header relative z-40 py-3 ${TOOLKIT_SHELL_X}`}>
        <div className="mx-auto grid w-full grid-cols-[1fr_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-2 md:gap-x-4 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-1 lg:gap-x-6">
          <BrandLogoLink className="col-start-1 row-start-1 min-w-0 justify-self-start self-center" />
          <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-self-end self-center lg:col-start-3">
            <SiteHeaderActions />
          </div>
          <div className="col-span-2 row-start-2 -mx-3 flex min-w-0 justify-center overflow-x-auto px-3 pb-0.5 [scrollbar-width:thin] sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:w-auto lg:justify-self-center lg:overflow-visible lg:px-0 lg:pb-0">
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

        <section className={`fx-toolkit-fade relative isolate mx-auto w-full max-w-none flex-1 py-6 md:py-10 ${TOOLKIT_SHELL_X}`}>
        <h2 className="mb-4 bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-center font-mono text-sm font-semibold uppercase tracking-[0.18em] text-transparent dark:from-cyan-300 dark:via-fuchsia-400 dark:to-amber-300">
          {t('home.chooseTool')}
        </h2>
        <div className="mx-auto mb-6 w-full max-w-md sm:max-w-lg md:max-w-xl" role="search">
          <label htmlFor="toolkit-tool-search" className="sr-only">
            {t('home.searchPlaceholder')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fuchsia-600/70 dark:text-cyan-400/65"
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
              className="fx-focus-ring w-full rounded-full border border-zinc-200/90 bg-white/85 py-2 pl-9 pr-9 text-sm text-zinc-900 shadow-sm backdrop-blur-sm placeholder:text-zinc-400 transition-colors focus-visible:border-fuchsia-400/60 focus-visible:ring-2 focus-visible:ring-cyan-500/25 dark:border-white/[0.08] dark:bg-zinc-950/55 dark:text-zinc-100 dark:shadow-[0_0_24px_-12px_rgba(34,211,238,0.15)] dark:placeholder:text-zinc-500 dark:focus-visible:border-cyan-500/35 dark:focus-visible:ring-cyan-400/20"
            />
            {toolQuery ? (
              <button
                type="button"
                onClick={() => setToolQuery('')}
                className="fx-focus-ring absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-100"
                aria-label={t('common.close')}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
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
        <div
          className={
            showingAllTools
              ? 'mx-auto grid min-w-0 w-full max-md:max-w-lg grid-cols-1 gap-3 md:max-w-none md:gap-4 md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]'
              : 'mx-auto grid min-w-0 w-full max-md:max-w-lg grid-cols-1 justify-center justify-items-stretch gap-3 md:max-w-none md:gap-4 md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),min(100%,400px)))]'
          }
        >
          {filteredTools.map((tool) => (
            <div key={tool.id} className="min-h-0 min-w-0 md:min-h-[220px]">
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

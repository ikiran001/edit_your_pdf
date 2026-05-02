import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as Icons from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { REGISTRY_ID_TO_FEATURE } from '../constants/analyticsTools.js'
import { getToolCardAccent } from '../constants/toolCardAccents.js'

export default function ToolCard({ tool }) {
  const { t } = useTranslation()
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const accent = getToolCardAccent(tool.id)
  const title = t(`tool.${tool.id}.title`, { defaultValue: tool.title })
  const description = t(`tool.${tool.id}.description`, { defaultValue: tool.description })
  const content = (
    <article
      className={`group relative flex h-full flex-row items-start gap-3 overflow-hidden rounded-xl border border-zinc-200/90 bg-white/96 p-4 text-left shadow-md shadow-zinc-900/[0.04] ring-1 ring-black/[0.03] transition duration-300 ease-out will-change-transform sm:gap-4 sm:rounded-2xl sm:p-5 motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] dark:border-zinc-700/85 dark:bg-zinc-950/88 dark:shadow-[0_0_36px_-14px_rgba(0,0,0,0.55)] dark:ring-white/[0.06] ${accent.hoverGlow} ${
        !tool.implemented ? 'opacity-90' : ''
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md sm:h-11 sm:w-11 sm:rounded-xl sm:shadow-none ${accent.tile} ${accent.tileShadow}`}
      >
        <Icon className="h-6 w-6 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col text-left">
        <h2 className="line-clamp-2 w-full text-sm font-semibold leading-snug tracking-tight text-zinc-900 sm:line-clamp-none sm:text-lg dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-1 w-full flex-1 text-pretty text-xs leading-relaxed text-zinc-600 sm:mt-2 sm:text-sm dark:text-zinc-400">
          {description}
        </p>
        {!tool.implemented && (
          <span className="mt-2 inline-flex w-fit max-w-full shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 sm:mt-3 sm:px-2.5 sm:text-xs dark:bg-amber-950/60 dark:text-amber-100">
            <span className="sm:hidden">{t('common.soon')}</span>
            <span className="hidden sm:inline">{t('common.comingSoon')}</span>
          </span>
        )}
        {tool.implemented && (
          <span
            className={`mt-2 block w-full text-sm font-medium sm:mt-auto sm:pt-3 sm:opacity-0 sm:transition sm:group-hover:opacity-100 ${accent.cta}`}
          >
            {t('common.openTool')}
          </span>
        )}
      </div>
    </article>
  )

  if (!tool.implemented) {
    return (
      <div className="block h-full cursor-not-allowed" aria-disabled="true">
        {content}
      </div>
    )
  }

  const featureName = REGISTRY_ID_TO_FEATURE[tool.id]

  return (
    <Link
      to={tool.path}
      onClick={() => {
        if (featureName) trackFeatureUsed(featureName)
      }}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-zinc-950"
    >
      {content}
    </Link>
  )
}

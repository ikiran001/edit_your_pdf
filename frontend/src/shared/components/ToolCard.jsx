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
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white/96 p-3 shadow-md shadow-zinc-900/[0.04] ring-1 ring-black/[0.03] transition duration-300 ease-out will-change-transform sm:rounded-2xl sm:p-6 motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] max-sm:items-center max-sm:justify-center max-sm:text-center dark:border-zinc-700/85 dark:bg-zinc-950/88 dark:shadow-[0_0_36px_-14px_rgba(0,0,0,0.55)] dark:ring-white/[0.06] ${accent.hoverGlow} ${
        !tool.implemented ? 'opacity-90' : ''
      }`}
    >
      <div
        className={`mb-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl max-sm:shadow-lg sm:mb-4 sm:h-11 sm:w-11 sm:rounded-xl ${accent.tile} ${accent.tileShadow}`}
      >
        <Icon className="h-7 w-7 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="line-clamp-2 text-xs font-semibold leading-tight tracking-tight text-zinc-900 max-sm:mt-0.5 sm:line-clamp-none sm:text-lg dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 hidden flex-1 text-sm leading-relaxed text-zinc-600 sm:block dark:text-zinc-400">
        {description}
      </p>
      {!tool.implemented && (
        <span className="mt-1.5 inline-flex w-fit max-w-full shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 sm:mt-3 sm:px-2.5 sm:text-xs dark:bg-amber-950/60 dark:text-amber-100">
          <span className="sm:hidden">{t('common.soon')}</span>
          <span className="hidden sm:inline">{t('common.comingSoon')}</span>
        </span>
      )}
      {tool.implemented && (
        <span
          className={`mt-4 hidden text-sm font-medium opacity-0 transition group-hover:opacity-100 sm:block ${accent.cta}`}
        >
          {t('common.openTool')}
        </span>
      )}
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

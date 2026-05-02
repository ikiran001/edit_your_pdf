import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { REGISTRY_ID_TO_FEATURE } from '../constants/analyticsTools.js'

export default function ToolCard({ tool }) {
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const content = (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-indigo-200/70 bg-white/85 p-3 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/5 transition duration-300 ease-out will-change-transform sm:rounded-2xl sm:p-6 motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/15 dark:border-indigo-500/20 dark:bg-zinc-950/75 dark:shadow-[0_0_40px_-12px_rgba(99,102,241,0.25)] dark:ring-indigo-400/10 dark:hover:border-cyan-500/25 dark:hover:shadow-[0_0_48px_-8px_rgba(34,211,238,0.12)] max-sm:items-center max-sm:justify-center max-sm:text-center ${
        !tool.implemented ? 'opacity-90' : ''
      }`}
    >
      <div className="mb-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-md shadow-indigo-500/40 max-sm:shadow-lg dark:shadow-[0_0_20px_rgba(99,102,241,0.45)] sm:mb-4 sm:h-11 sm:w-11 sm:rounded-xl sm:shadow-lg">
        <Icon className="h-7 w-7 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="line-clamp-2 text-xs font-semibold leading-tight tracking-tight text-zinc-900 max-sm:mt-0.5 sm:line-clamp-none sm:text-lg dark:text-zinc-50">
        {tool.title}
      </h2>
      <p className="mt-2 hidden flex-1 text-sm leading-relaxed text-zinc-600 sm:block dark:text-zinc-400">
        {tool.description}
      </p>
      {!tool.implemented && (
        <span className="mt-1.5 inline-flex w-fit max-w-full shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 sm:mt-3 sm:px-2.5 sm:text-xs dark:bg-amber-950/60 dark:text-amber-100">
          <span className="sm:hidden">Soon</span>
          <span className="hidden sm:inline">Coming soon</span>
        </span>
      )}
      {tool.implemented && (
        <span className="mt-4 hidden text-sm font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100 sm:block dark:text-cyan-400">
          Open tool →
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

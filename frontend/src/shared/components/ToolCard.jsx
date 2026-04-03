import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { REGISTRY_ID_TO_FEATURE } from '../constants/analyticsTools.js'

export default function ToolCard({ tool }) {
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const content = (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-indigo-200/70 bg-white/85 p-6 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/5 transition duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:scale-[1.01] hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/15 dark:border-indigo-500/20 dark:bg-zinc-950/75 dark:shadow-[0_0_40px_-12px_rgba(99,102,241,0.25)] dark:ring-indigo-400/10 dark:hover:border-cyan-500/25 dark:hover:shadow-[0_0_48px_-8px_rgba(34,211,238,0.12)] ${
        !tool.implemented ? 'opacity-90' : ''
      }`}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/40 dark:shadow-[0_0_28px_rgba(99,102,241,0.5)]">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {tool.title}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {tool.description}
      </p>
      {!tool.implemented && (
        <span className="mt-3 inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
          Coming soon
        </span>
      )}
      {tool.implemented && (
        <span className="mt-4 text-sm font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100 dark:text-cyan-400">
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

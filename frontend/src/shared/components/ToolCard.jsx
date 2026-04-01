import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'

export default function ToolCard({ tool }) {
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const content = (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/90 p-6 shadow-sm transition duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-xl dark:border-zinc-700/90 dark:bg-zinc-900/90 ${
        !tool.implemented ? 'opacity-90' : ''
      }`}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
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
        <span className="mt-4 text-sm font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100 dark:text-indigo-400">
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

  return (
    <Link to={tool.path} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950">
      {content}
    </Link>
  )
}

import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

export default function ToolPageShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-zinc-50 via-white to-indigo-50/30 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/20 dark:text-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All tools
            </Link>
            <div className="min-w-0 border-l border-zinc-200 pl-3 dark:border-zinc-700">
              <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
              {subtitle ? (
                <p className="hidden truncate text-xs text-zinc-500 sm:block dark:text-zinc-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  )
}

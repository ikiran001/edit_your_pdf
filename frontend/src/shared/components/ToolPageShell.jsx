import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

export default function ToolPageShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header sticky top-0 z-30 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200/60 bg-white/90 px-2.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm shadow-indigo-500/5 transition hover:border-cyan-400/50 hover:text-indigo-700 dark:border-indigo-500/25 dark:bg-zinc-900/90 dark:text-zinc-200 dark:shadow-[0_0_24px_rgba(99,102,241,0.15)] dark:hover:border-cyan-400/35 dark:hover:text-cyan-100"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All tools
            </Link>
            <div className="min-w-0 border-l border-indigo-200/50 pl-3 dark:border-indigo-500/20">
              <h1 className="truncate bg-gradient-to-r from-zinc-900 to-indigo-800 bg-clip-text text-base font-semibold tracking-tight text-transparent md:text-lg dark:from-white dark:to-cyan-200/90">
                {title}
              </h1>
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

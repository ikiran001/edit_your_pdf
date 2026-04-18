import ThemeToggle from './ThemeToggle.jsx'
import AccountMenu from './AccountMenu.jsx'
import BrandLogoLink from './BrandLogoLink.jsx'
import { toolOnBrand } from '../constants/branding.js'

export default function ToolPageShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header sticky top-0 z-40 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
            <BrandLogoLink className="min-w-0" />
            <div className="min-w-0 border-l border-indigo-200/50 pl-3 dark:border-indigo-500/20">
              <h1 className="truncate bg-gradient-to-r from-zinc-900 to-indigo-800 bg-clip-text text-base font-semibold tracking-tight text-transparent md:text-lg dark:from-white dark:to-cyan-200/90">
                {title}
              </h1>
              {subtitle ? (
                <p className="hidden truncate text-xs text-zinc-500 sm:block dark:text-zinc-400">
                  {subtitle}
                </p>
              ) : null}
              <p className="truncate text-[11px] font-medium text-indigo-600/90 dark:text-cyan-400/90">
                {toolOnBrand(title)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AccountMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  )
}

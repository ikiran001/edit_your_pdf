import ThemeToggle from './ThemeToggle.jsx'
import AccountMenu from './AccountMenu.jsx'
import BrandLogoLink from './BrandLogoLink.jsx'
import LegalFooter from './LegalFooter.jsx'
import { toolOnBrand } from '../constants/branding.js'

/**
 * @param {{ title: string, subtitle?: string|null, children: import('react').ReactNode, contentMaxWidth?: 'default' | 'wide' }} props
 */
export default function ToolPageShell({ title, subtitle, children, contentMaxWidth = 'default' }) {
  const maxWidthClass =
    contentMaxWidth === 'wide' ? 'max-w-[min(100%,96rem)]' : 'max-w-5xl'

  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      <header className="fx-glass-header sticky top-0 z-40 px-4 py-3 md:px-8">
        <div className={`mx-auto flex w-full items-center justify-between gap-3 ${maxWidthClass}`}>
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
      <main
        id="site-main"
        tabIndex={-1}
        className={`mx-auto w-full ${maxWidthClass} flex-1 scroll-mt-24 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 md:px-8 md:py-12 dark:focus-visible:ring-cyan-400/35`}
      >
        {children}
      </main>
      <LegalFooter />
    </div>
  )
}

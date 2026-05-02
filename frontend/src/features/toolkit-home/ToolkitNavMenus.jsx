import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as Icons from 'lucide-react'
import { ChevronDown, Lock, Sparkles, Zap } from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { REGISTRY_ID_TO_FEATURE } from '../../shared/constants/analyticsTools.js'
import { MEGA_NAV_GROUPS, resolveMegaNavItem } from '../../shared/constants/megaToolNav.js'

/**
 * Seven-column All Tools layout: solid icon tiles + grey uppercase headings (reference UI).
 */
const MEGA_COLUMN_THEME = {
  coral: {
    iconTile: 'bg-orange-500 shadow-sm shadow-orange-500/25 ring-1 ring-black/5 dark:bg-orange-600 dark:shadow-orange-900/40',
    rowHover: 'hover:bg-orange-500/[0.08] dark:hover:bg-orange-400/[0.1]',
  },
  emerald: {
    iconTile: 'bg-emerald-600 shadow-sm shadow-emerald-600/25 ring-1 ring-black/5 dark:bg-emerald-600 dark:shadow-emerald-900/40',
    rowHover: 'hover:bg-emerald-500/[0.09] dark:hover:bg-emerald-400/[0.1]',
  },
  sun: {
    iconTile: 'bg-amber-500 shadow-sm shadow-amber-500/30 ring-1 ring-black/5 dark:bg-amber-500 dark:shadow-amber-900/35',
    rowHover: 'hover:bg-amber-500/[0.1] dark:hover:bg-amber-400/[0.1]',
  },
  azure: {
    iconTile: 'bg-sky-600 shadow-sm shadow-sky-600/25 ring-1 ring-black/5 dark:bg-sky-600 dark:shadow-sky-900/40',
    rowHover: 'hover:bg-sky-500/[0.09] dark:hover:bg-sky-400/[0.1]',
  },
  violet: {
    iconTile: 'bg-violet-600 shadow-sm shadow-violet-600/25 ring-1 ring-black/5 dark:bg-violet-600 dark:shadow-violet-900/40',
    rowHover: 'hover:bg-violet-500/[0.09] dark:hover:bg-violet-400/[0.1]',
  },
  navy: {
    iconTile: 'bg-blue-700 shadow-sm shadow-blue-700/25 ring-1 ring-black/5 dark:bg-blue-700 dark:shadow-blue-950/50',
    rowHover: 'hover:bg-blue-500/[0.09] dark:hover:bg-blue-400/[0.1]',
  },
  orchid: {
    iconTile: 'bg-indigo-700 shadow-sm shadow-indigo-700/25 ring-1 ring-white/10 dark:bg-indigo-800 dark:shadow-indigo-950/50',
    rowHover: 'hover:bg-indigo-500/[0.09] dark:hover:bg-indigo-400/[0.1]',
  },
}

export default function ToolkitNavMenus() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [layoutTop, setLayoutTop] = useState(64)
  const triggerRef = useRef(null)
  const panelId = useId()

  useLayoutEffect(() => {
    if (!open) return undefined

    const readTop = () => {
      const header = triggerRef.current?.closest('header')
      if (header) return header.getBoundingClientRect().bottom
      const triggerEl = triggerRef.current
      if (triggerEl) return triggerEl.getBoundingClientRect().bottom + 4
      return 64
    }

    const apply = () => {
      setLayoutTop(readTop())
    }

    const id = requestAnimationFrame(apply)
    let scrollRafId = null
    const onScrollResize = () => {
      if (scrollRafId != null) return
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null
        apply()
      })
    }

    window.addEventListener('resize', onScrollResize)
    window.addEventListener('scroll', onScrollResize, true)
    return () => {
      cancelAnimationFrame(id)
      if (scrollRafId != null) cancelAnimationFrame(scrollRafId)
      window.removeEventListener('resize', onScrollResize)
      window.removeEventListener('scroll', onScrollResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.classList.add('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [open])

  const close = () => setOpen(false)

  const portal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={t('header.closeToolsMenu')}
              className="fixed inset-0 z-[55] cursor-default bg-zinc-950/35 backdrop-blur-[1px]"
              style={{ top: layoutTop }}
              onClick={close}
            />
            <div
              id={panelId}
              role="dialog"
              aria-label={t('header.allToolsMenu')}
              className="fixed z-[60] w-[min(112rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15 ring-1 ring-black/[0.04] dark:border-zinc-600/60 dark:bg-zinc-950 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.06]"
              style={{
                top: layoutTop + 6,
                left: '50%',
                transform: 'translateX(-50%)',
                maxHeight: `min(calc(100dvh - ${layoutTop + 24}px), 88vh)`,
              }}
            >
              <div className="max-h-[inherit] overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
                <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 lg:gap-x-5 lg:gap-y-0">
                  {MEGA_NAV_GROUPS.map((group) => (
                    <MegaColumn key={group.labelKey} group={group} onNavigate={close} />
                  ))}
                </div>
                <MegaMenuFooter />
              </div>
            </div>
          </>,
          document.body
        )
      : null

  return (
    <>
      <div className="flex justify-center lg:justify-center">
        <button
          ref={triggerRef}
          type="button"
          className="fx-focus-ring flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-cyan-600/50 dark:hover:bg-zinc-800"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {t('header.allTools')}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-500 transition dark:text-zinc-400 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </div>
      {portal}
    </>
  )
}

function MegaColumn({ group, onNavigate }) {
  const { t } = useTranslation()
  const theme = MEGA_COLUMN_THEME[group.tint] || MEGA_COLUMN_THEME.violet
  const heading = t(group.labelKey)

  return (
    <div className="min-w-0 border-b border-zinc-100 pb-6 last:border-b-0 last:pb-0 sm:border-b-0 sm:pb-0 lg:border-b-0 dark:border-zinc-800/80">
      <h3 className="mb-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {heading}
      </h3>
      <div className="flex flex-col gap-0">
        {group.items.map((item, idx) => {
          const resolved = resolveMegaNavItem(item)
          if (!resolved) return null
          const key = resolved.kind === 'tool' ? resolved.tool.id : `${resolved.titleKey}-${idx}`
          return <MegaNavRow key={key} resolved={resolved} theme={theme} onPick={onNavigate} />
        })}
      </div>
    </div>
  )
}

/**
 * @param {{ resolved: { kind: 'tool', tool: object, titleKey?: string } | { kind: 'soon', icon: string, titleKey: string }, theme: typeof MEGA_COLUMN_THEME.violet, onPick: () => void }} props
 */
function MegaNavRow({ resolved, theme, onPick }) {
  const { t } = useTranslation()

  if (resolved.kind === 'soon') {
    const Icon = Icons[resolved.icon] || Icons.CircleHelp
    return (
      <div
        className={`flex cursor-not-allowed items-center gap-2.5 rounded-lg px-1 py-1.5 opacity-75 ${theme.rowHover}`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white ${theme.iconTile}`}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 text-left text-[13px] font-medium leading-snug text-zinc-600 dark:text-zinc-300">
          {t(resolved.titleKey)}
          <span className="ml-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">{t('common.soon')}</span>
        </span>
      </div>
    )
  }

  const { tool, titleKey } = resolved
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const featureName = REGISTRY_ID_TO_FEATURE[tool.id]
  const title = titleKey ? t(titleKey) : t(`tool.${tool.id}.title`, { defaultValue: tool.title })

  const iconBox = (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white ${theme.iconTile}`}
      aria-hidden
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  )

  if (!tool.implemented) {
    return (
      <div className={`flex cursor-not-allowed items-center gap-2.5 rounded-lg px-1 py-1.5 opacity-75 ${theme.rowHover}`}>
        {iconBox}
        <span className="min-w-0 text-left text-[13px] font-medium leading-snug text-zinc-600 dark:text-zinc-300">
          {title}
          <span className="ml-1 text-[11px] text-amber-700 dark:text-amber-400">{t('common.soon')}</span>
        </span>
      </div>
    )
  }

  return (
    <Link
      to={tool.path}
      onClick={() => {
        if (featureName) trackFeatureUsed(featureName)
        onPick()
      }}
      className={`fx-focus-ring flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-zinc-900 transition dark:text-zinc-50 ${theme.rowHover}`}
    >
      {iconBox}
      <span className="min-w-0 flex-1 text-left text-[13px] font-medium leading-snug">{title}</span>
    </Link>
  )
}

function MegaMenuFooter() {
  const { t } = useTranslation()
  return (
    <div className="mt-8 rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50/98 to-white px-4 py-5 dark:border-zinc-700/70 dark:from-zinc-900/85 dark:to-zinc-950/90">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200 sm:gap-x-10">
        <span className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25">
            <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          {t('megaFooter.privacy')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-600/25">
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          {t('megaFooter.easy')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-600/25">
            <Zap className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          {t('megaFooter.fast')}
        </span>
      </div>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">
        {t('megaFooter.termsAgree')}{' '}
        <Link to="/terms" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400">
          {t('megaFooter.termsLink')}
        </Link>
        {t('megaFooter.termsTail')}
      </p>
    </div>
  )
}

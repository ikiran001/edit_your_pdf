import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as Icons from 'lucide-react'
import { ChevronDown, Lock, Sparkles, Zap } from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { REGISTRY_ID_TO_FEATURE } from '../../shared/constants/analyticsTools.js'
import { TOOL_NAV_GROUPS, toolsInNavGroup } from '../../shared/constants/toolNavGroups.js'

/**
 * Mega-menu column themes (match toolkit nav groups / mockup: purple, maroon, orange, blue).
 * Icon tiles: bold gradients + white glyphs — readable on light panel and rich on dark.
 */
const MEGA_COLUMN_THEME = {
  violet: {
    iconTile:
      'bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white shadow-md shadow-violet-600/35 ring-1 ring-white/15 dark:from-violet-700 dark:via-purple-800 dark:to-indigo-950 dark:shadow-[0_6px_28px_-6px_rgba(139,92,246,0.55)] dark:ring-white/10',
    headingAccent: 'border-l-[3px] border-violet-500 dark:border-violet-400',
    rowHover:
      'hover:bg-violet-500/[0.09] dark:hover:bg-violet-400/[0.1]',
  },
  rose: {
    iconTile:
      'bg-gradient-to-br from-rose-700 via-rose-900 to-red-950 text-white shadow-md shadow-rose-700/35 ring-1 ring-white/15 dark:from-rose-800 dark:via-red-950 dark:to-red-950 dark:shadow-[0_6px_28px_-6px_rgba(225,29,72,0.45)] dark:ring-white/10',
    headingAccent: 'border-l-[3px] border-rose-600 dark:border-rose-500',
    rowHover:
      'hover:bg-rose-500/[0.09] dark:hover:bg-rose-400/[0.09]',
  },
  amber: {
    iconTile:
      'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-900 text-white shadow-md shadow-amber-600/35 ring-1 ring-white/15 dark:from-amber-700 dark:via-orange-800 dark:to-amber-950 dark:shadow-[0_6px_28px_-6px_rgba(245,158,11,0.45)] dark:ring-white/10',
    headingAccent: 'border-l-[3px] border-amber-500 dark:border-amber-400',
    rowHover:
      'hover:bg-amber-500/[0.09] dark:hover:bg-amber-400/[0.09]',
  },
  sky: {
    iconTile:
      'bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900 text-white shadow-md shadow-sky-600/35 ring-1 ring-white/15 dark:from-sky-800 dark:via-blue-900 dark:to-indigo-950 dark:shadow-[0_6px_28px_-6px_rgba(14,165,233,0.45)] dark:ring-white/10',
    headingAccent: 'border-l-[3px] border-sky-500 dark:border-sky-400',
    rowHover:
      'hover:bg-sky-500/[0.09] dark:hover:bg-sky-400/[0.09]',
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
      const t = triggerRef.current
      if (t) return t.getBoundingClientRect().bottom + 4
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
              className="fixed z-[60] w-[min(96rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/98 shadow-2xl shadow-zinc-900/20 ring-1 ring-black/[0.04] dark:border-zinc-600/50 dark:bg-zinc-950/98 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.06]"
              style={{
                top: layoutTop + 6,
                left: '50%',
                transform: 'translateX(-50%)',
                maxHeight: `min(calc(100dvh - ${layoutTop + 24}px), 85vh)`,
              }}
            >
              <div className="max-h-[inherit] overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 sm:py-7">
                <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
                  {TOOL_NAV_GROUPS.map((group) => (
                    <MegaColumn key={group.labelKey || group.label} group={group} onNavigate={close} />
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
  const tools = toolsInNavGroup(group)
  const theme = MEGA_COLUMN_THEME[group.tint] || MEGA_COLUMN_THEME.violet
  const heading = group.labelKey ? t(group.labelKey) : group.label

  return (
    <div className="min-w-0 border-b border-zinc-100 pb-8 last:border-b-0 last:pb-0 sm:border-b-0 sm:pb-0 lg:border-b-0 dark:border-zinc-800/90">
      <h3
        className={`mb-4 pl-3 text-left text-[12px] font-bold uppercase tracking-[0.12em] text-zinc-800 dark:text-zinc-100 ${theme.headingAccent}`}
      >
        {heading}
      </h3>
      <div className="flex flex-col gap-0.5">
        {tools.map((tool) => (
          <MegaToolCell key={tool.id} tool={tool} theme={theme} onPick={onNavigate} />
        ))}
      </div>
    </div>
  )
}

function MegaToolCell({ tool, theme, onPick }) {
  const { t } = useTranslation()
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const featureName = REGISTRY_ID_TO_FEATURE[tool.id]
  const title = t(`tool.${tool.id}.title`, { defaultValue: tool.title })

  const iconBox = (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${theme.iconTile}`}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={1.85} />
    </span>
  )

  if (!tool.implemented) {
    return (
      <div
        className={`flex cursor-not-allowed items-center gap-3 rounded-xl px-2 py-2 opacity-70 ${theme.rowHover}`}
      >
        {iconBox}
        <span className="min-w-0 text-left text-[13px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
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
      className={`fx-focus-ring flex items-center gap-3 rounded-xl px-2 py-2 text-zinc-800 transition dark:text-zinc-100 ${theme.rowHover}`}
    >
      {iconBox}
      <span className="min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
        {title}
      </span>
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

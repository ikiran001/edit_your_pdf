import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { ChevronDown, Lock, Sparkles, Zap } from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'
import { REGISTRY_ID_TO_FEATURE } from '../../shared/constants/analyticsTools.js'
import { TOOL_NAV_GROUPS, toolsInNavGroup } from '../../shared/constants/toolNavGroups.js'

/** @type {Record<string, string>} */
const COLUMN_ICON_TINT = {
  violet:
    'bg-violet-100 text-violet-700 shadow-sm shadow-violet-200/50 dark:bg-violet-950/60 dark:text-violet-200 dark:shadow-violet-900/30',
  rose: 'bg-rose-100 text-rose-700 shadow-sm shadow-rose-200/50 dark:bg-rose-950/60 dark:text-rose-200 dark:shadow-rose-900/30',
  amber:
    'bg-amber-100 text-amber-800 shadow-sm shadow-amber-200/50 dark:bg-amber-950/60 dark:text-amber-100 dark:shadow-amber-900/30',
  sky: 'bg-sky-100 text-sky-800 shadow-sm shadow-sky-200/50 dark:bg-sky-950/60 dark:text-sky-100 dark:shadow-sky-900/30',
}

export default function ToolkitNavMenus() {
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
              aria-label="Close tools menu"
              className="fixed inset-0 z-[55] cursor-default bg-zinc-950/35 backdrop-blur-[1px]"
              style={{ top: layoutTop }}
              onClick={close}
            />
            <div
              id={panelId}
              role="dialog"
              aria-label="All PDF tools"
              className="fixed z-[60] w-[min(96rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/98 shadow-2xl shadow-zinc-900/15 dark:border-zinc-600/80 dark:bg-zinc-950/98 dark:shadow-black/50"
              style={{
                top: layoutTop + 6,
                left: '50%',
                transform: 'translateX(-50%)',
                maxHeight: `min(calc(100dvh - ${layoutTop + 24}px), 85vh)`,
              }}
            >
              <div className="max-h-[inherit] overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                  {TOOL_NAV_GROUPS.map((group) => (
                    <MegaColumn key={group.label} group={group} onNavigate={close} />
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
          All tools
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
  const tools = toolsInNavGroup(group)
  const tint = COLUMN_ICON_TINT[group.tint] || COLUMN_ICON_TINT.violet

  return (
    <div className="min-w-0 border-b border-zinc-100 pb-6 last:border-b-0 last:pb-0 sm:border-b-0 sm:pb-0 lg:border-b-0">
      <h3 className="mb-3 text-left text-[13px] font-bold uppercase tracking-wide text-zinc-900 dark:text-white">
        {group.label}
      </h3>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {tools.map((tool) => (
          <MegaToolCell key={tool.id} tool={tool} iconTint={tint} onPick={onNavigate} />
        ))}
      </div>
    </div>
  )
}

function MegaToolCell({ tool, iconTint, onPick }) {
  const Icon = Icons[tool.icon] || Icons.FileQuestion
  const featureName = REGISTRY_ID_TO_FEATURE[tool.id]

  const iconBox = (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTint}`}
      aria-hidden
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  )

  if (!tool.implemented) {
    return (
      <div className="flex cursor-not-allowed items-start gap-2 rounded-lg p-1.5 opacity-70">
        {iconBox}
        <span className="min-w-0 text-left text-[11px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
          {tool.title}
          <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">Soon</span>
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
      className="fx-focus-ring flex items-start gap-2 rounded-lg p-1.5 text-zinc-800 transition hover:bg-indigo-50/90 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
    >
      {iconBox}
      <span className="min-w-0 text-left text-[11px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
        {tool.title}
      </span>
    </Link>
  )
}

function MegaMenuFooter() {
  return (
    <div className="mt-6 rounded-xl border border-zinc-200/80 bg-zinc-50/95 px-4 py-4 dark:border-zinc-700/80 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Privacy-focused
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-cyan-400" aria-hidden />
          Easy to use
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          Fast in your browser
        </span>
      </div>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">
        By using our tools you agree to the{' '}
        <Link to="/terms" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400">
          Terms of Service
        </Link>
        . Files are processed for your session; see the site footer for contact details.
      </p>
    </div>
  )
}

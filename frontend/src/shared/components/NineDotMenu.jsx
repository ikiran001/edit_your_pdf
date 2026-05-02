import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CreditCard,
  Globe,
  Heart,
  LayoutGrid,
  Lock,
  Sparkles,
  X,
} from 'lucide-react'
import { UI_LANGUAGES } from '../../i18n/languageCatalog.js'

function NineDotsTriggerIcon({ className = 'h-5 w-5' }) {
  return (
    <span className={`inline-grid grid-cols-3 gap-0.5 ${className}`} aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-current" />
      ))}
    </span>
  )
}

const PANEL_Z = 10045
const BACKDROP_Z = 10040

/**
 * “9-dot” apps menu: quick links + full language list (i18n).
 */
export default function NineDotMenu() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('main')
  const [layoutTop, setLayoutTop] = useState(64)
  const triggerRef = useRef(null)
  const panelId = useId()

  const languageMatches = (code) => {
    const r = (i18n.resolvedLanguage || i18n.language || '').replace(/_/g, '-')
    const c = code.replace(/_/g, '-')
    if (r === c) return true
    if (!c.includes('-') && (r === c || r.startsWith(`${c}-`))) return true
    return false
  }

  const readTop = useCallback(() => {
    const header = triggerRef.current?.closest('header')
    if (header) return header.getBoundingClientRect().bottom
    const trigger = triggerRef.current
    if (trigger) return trigger.getBoundingClientRect().bottom + 4
    return 64
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    const apply = () => setLayoutTop(readTop())
    const id = requestAnimationFrame(apply)
    const onScrollResize = () => setLayoutTop(readTop())
    window.addEventListener('resize', onScrollResize)
    window.addEventListener('scroll', onScrollResize, true)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', onScrollResize)
      window.removeEventListener('scroll', onScrollResize, true)
    }
  }, [open, readTop])

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

  const close = () => {
    setOpen(false)
    setView('main')
  }

  const pickLanguage = async (code) => {
    try {
      await i18n.changeLanguage(code)
    } catch {
      /* i18n may reject invalid codes; keep UI usable */
    }
    close()
  }

  const portal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={t('common.close')}
              className="fixed inset-0 z-[10040] cursor-default bg-zinc-950/40 backdrop-blur-[1px] dark:bg-black/50"
              style={{ top: layoutTop, zIndex: BACKDROP_Z }}
              onClick={close}
            />
            <div
              id={panelId}
              role="dialog"
              aria-label={t('appsMenu.ariaLabel')}
              className="fixed z-[10045] w-[min(32rem,calc(100vw-1.5rem))] max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-600/80 dark:bg-zinc-950"
              style={{
                top: layoutTop + 8,
                right: 12,
                maxHeight: `min(calc(100dvh - ${layoutTop + 24}px), 85vh)`,
                zIndex: PANEL_Z,
              }}
            >
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700/80">
                {view === 'lang' ? (
                  <button
                    type="button"
                    onClick={() => setView('main')}
                    className="fx-focus-ring inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    {t('appsMenu.back')}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('appsMenu.ariaLabel')}</span>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label={t('common.close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain p-3">
                {view === 'main' ? (
                  <nav className="flex flex-col gap-0.5" aria-label={t('appsMenu.ariaLabel')}>
                    <Link
                      to="/account/subscription"
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-indigo-50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
                        <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      {t('appsMenu.pricing')}
                    </Link>
                    <Link
                      to="/terms"
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-indigo-50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                        <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      {t('appsMenu.security')}
                    </Link>
                    <a
                      href="/#site-main"
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-indigo-50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                        <LayoutGrid className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      {t('appsMenu.features')}
                    </a>
                    <Link
                      to="/terms"
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-indigo-50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-100">
                        <Heart className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      {t('appsMenu.about')}
                    </Link>
                    <Link
                      to="/feedback"
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-indigo-50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                        <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      {t('appsMenu.help')}
                    </Link>
                    <hr className="my-2 border-zinc-200 dark:border-zinc-700" />
                    <button
                      type="button"
                      onClick={() => setView('lang')}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-800 transition hover:bg-indigo-50 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        <Globe className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      {t('appsMenu.language')}
                    </button>
                  </nav>
                ) : (
                  <div>
                    <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('appsMenu.chooseLanguage')}
                    </p>
                    <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2" role="listbox" aria-label={t('appsMenu.chooseLanguage')}>
                      {UI_LANGUAGES.map(({ code, nativeName }) => (
                        <li key={code}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={languageMatches(code)}
                            onClick={() => pickLanguage(code)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                              languageMatches(code)
                                ? 'bg-indigo-50 font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100'
                                : 'text-zinc-800 dark:text-zinc-100'
                            }`}
                          >
                            <span>{nativeName}</span>
                            {languageMatches(code) ? (
                              <span className="text-indigo-600 dark:text-cyan-400" aria-hidden>
                                ✓
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fx-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/90 bg-white/90 text-zinc-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-cyan-600/50 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('appsMenu.ariaLabel')}
      >
        <NineDotsTriggerIcon className="h-[1.1rem] w-[1.1rem]" />
      </button>
      {portal}
    </>
  )
}

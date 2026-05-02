import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditCard, FolderOpen, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useAuthModal } from '../../auth/AuthModalContext.jsx'
import { getFirebaseAuthErrorHint } from '../../lib/firebase.js'

const MENU_Z = 10050

function useMenuPosition(open, triggerRef) {
  const [coords, setCoords] = useState(null)

  useLayoutEffect(() => {
    if (!open) return undefined
    const measure = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const margin = 8
      const maxW = Math.min(20 * 16, window.innerWidth - margin * 2)
      setCoords({
        top: r.bottom + 6,
        right: Math.max(margin, window.innerWidth - r.right),
        width: maxW,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, triggerRef])

  return coords
}

/**
 * Guest: “Log in” opens the global auth modal. Signed-in: account dropdown.
 */
export default function AccountMenu({ compact = false }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { openAuth } = useAuthModal()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [signOutError, setSignOutError] = useState(null)
  const triggerRef = useRef(null)
  const accountMenuRef = useRef(null)
  const { user, loading, signOut } = useAuth()

  const coords = useMenuPosition(accountMenuOpen && Boolean(user), triggerRef)

  useEffect(() => {
    if (!accountMenuOpen) return undefined
    const onDoc = (e) => {
      const t = /** @type {Node | null} */ (e.target)
      if (triggerRef.current?.contains(t)) return
      if (accountMenuRef.current?.contains(t)) return
      setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!accountMenuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [accountMenuOpen])

  useEffect(() => {
    if (accountMenuOpen) setSignOutError(null)
  }, [accountMenuOpen])

  const name = user?.displayName?.trim() || ''
  const email = user?.email?.trim() || ''
  const triggerLabel = name || email || t('header.accountAriaGuest')
  const triggerTitle = name && email ? `${name} (${email})` : triggerLabel

  const accountDropdown =
    accountMenuOpen && coords && user ? (
      <div
        ref={accountMenuRef}
        role="menu"
        className="fixed max-h-[min(85vh,26rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-2xl ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10"
        style={{
          zIndex: MENU_Z,
          top: coords.top,
          right: coords.right,
          width: coords.width,
        }}
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.signedInLabel')}</p>
        {name ? (
          <>
            <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={triggerTitle}>
              {name}
            </p>
            {email ? (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400" title={email}>
                {email}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 truncate text-xs font-medium text-zinc-900 dark:text-zinc-100" title={triggerTitle}>
            {email || t('header.accountAriaGuest')}
          </p>
        )}
        <hr className="my-3 border-0 border-t border-zinc-200 dark:border-zinc-700" />
        <Link
          to="/my-documents"
          role="menuitem"
          id="eyp-account-menu-saved-pdfs"
          aria-describedby="eyp-account-menu-saved-pdfs-hint"
          className="fx-focus-ring group block w-full rounded-xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50 to-white px-3 py-3 text-left shadow-sm transition hover:border-indigo-300 hover:from-indigo-50/95 hover:shadow dark:border-indigo-500/35 dark:from-indigo-950/55 dark:to-zinc-900 dark:hover:border-cyan-500/30 dark:hover:from-indigo-950/70"
          onClick={() => setAccountMenuOpen(false)}
        >
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-cyan-300">
              <FolderOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t('account.savedPdfsTitle')}</span>
              <span id="eyp-account-menu-saved-pdfs-hint" className="mt-1 block text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                {t('account.savedPdfsHint')}
              </span>
            </span>
          </div>
        </Link>
        <Link
          to="/account/subscription"
          role="menuitem"
          className="fx-focus-ring mt-2 flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => setAccountMenuOpen(false)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t('account.subscriptionTitle')}</span>
            <span className="mt-0.5 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{t('account.subscriptionHint')}</span>
          </span>
        </Link>
        <button
          type="button"
          role="menuitem"
          disabled={signOutBusy}
          className="fx-focus-ring mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 active:scale-[0.99] dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => {
            if (signOutBusy) return
            setSignOutError(null)
            setSignOutBusy(true)
            void signOut()
              .then(() => {
                setAccountMenuOpen(false)
                navigate('/', { replace: true })
              })
              .catch((e) => {
                setSignOutError(getFirebaseAuthErrorHint(e) || e?.message || 'Could not sign out. Try again.')
              })
              .finally(() => setSignOutBusy(false))
          }}
        >
          {signOutBusy ? t('account.signingOut') : t('account.signOut')}
        </button>
        {signOutError ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>
    ) : null

  if (!user) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => openAuth('signin')}
        aria-label={t('header.accountAriaGuest')}
        className="fx-focus-ring inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/90 px-2 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:gap-2 sm:px-2.5 sm:text-sm"
      >
        <UserRound className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className={compact ? 'max-w-[9rem] truncate sm:max-w-[11rem]' : 'max-w-[11rem] truncate'}>
          {loading ? '…' : t('header.login')}
        </span>
      </button>
    )
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setAccountMenuOpen((o) => !o)}
        aria-expanded={accountMenuOpen}
        aria-haspopup="menu"
        id="eyp-account-menu-trigger"
        aria-label={t('header.accountAriaUser')}
        className="fx-focus-ring inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/90 px-2 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:gap-2 sm:px-2.5 sm:text-sm"
      >
        <UserRound className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span
          className={compact ? 'max-w-[9rem] truncate sm:max-w-[11rem]' : 'max-w-[11rem] truncate'}
          title={triggerTitle}
        >
          {name ? `${t('header.signedInPrefix')} ${name}` : `${t('header.signedInPrefix')} ${email || 'Account'}`}
        </span>
      </button>

      {typeof document !== 'undefined' && accountDropdown ? createPortal(accountDropdown, document.body) : null}
    </div>
  )
}

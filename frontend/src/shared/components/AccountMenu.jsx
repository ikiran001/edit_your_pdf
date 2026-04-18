import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import SignInExperienceModal from '../../auth/SignInExperienceModal.jsx'
import {
  isFirebaseConfigured,
  isFirebaseAuthReady,
  getMissingFirebaseEnvKeys,
  getFirebaseInitError,
  formatFirebaseInitError,
  getFirebaseAuthErrorHint,
} from '../../lib/firebase.js'

const MENU_Z = 10050

function useMenuPosition(open, triggerRef) {
  const [coords, setCoords] = useState(null)

  const measure = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const maxW = Math.min(18 * 16, window.innerWidth - margin * 2)
    setCoords({
      top: r.bottom + 6,
      right: Math.max(margin, window.innerWidth - r.right),
      width: maxW,
    })
  }, [triggerRef])

  useLayoutEffect(() => {
    if (!open) return undefined
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  return coords
}

/**
 * Signed-in: compact account menu. Guest: full-screen sign-in / create account (Adobe-style).
 */
export default function AccountMenu({ compact = false }) {
  const navigate = useNavigate()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [signOutError, setSignOutError] = useState(null)
  const [error, setError] = useState(null)
  const [successHint, setSuccessHint] = useState(null)
  const triggerRef = useRef(null)
  const accountMenuRef = useRef(null)
  const {
    user,
    loading,
    signInWithGooglePopup,
    requestPasswordResetEmail,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signOut,
  } = useAuth()

  const coords = useMenuPosition(accountMenuOpen && Boolean(user), triggerRef)

  const envReady = isFirebaseConfigured()
  const authReady = isFirebaseAuthReady()
  const initErr = getFirebaseInitError()
  const authDisabled = !envReady || Boolean(initErr) || !authReady
  const blockedHint = !envReady
    ? `Add these to frontend/.env.development (then restart npm run dev): ${getMissingFirebaseEnvKeys().join(', ')}`
    : initErr
      ? formatFirebaseInitError(initErr)
      : !authReady
        ? 'Starting Firebase…'
        : null

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

  const runPopup = async (fn) => {
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    try {
      await fn()
      setAuthModalOpen(false)
    } catch (e) {
      const c = e?.code || ''
      if (c === 'auth/popup-blocked') {
        setError('Popup blocked — allow popups for this site, then try “Continue with Google” again.')
      } else if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') {
        setError(getFirebaseAuthErrorHint(e) || e?.message || 'Sign-in failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  const runPasswordResetRequest = async (email) => {
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    try {
      await requestPasswordResetEmail(email)
      setSuccessHint(
        'If an account exists for that email, we sent reset instructions. Check your inbox and spam folder. After you set a new password, sign in here with email and password.'
      )
    } catch (e) {
      setError(getFirebaseAuthErrorHint(e) || e?.message || 'Could not send reset email.')
    } finally {
      setBusy(false)
    }
  }

  const runEmailComplete = async (fn) => {
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    try {
      await fn()
      setAuthModalOpen(false)
    } catch (e) {
      const c = e?.code || ''
      if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') {
        setError(getFirebaseAuthErrorHint(e) || e?.message || 'Sign-in failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  const name = user?.displayName?.trim() || ''
  const email = user?.email?.trim() || ''
  const triggerLabel = name || email || 'Account'
  const triggerTitle = name && email ? `${name} (${email})` : triggerLabel

  const closeAuthModal = () => {
    if (busy) return
    setAuthModalOpen(false)
    setError(null)
    setSuccessHint(null)
  }

  const mergedErrorHint = authDisabled ? blockedHint : error

  const accountDropdown =
    accountMenuOpen && coords && user ? (
      <div
        ref={accountMenuRef}
        role="menu"
        className="fixed max-h-[min(70vh,20rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-2xl ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10"
        style={{
          zIndex: MENU_Z,
          top: coords.top,
          right: coords.right,
          width: coords.width,
        }}
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Signed in</p>
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
            {email || 'Account'}
          </p>
        )}
        <Link
          to="/my-documents"
          role="menuitem"
          className="mt-3 block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-xs font-medium text-indigo-900 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
          onClick={() => setAccountMenuOpen(false)}
        >
          My documents
        </Link>
        <button
          type="button"
          role="menuitem"
          disabled={signOutBusy}
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
          {signOutBusy ? 'Signing out…' : 'Sign out'}
        </button>
        {signOutError ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>
    ) : null

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (user) {
            setAccountMenuOpen((o) => !o)
          } else {
            setError(null)
            setSuccessHint(null)
            setAuthModalOpen(true)
          }
        }}
        disabled={loading}
        aria-expanded={user ? accountMenuOpen : authModalOpen}
        aria-haspopup={user ? 'menu' : 'dialog'}
        id="eyp-account-menu-trigger"
        aria-label={user ? 'Account menu' : 'Log in or sign up'}
        className="fx-focus-ring inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/90 px-2 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:gap-2 sm:px-2.5 sm:text-sm"
      >
        <UserRound className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span
          className={compact ? 'max-w-[9rem] truncate sm:max-w-[11rem]' : 'max-w-[11rem] truncate'}
          title={user ? triggerTitle : undefined}
        >
          {loading ? '…' : user ? (name ? `Signed in · ${name}` : `Signed in · ${email || 'Account'}`) : 'Log in · Sign up'}
        </span>
      </button>

      {typeof document !== 'undefined' && accountDropdown ? createPortal(accountDropdown, document.body) : null}

      {!user ? (
        <SignInExperienceModal
          open={authModalOpen}
          onClose={closeAuthModal}
          busy={busy}
          errorHint={mergedErrorHint}
          successHint={authDisabled ? null : successHint}
          authDisabled={authDisabled}
          onGooglePopup={() => runPopup(signInWithGooglePopup)}
          onAuthMessage={(msg) => {
            if (msg == null) setError(null)
            else {
              setError(msg)
              setSuccessHint(null)
            }
          }}
          onSendPasswordReset={authDisabled ? undefined : (email) => runPasswordResetRequest(email)}
          onEmailSignIn={(email, password) =>
            runEmailComplete(() => signInWithEmailPassword(email, password))
          }
          onEmailSignUp={(payload) => runEmailComplete(() => signUpWithEmailPassword(payload))}
          initialMode="signin"
          variant="default"
        />
      ) : null}
    </div>
  )
}

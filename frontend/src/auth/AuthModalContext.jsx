import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useAuth } from './AuthContext.jsx'
import SignInExperienceModal from './SignInExperienceModal.jsx'
import {
  isFirebaseConfigured,
  isFirebaseAuthReady,
  getMissingFirebaseEnvKeys,
  getFirebaseInitError,
  formatFirebaseInitError,
  getFirebaseAuthErrorHint,
} from '../lib/firebase.js'

const AuthModalContext = createContext(null)

/**
 * Global sign-in / sign-up modal for header “Log in”, “Sign up”, and guest account entry.
 * @param {{ children: import('react').ReactNode }} props
 */
export function AuthModalProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [initialMode, setInitialMode] = useState('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [successHint, setSuccessHint] = useState(null)

  const {
    user,
    signInWithGooglePopup,
    requestPasswordResetEmail,
    signInWithEmailPassword,
    signUpWithEmailPassword,
  } = useAuth()

  const envReady = isFirebaseConfigured()
  const initErr = getFirebaseInitError()
  const authReady = isFirebaseAuthReady()
  const authDisabled = !envReady || Boolean(initErr) || !authReady
  const blockedHint = !envReady
    ? `Add these to frontend/.env.development (then restart npm run dev): ${getMissingFirebaseEnvKeys().join(', ')}`
    : initErr
      ? formatFirebaseInitError(initErr)
      : !authReady
        ? 'Starting Firebase…'
        : null

  const openAuth = useCallback((mode) => {
    setInitialMode(mode === 'signup' ? 'signup' : 'signin')
    setError(null)
    setSuccessHint(null)
    setOpen(true)
  }, [])

  const closeAuth = useCallback(() => {
    if (busy) return
    setOpen(false)
    setError(null)
    setSuccessHint(null)
  }, [busy])

  const runPopup = async (fn) => {
    setBusy(true)
    setError(null)
    setSuccessHint(null)
    try {
      await fn()
      setOpen(false)
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
      setOpen(false)
    } catch (e) {
      const c = e?.code || ''
      if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') {
        setError(getFirebaseAuthErrorHint(e) || e?.message || 'Sign-in failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  const mergedErrorHint = authDisabled ? blockedHint : error

  const value = useMemo(
    () => ({
      openAuth,
      closeAuth,
      authDisabled,
    }),
    [openAuth, closeAuth, authDisabled]
  )

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {!user ? (
        <SignInExperienceModal
          open={open}
          onClose={closeAuth}
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
          initialMode={initialMode === 'signup' ? 'signup' : 'signin'}
          variant="default"
        />
      ) : null}
    </AuthModalContext.Provider>
  )
}

/** Colocated hook for this provider; Fast Refresh expects component-only files. */
// eslint-disable-next-line react-refresh/only-export-components -- hook paired with AuthModalProvider above
export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) {
    throw new Error('useAuthModal must be used within AuthModalProvider')
  }
  return ctx
}

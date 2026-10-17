/* eslint-disable react-refresh/only-export-components -- context module: provider + hook */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext.jsx'
import ContinueDownloadModal from './ContinueDownloadModal.jsx'
import { isFirebaseClientConfigured } from './firebaseClient.js'
import { getFirebaseAuthErrorHint } from '../lib/firebase.js'
import { subscribeAuthLogoutCleanup } from './authLogoutCleanup.js'
import { useSubscription } from '../subscription/SubscriptionContext.jsx'
import UpgradePlanModal from '../subscription/UpgradePlanModal.jsx'
import { consumeDownloadRequest } from '../lib/subscriptionApi.js'

const ClientToolDownloadAuthContext = createContext(null)

/**
 * Wraps toolkit routes so Merge / Sign / Split / etc. can defer the browser download until the user
 * is signed in, without leaving the page. The `run` callback is held in memory (not sessionStorage);
 * closing the modal clears the pending action.
 */
export function ClientToolDownloadAuthProvider({ children }) {
  const {
    user,
    loading: authLoading,
    getFreshIdToken,
    signInWithGooglePopup,
    requestPasswordResetEmail,
    signInWithEmailPassword,
    signUpWithEmailPassword,
  } = useAuth()
  const { refresh: refreshSubscription } = useSubscription()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [modalSuccess, setModalSuccess] = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const pendingRunRef = useRef(null)
  const gateResolversRef = useRef(null)
  const flushInFlightRef = useRef(false)

  const dismissModal = useCallback(() => {
    if (modalBusy) return
    pendingRunRef.current = null
    try {
      gateResolversRef.current?.reject(Object.assign(new Error('cancelled'), { code: 'EYP_AUTH_CANCELLED' }))
    } catch {
      /* ignore */
    }
    gateResolversRef.current = null
    setModalOpen(false)
    setModalError(null)
    setModalSuccess(null)
  }, [modalBusy])

  useEffect(() => {
    return subscribeAuthLogoutCleanup(() => {
      pendingRunRef.current = null
      try {
        gateResolversRef.current?.reject(
          Object.assign(new Error('Signed out.'), { code: 'EYP_AUTH_SIGNED_OUT' })
        )
      } catch {
        /* ignore */
      }
      gateResolversRef.current = null
      flushInFlightRef.current = false
      setModalOpen(false)
      setModalBusy(false)
      setModalError(null)
      setModalSuccess(null)
    })
  }, [])

  /**
   * Count this download against the signed-in user's free daily limit, then run it.
   * Fail-open: a metering hiccup (or the endpoint not being deployed yet) never blocks
   * a download. On limit, open the upgrade modal and skip the download.
   * @param {() => Promise<void>} run
   */
  const consumeThenRun = useCallback(
    async (run) => {
      try {
        const r = await consumeDownloadRequest(getFreshIdToken)
        if (r.status === 403 && r.data?.error === 'download_limit_exceeded') {
          setUpgradeOpen(true)
          return
        }
      } catch {
        /* fail open — never block a download on a metering error */
      }
      await run()
      try {
        await refreshSubscription()
      } catch {
        /* ignore — count UI will catch up on next load */
      }
    },
    [getFreshIdToken, refreshSubscription]
  )

  const flushPendingRun = useCallback(async () => {
    if (flushInFlightRef.current) return
    const run = pendingRunRef.current
    if (!run) return
    flushInFlightRef.current = true
    setModalBusy(true)
    pendingRunRef.current = null
    try {
      await consumeThenRun(run)
      gateResolversRef.current?.resolve()
    } catch (e) {
      gateResolversRef.current?.reject(e)
      throw e
    } finally {
      gateResolversRef.current = null
      flushInFlightRef.current = false
      setModalBusy(false)
      setModalOpen(false)
      setModalError(null)
      setModalSuccess(null)
    }
  }, [consumeThenRun])

  useEffect(() => {
    if (!user || !modalOpen || !pendingRunRef.current) return
    void flushPendingRun()
  }, [user, modalOpen, flushPendingRun])

  const runPopupOauthThenFlush = useCallback(
    async (signInFn) => {
      setModalError(null)
      setModalSuccess(null)
      setModalBusy(true)
      try {
        await signInFn()
      } catch (e) {
        console.error(e)
        const code = e?.code || ''
        if (code === 'auth/popup-blocked') {
          setModalError(
            'Your browser blocked the sign-in window. Allow popups for this site, then try “Continue with Google” again.'
          )
        } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
          setModalError(null)
        } else {
          setModalError(
            getFirebaseAuthErrorHint(e) || e?.message || 'We could not connect. Check your network and try again.'
          )
        }
        setModalBusy(false)
        return
      }
      setModalBusy(false)
      try {
        await flushPendingRun()
      } catch (e) {
        console.error(e)
        setModalError(e?.message || 'Download could not finish. Try again.')
      }
    },
    [flushPendingRun]
  )

  const runPasswordReset = useCallback(
    async (email) => {
      setModalBusy(true)
      setModalError(null)
      setModalSuccess(null)
      try {
        await requestPasswordResetEmail(email)
        setModalSuccess(
          'If an account exists for that email, we sent reset instructions. Check your inbox and spam folder.'
        )
      } catch (e) {
        console.error(e)
        setModalError(getFirebaseAuthErrorHint(e) || e?.message || 'Could not send reset email.')
      } finally {
        setModalBusy(false)
      }
    },
    [requestPasswordResetEmail]
  )

  /**
   * Runs `run` immediately when the user is signed in (or Firebase is off). Otherwise opens the
   * sign-in modal and runs `run` after successful authentication. Preserves tool state in memory
   * because `run` closes over the caller’s current data.
   *
   * @param {() => Promise<void>} run
   * @param {{ onAuthLoading?: () => void }} [opts]
   * @returns {Promise<void>}
   */
  const runWithSignInForDownload = useCallback(
    async (run, opts = {}) => {
      if (authLoading) {
        opts.onAuthLoading?.()
        throw Object.assign(new Error('Still checking sign-in. Try again in a moment.'), {
          code: 'EYP_AUTH_LOADING',
        })
      }
      if (user) {
        await consumeThenRun(run)
        return
      }
      if (!isFirebaseClientConfigured()) {
        await run()
        return
      }
      pendingRunRef.current = run
      setModalError(null)
      setModalSuccess(null)
      setModalOpen(true)
      await new Promise((resolve, reject) => {
        gateResolversRef.current = { resolve, reject }
      })
    },
    [user, authLoading, consumeThenRun]
  )

  const value = useMemo(
    () => ({
      runWithSignInForDownload,
      authLoading,
    }),
    [runWithSignInForDownload, authLoading]
  )

  return (
    <ClientToolDownloadAuthContext.Provider value={value}>
      {children}
      <ContinueDownloadModal
        open={modalOpen}
        busy={modalBusy}
        errorHint={modalError}
        successHint={modalSuccess}
        onDismiss={dismissModal}
        onGooglePopup={() => runPopupOauthThenFlush(signInWithGooglePopup)}
        onAuthMessage={(msg) => {
          if (msg == null) setModalError(null)
          else {
            setModalError(msg)
            setModalSuccess(null)
          }
        }}
        onEmailSignIn={(email, password) =>
          runPopupOauthThenFlush(() => signInWithEmailPassword(email, password))
        }
        onEmailSignUp={(payload) => runPopupOauthThenFlush(() => signUpWithEmailPassword(payload))}
        onSendPasswordReset={(email) => runPasswordReset(email)}
      />
      <UpgradePlanModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onPaid={() => void refreshSubscription()}
      />
    </ClientToolDownloadAuthContext.Provider>
  )
}

/** @returns {{ runWithSignInForDownload: (run: () => Promise<void>, opts?: { onAuthLoading?: () => void }) => Promise<void>, authLoading: boolean }} */
export function useClientToolDownloadAuth() {
  const ctx = useContext(ClientToolDownloadAuthContext)
  if (!ctx) {
    throw new Error('useClientToolDownloadAuth must be used within ClientToolDownloadAuthProvider')
  }
  return ctx
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAuth } from './AuthContext.jsx'
import AuthEmailForms from './AuthEmailForms.jsx'
import { BRAND_NAME, TAGLINE } from '../shared/constants/branding.js'

const PANEL_Z = 10060

function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-600" />
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Or</span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-600" />
    </div>
  )
}

/**
 * Adobe-style full-screen auth: split hero + form, Sign in vs Create account, Google + email.
 *
 * @param {'default' | 'download'} [props.variant] Copy for download gate vs header auth.
 */
export default function SignInExperienceModal({
  open,
  onClose,
  busy,
  errorHint,
  successHint,
  onGooglePopup,
  onAuthMessage,
  onEmailSignIn,
  onEmailSignUp,
  onSendPasswordReset,
  initialMode = 'signin',
  variant = 'default',
  /** When true, show setup message only (no Google / email). */
  authDisabled = false,
}) {
  const { user } = useAuth()
  const [panelMode, setPanelMode] = useState(initialMode)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset wizard when dialog opens
      setPanelMode(initialMode)
    }
  }, [open, initialMode])

  useEffect(() => {
    if (open && user) onClose()
  }, [open, user, onClose])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const isDownload = variant === 'download'

  const panel = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-zinc-900/55 p-3 backdrop-blur-sm sm:p-6"
      style={{ zIndex: PANEL_Z }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,52rem)] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-700/80 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eyp-auth-panel-title"
      >
        {/* Left: brand / “glass” hero (desktop) */}
        <div
          className="relative hidden w-[40%] min-w-[220px] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-950 to-zinc-950 p-8 text-white lg:flex"
          aria-hidden="true"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-1/4 top-0 h-[120%] w-[80%] rounded-full bg-gradient-to-br from-fuchsia-500/30 to-transparent blur-3xl" />
            <div className="absolute bottom-0 right-0 h-2/3 w-2/3 rounded-full bg-gradient-to-tl from-cyan-500/20 to-transparent blur-3xl" />
          </div>
          <div className="relative z-[1] font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
            {BRAND_NAME}
          </div>
          <div className="relative z-[1] mt-auto">
            <p className="text-2xl font-semibold leading-tight tracking-tight text-white/95">{BRAND_NAME}</p>
            <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-white/75">{TAGLINE}</p>
            <p className="mt-6 text-xs text-white/50">Sign in or create an account to continue.</p>
          </div>
        </div>

        {/* Right: form card */}
        <div className="relative flex max-h-[min(92vh,52rem)] flex-1 flex-col overflow-y-auto bg-white dark:bg-zinc-900">
          <button
            type="button"
            disabled={busy}
            className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={() => {
              if (!busy) onClose()
            }}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>

          <div className="flex flex-1 flex-col px-6 pb-8 pt-10 sm:px-10 sm:pt-12">
            {isDownload ? (
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-cyan-400">
                Download
              </p>
            ) : null}

            {authDisabled ? (
              <h1 id="eyp-auth-panel-title" className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                Sign in
              </h1>
            ) : panelMode === 'signin' ? (
              <>
                <h1 id="eyp-auth-panel-title" className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  Sign in
                </h1>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  New user?{' '}
                  <button
                    type="button"
                    disabled={busy}
                    className="font-medium text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-cyan-400 dark:hover:text-cyan-300"
                    onClick={() => {
                      onAuthMessage?.(null)
                      setPanelMode('signup')
                    }}
                  >
                    Create an account
                  </button>
                </p>
              </>
            ) : (
              <>
                <h1 id="eyp-auth-panel-title" className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  Create an account
                </h1>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    disabled={busy}
                    className="font-medium text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-cyan-400 dark:hover:text-cyan-300"
                    onClick={() => {
                      onAuthMessage?.(null)
                      setPanelMode('signin')
                    }}
                  >
                    Sign in
                  </button>
                </p>
              </>
            )}

            {isDownload ? (
              <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                Sign in or create an account, then your edited PDF downloads. You stay signed in on this device.
              </p>
            ) : null}

            {errorHint ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"
              >
                {errorHint}
              </p>
            ) : null}
            {successHint ? (
              <p
                role="status"
                className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
              >
                {successHint}
              </p>
            ) : null}

            {authDisabled ? null : (
              <>
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    onClick={() => void onGooglePopup()}
                  >
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                <OrDivider />

                <AuthEmailForms
                  key={panelMode}
                  compact={false}
                  controlledEmailMode={panelMode}
                  omitTopBorder
                  busy={busy}
                  onAuthMessage={onAuthMessage}
                  onEmailSignIn={onEmailSignIn}
                  onEmailSignUp={onEmailSignUp}
                  onSendPasswordReset={onSendPasswordReset}
                />
              </>
            )}

            {!isDownload ? (
              <button
                type="button"
                disabled={busy}
                className="mt-8 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                onClick={() => {
                  if (!busy) onClose()
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="mt-8 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                onClick={() => {
                  if (!busy) onClose()
                }}
              >
                Not now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : null
}

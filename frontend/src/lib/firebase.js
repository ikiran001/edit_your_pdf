/**
 * Firebase Web SDK (Auth only).
 *
 * **Where to get config:** Firebase Console → your project → **Project settings** (gear) →
 * **Your apps** → **Web app** (`</>`) → **Firebase SDK snippet** → copy `firebaseConfig` values.
 *
 * **Env file:** `frontend/.env.development` or `frontend/.env.local` (both gitignored by default).
 * Only names prefixed with `VITE_` are exposed to the client (`import.meta.env`).
 *
 * **Restart Vite:** Stop the dev server and run `npm run dev` again after editing any `.env*`
 * file — Vite reads env at startup, not on hot reload.
 *
 * If sign-in fails with `auth/configuration-not-found` / `CONFIGURATION_NOT_FOUND`, open
 * Firebase Console → **Authentication** → **Get started** (provision Auth), then enable Google.
 */

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

/** Startup: each required key — `true` / `false` only (no secret values). */
function logFirebaseEnvPresenceOnLoad() {
  console.log('[firebase] Vite mode:', import.meta.env.MODE)
  console.log(
    '[firebase] Env files are read from frontend/ (vite.config envDir). Restart dev server after editing .env*'
  )
  for (const key of REQUIRED_KEYS) {
    const present = String(import.meta.env[key] ?? '').trim() !== ''
    console.log(`[firebase] env ${key} present:`, present)
  }
  if (getMissingFirebaseEnvKeys().length === REQUIRED_KEYS.length) {
    console.warn(
      '[firebase] All Firebase env vars missing or blank. Put real values in frontend/.env.development after each = (empty KEY= lines count as missing).'
    )
  }
}

function readFirebaseEnv() {
  const env = import.meta.env
  return {
    apiKey: String(env.VITE_FIREBASE_API_KEY ?? '').trim(),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim(),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID ?? '').trim(),
    appId: String(env.VITE_FIREBASE_APP_ID ?? '').trim(),
  }
}

/** @returns {string[]} env keys that are missing or blank */
export function getMissingFirebaseEnvKeys() {
  const env = import.meta.env
  const missing = []
  for (const key of REQUIRED_KEYS) {
    if (!String(env[key] ?? '').trim()) missing.push(key)
  }
  return missing
}

/** True only when all four required `VITE_FIREBASE_*` strings are non-empty (after trim). */
export function isFirebaseConfigured() {
  return getMissingFirebaseEnvKeys().length === 0
}

/** @type {import('firebase/auth').Auth | null | undefined} */
let _cachedAuth = undefined

/** @type {Error | null} */
let _initError = null

export function getFirebaseInitError() {
  return _initError
}

/**
 * Human-readable init failure (message + optional Firebase / SDK code).
 * @param {Error | null} err
 */
export function formatFirebaseInitError(err) {
  if (!err) return ''
  const code = /** @type {{ code?: string }} */ (err).code
  const base = err.message || String(err)
  return code ? `${base} [${code}]` : base
}

/**
 * User-facing copy for known Auth errors (e.g. `getProjectConfig` → CONFIGURATION_NOT_FOUND).
 * @param {unknown} err
 * @returns {string | null} replacement message, or `null` to use the raw `Error.message`
 */
export function getFirebaseAuthErrorHint(err) {
  const code = /** @type {{ code?: string }} */ (err)?.code
  if (code === 'auth/configuration-not-found') {
    return (
      'Firebase Authentication is not enabled for this Firebase project yet. ' +
      'Open the Firebase Console → Authentication → click Get started, then Sign-in method → enable the providers you use (Google, Email/Password).'
    )
  }
  if (code === 'auth/email-already-in-use') {
    return 'That email is already registered. Switch to “Sign in” or use Google.'
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Use at least 6 characters (longer is better).'
  }
  if (code === 'auth/invalid-email') {
    return 'That email address does not look valid.'
  }
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Wrong email or password. Try again or use “Create account”.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a few minutes and try again.'
  }
  const msg = String(/** @type {{ message?: string }} */ (err)?.message || '')
  if (
    code === 'auth/operation-not-allowed' ||
    msg.includes('OPERATION_NOT_ALLOWED') ||
    /operation[-_]?not[-_]?allowed/i.test(msg)
  ) {
    return (
      'That sign-in method is not allowed for this Firebase app. In Firebase Console open Authentication → Sign-in method and enable **Google** and/or **Email/Password** ' +
      '(toggle on, then Save). If a provider is already on, confirm **Identity Toolkit API** is enabled in Google Cloud Console → APIs & Services for the same project, then try again.'
    )
  }
  return null
}

/**
 * Lazily initializes Firebase and returns Auth, or `null` if env is incomplete or init failed.
 */
export function getFirebaseAuth() {
  if (_cachedAuth !== undefined) return _cachedAuth

  if (!isFirebaseConfigured()) {
    _initError = null
    _cachedAuth = null
    console.warn(
      '[firebase] init skipped — missing env keys:',
      getMissingFirebaseEnvKeys().join(', ')
    )
    return null
  }

  try {
    const c = readFirebaseEnv()
    const app = getApps().length > 0 ? getApp() : initializeApp(c)
    _cachedAuth = getAuth(app)
    if (typeof navigator !== 'undefined' && navigator.language) {
      try {
        _cachedAuth.languageCode = navigator.language
      } catch {
        /* ignore */
      }
    }
    _initError = null
    console.log('[firebase] Firebase initialized successfully')
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    _initError = err
    const code = /** @type {{ code?: string }} */ (e).code
    console.error(
      '[firebase] initializeApp / getAuth FAILED:',
      code || '(no code)',
      err.message,
      err
    )
    _cachedAuth = null
  }
  return _cachedAuth
}

/** `true` when env is valid **and** `initializeApp` + `getAuth` succeeded. */
export function isFirebaseAuthReady() {
  return Boolean(getFirebaseAuth())
}

export { REQUIRED_KEYS }

logFirebaseEnvPresenceOnLoad()

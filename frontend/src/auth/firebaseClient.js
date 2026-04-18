/**
 * Re-exports Firebase helpers from `src/lib/firebase.js` for shorter imports from `auth/`.
 */
import {
  isFirebaseConfigured,
  getMissingFirebaseEnvKeys,
  getFirebaseInitError,
  getFirebaseAuth,
  isFirebaseAuthReady,
  formatFirebaseInitError,
  getFirebaseAuthErrorHint,
} from '../lib/firebase.js'

export {
  isFirebaseConfigured,
  getMissingFirebaseEnvKeys,
  getFirebaseInitError,
  getFirebaseAuth,
  isFirebaseAuthReady,
  formatFirebaseInitError,
  getFirebaseAuthErrorHint,
}

/** True when env is complete and Firebase Auth initialized successfully (use for OAuth UI). */
export function isFirebaseClientConfigured() {
  return isFirebaseAuthReady()
}

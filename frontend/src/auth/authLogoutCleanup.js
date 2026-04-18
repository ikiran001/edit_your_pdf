import { clearPersistedEditSession } from '../features/edit-pdf/editSessionStorage.js'
import { clearPendingDownload } from './pendingDownloadStorage.js'

const subscribers = new Set()

/**
 * Register synchronous cleanup when the user signs out (e.g. dismiss gated-download modal).
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeAuthLogoutCleanup(fn) {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

/** Clear client-held auth-related session data and notify subscribers. */
export function runAuthLogoutCleanup() {
  clearPersistedEditSession()
  clearPendingDownload()
  for (const fn of subscribers) {
    try {
      fn()
    } catch (e) {
      console.warn('[auth] logout cleanup subscriber failed:', e)
    }
  }
}

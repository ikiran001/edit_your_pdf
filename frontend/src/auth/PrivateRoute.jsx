import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { isFirebaseAuthReady, isFirebaseConfigured } from '../lib/firebase.js'

/**
 * Renders children only when a Firebase user session exists. Otherwise redirects to `/` with
 * `replace` so the restricted URL is not left in history (back button does not return here).
 */
export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (!isFirebaseConfigured()) {
    return children
  }

  if (!isFirebaseAuthReady()) {
    return children
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-zinc-600 dark:text-zinc-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return children
}

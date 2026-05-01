/* eslint-disable react-refresh/only-export-components -- context module: provider + hook */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchSubscriptionMe } from '../lib/subscriptionApi.js'

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user, loading: authLoading, getFreshIdToken } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setData(null)
      setError(null)
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const r = await fetchSubscriptionMe(getFreshIdToken)
      if (!r.ok) {
        setData(null)
        if (r.status === 404) {
          setError(
            'Subscription API not found (404). Your API host is running an older build: redeploy the backend with the latest code so routes like GET /subscription/me exist. After deploy, GET /health should include a "subscription" object.'
          )
        } else if (r.status === 503 && r.data?.error === 'auth_unavailable') {
          /* Firebase Admin not configured on the API — billing/subscription cannot be verified server-side.
             Tools that only use the browser (e.g. PDF→Word) still work; configure FIREBASE_SERVICE_ACCOUNT_JSON on the API for subscription UI. */
          setError(null)
        } else {
          setError(r.data?.message || r.data?.error || 'Could not load subscription.')
        }
        return null
      }
      setData(r.data)
      return r.data
    } catch (e) {
      setData(null)
      setError(e?.message || 'Could not load subscription.')
      return null
    } finally {
      setLoading(false)
    }
  }, [user, getFreshIdToken])

  useEffect(() => {
    if (authLoading) return undefined
    if (!user) {
      setData(null)
      setError(null)
      return undefined
    }
    void refresh()
    return undefined
  }, [user?.uid, authLoading, refresh])

  const value = useMemo(
    () => ({
      /** Full `/subscription/me` payload or null */
      me: data,
      loading,
      error,
      refresh,
      checkoutConfigured: Boolean(data?.checkout?.configured),
      razorpayKeyId: typeof data?.checkout?.razorpayKeyId === 'string' ? data.checkout.razorpayKeyId : '',
    }),
    [data, loading, error, refresh]
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription() {
  const v = useContext(SubscriptionContext)
  if (!v) throw new Error('useSubscription must be used within SubscriptionProvider')
  return v
}

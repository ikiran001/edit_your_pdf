import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '../lib/firebase.js'
import { runAuthLogoutCleanup } from './authLogoutCleanup.js'

const AuthContext = createContext(null)

/**
 * @typedef {Object} SignUpPayload
 * @property {string} email
 * @property {string} password
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} birthMonth
 * @property {string} birthYear
 * @property {string} country
 */

export function AuthProvider({ children }) {
  const auth = getFirebaseAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(auth))

  useEffect(() => {
    if (!auth) return undefined
    void setPersistence(auth, browserLocalPersistence).catch(() => {})
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [auth])

  const getFreshIdToken = useCallback(async () => {
    if (!auth?.currentUser) return null
    return auth.currentUser.getIdToken(true)
  }, [auth])

  const signInWithGooglePopup = useCallback(async () => {
    if (!auth) throw new Error('Firebase is not configured for this build.')
    const p = new GoogleAuthProvider()
    p.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(auth, p)
  }, [auth])

  const requestPasswordResetEmail = useCallback(
    async (email) => {
      if (!auth) throw new Error('Firebase is not configured for this build.')
      const trimmed = String(email ?? '').trim()
      if (!trimmed) throw new Error('Enter your email address.')
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname || '/'}`
          : undefined
      try {
        await sendPasswordResetEmail(auth, trimmed, url ? { url } : undefined)
      } catch (e) {
        const code = /** @type {{ code?: string }} */ (e)?.code
        if (code === 'auth/user-not-found') return
        throw e
      }
    },
    [auth]
  )

  const signInWithEmailPassword = useCallback(
    async (email, password) => {
      if (!auth) throw new Error('Firebase is not configured for this build.')
      await signInWithEmailAndPassword(auth, email.trim(), password)
    },
    [auth]
  )

  const signUpWithEmailPassword = useCallback(
    /** @param {SignUpPayload} payload */
    async (payload) => {
      if (!auth) throw new Error('Firebase is not configured for this build.')
      const {
        email,
        password,
        firstName,
        lastName,
        birthMonth,
        birthYear,
        country,
      } = payload
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const displayName = `${firstName} ${lastName}`.trim()
      if (displayName) {
        await updateProfile(cred.user, { displayName })
      }
      try {
        const db = getFirestore(auth.app)
        await setDoc(
          doc(db, 'userProfiles', cred.user.uid),
          {
            firstName,
            lastName,
            birthMonth,
            birthYear,
            country,
            email: cred.user.email,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } catch (e) {
        console.warn('[auth] Extended profile was not saved (Firestore rules or API):', e)
      }
    },
    [auth]
  )

  const signOutUser = useCallback(async () => {
    runAuthLogoutCleanup()
    if (!auth) return
    try {
      await signOut(auth)
    } catch (e) {
      console.warn('[auth] signOut failed:', e)
      throw e
    }
  }, [auth])

  const value = useMemo(
    () => ({
      user,
      loading,
      authReady: Boolean(auth),
      getFreshIdToken,
      signInWithGooglePopup,
      requestPasswordResetEmail,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOut: signOutUser,
    }),
    [
      user,
      loading,
      auth,
      getFreshIdToken,
      signInWithGooglePopup,
      requestPasswordResetEmail,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOutUser,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider for this app
export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}

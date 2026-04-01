import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { applyThemeMode, getStoredThemeMode, THEME_STORAGE_KEY } from '../lib/themeSync.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => getStoredThemeMode() === 'dark')

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && e.key !== THEME_STORAGE_KEY) return
      const nextDark = getStoredThemeMode() === 'dark'
      setDark(nextDark)
      applyThemeMode(nextDark ? 'dark' : 'light', false)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d
      applyThemeMode(next ? 'dark' : 'light', true)
      return next
    })
  }, [])

  const value = useMemo(() => ({ dark, toggle }), [dark, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}

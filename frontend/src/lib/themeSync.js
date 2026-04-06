/** Persisted UI theme (Tailwind uses class `dark` on <html>). */
export const THEME_STORAGE_KEY = 'pdfpilot-theme'
/** Exact keys from older installs; keep for one-time theme migration. */
const LEGACY_THEME_KEYS = ['PDFly-theme', 'TheBestPDF-theme', 'letsEditPDF-theme']

/** @returns {'dark' | 'light'} */
export function getStoredThemeMode() {
  try {
    if (typeof localStorage === 'undefined') return 'dark'
    let v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v == null) {
      for (const legKey of LEGACY_THEME_KEYS) {
        const leg = localStorage.getItem(legKey)
        if (leg != null) {
          v = leg
          try {
            localStorage.setItem(THEME_STORAGE_KEY, leg)
          } catch {
            /* ignore */
          }
          break
        }
      }
    }
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * @param {'dark' | 'light'} mode
 * @param {boolean} [writeStorage=true] set false when syncing from another tab
 */
export function applyThemeMode(mode, writeStorage = true) {
  if (typeof document === 'undefined') return
  const dark = mode === 'dark'
  const root = document.documentElement
  const body = document.body
  if (!body) return

  root.classList.toggle('dark', dark)
  body.classList.remove('theme-dark', 'theme-light')
  body.classList.add(dark ? 'theme-dark' : 'theme-light')

  if (writeStorage) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', dark ? '#0f0614' : '#f4f4f5')
  }
}

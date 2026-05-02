import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const packs = import.meta.glob('./locales/*.json', { eager: true })

/** Vite / Rolldown may expose JSON as `default` or as the module namespace. */
function jsonFromGlobModule(mod) {
  if (mod == null) return null
  if (typeof mod === 'object' && 'default' in mod && mod.default != null) return mod.default
  return mod
}

/** @type {Record<string, { translation: Record<string, unknown> }>} */
const resources = {}
for (const [path, mod] of Object.entries(packs)) {
  const m = path.match(/\/([^/]+)\.json$/)
  if (m?.[1]) {
    const data = jsonFromGlobModule(/** @type {object} */ (mod))
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      resources[m[1]] = { translation: /** @type {Record<string, unknown>} */ (data) }
    }
  }
}

const STORAGE_KEY = 'pdfpilot_locale'

function readStoredLng() {
  if (typeof window === 'undefined') return 'en'
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en'
  } catch {
    return 'en'
  }
}

const available = new Set(Object.keys(resources))
const requested = readStoredLng()
const initialLng = available.has(requested) ? requested : 'en'

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'en',
  supportedLngs: [...available],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged loaded',
    bindI18nStore: 'added removed',
  },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
    document.documentElement.lang = lng.replace(/_/g, '-')
  } catch {
    /* ignore */
  }
})

export default i18n

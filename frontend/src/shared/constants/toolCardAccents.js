/**
 * Per-tool accent for toolkit cards: colorful icon tile + hover treatment (light & dark).
 * Keys must match {@link import('./toolRegistry.js').TOOL_REGISTRY} `id` values.
 */
export const TOOL_ACCENT_KEY_BY_ID = {
  'edit-pdf': 'violet',
  'ocr-pdf': 'fuchsia',
  'merge-pdf': 'rose',
  'split-pdf': 'rose',
  'organize-pdf': 'violet',
  'add-page-numbers': 'violet',
  'compress-pdf': 'emerald',
  'pdf-to-jpg': 'amber',
  'pdf-to-png': 'amber',
  'pdf-to-text': 'teal',
  'jpg-to-pdf': 'orange',
  'scan-to-pdf': 'orange',
  'sign-pdf': 'sky',
  'e-sign-pdf': 'sky',
  'fill-pdf': 'sky',
  'flatten-pdf': 'lime',
  'unlock-pdf': 'indigo',
  'encrypt-pdf': 'indigo',
  'add-watermark': 'fuchsia',
  'pdf-to-word': 'blue',
  'word-to-pdf': 'blue',
  'gst-invoice': 'teal',
  'remove-pages': 'rose',
  'extract-pages': 'rose',
  'repair-pdf': 'emerald',
  'powerpoint-to-pdf': 'orange',
  'excel-to-pdf': 'orange',
  'html-to-pdf': 'orange',
  'pdf-to-powerpoint': 'blue',
  'pdf-to-excel': 'blue',
  'pdf-to-pdfa': 'blue',
  'rotate-pdf': 'violet',
  'crop-pdf': 'violet',
  'redact-pdf': 'indigo',
  'compare-pdf': 'indigo',
  'translate-pdf': 'fuchsia',
}

/**
 * @typedef {{ tile: string, tileShadow: string, cta: string, hoverGlow: string }} ToolCardAccent
 */

/** @type {Record<string, ToolCardAccent>} */
export const TOOL_CARD_ACCENTS = {
  violet: {
    tile: 'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 text-white',
    tileShadow: 'shadow-lg shadow-violet-500/35 dark:shadow-violet-950/60',
    cta: 'text-violet-600 dark:text-violet-300',
    hoverGlow:
      'hover:border-violet-300/90 hover:shadow-violet-500/15 dark:hover:border-violet-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(167,139,250,0.45)]',
  },
  fuchsia: {
    tile: 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 text-white',
    tileShadow: 'shadow-lg shadow-fuchsia-500/35 dark:shadow-fuchsia-950/55',
    cta: 'text-fuchsia-600 dark:text-fuchsia-300',
    hoverGlow:
      'hover:border-fuchsia-300/90 hover:shadow-fuchsia-500/15 dark:hover:border-fuchsia-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(232,121,249,0.4)]',
  },
  rose: {
    tile: 'bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white',
    tileShadow: 'shadow-lg shadow-rose-500/35 dark:shadow-rose-950/55',
    cta: 'text-rose-600 dark:text-rose-300',
    hoverGlow:
      'hover:border-rose-300/90 hover:shadow-rose-500/15 dark:hover:border-rose-500/45 dark:hover:shadow-[0_0_44px_-10px_rgba(251,113,133,0.45)]',
  },
  emerald: {
    tile: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white',
    tileShadow: 'shadow-lg shadow-emerald-500/35 dark:shadow-emerald-950/55',
    cta: 'text-emerald-600 dark:text-emerald-300',
    hoverGlow:
      'hover:border-emerald-300/90 hover:shadow-emerald-500/15 dark:hover:border-emerald-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(52,211,153,0.4)]',
  },
  amber: {
    tile: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white',
    tileShadow: 'shadow-lg shadow-amber-500/40 dark:shadow-amber-950/50',
    cta: 'text-amber-700 dark:text-amber-300',
    hoverGlow:
      'hover:border-amber-300/90 hover:shadow-amber-500/15 dark:hover:border-amber-500/35 dark:hover:shadow-[0_0_44px_-10px_rgba(251,191,36,0.35)]',
  },
  teal: {
    tile: 'bg-gradient-to-br from-teal-500 via-cyan-600 to-sky-600 text-white',
    tileShadow: 'shadow-lg shadow-teal-500/35 dark:shadow-teal-950/55',
    cta: 'text-teal-600 dark:text-teal-300',
    hoverGlow:
      'hover:border-teal-300/90 hover:shadow-teal-500/15 dark:hover:border-teal-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(45,212,191,0.4)]',
  },
  orange: {
    tile: 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 text-white',
    tileShadow: 'shadow-lg shadow-orange-500/35 dark:shadow-orange-950/55',
    cta: 'text-orange-600 dark:text-orange-300',
    hoverGlow:
      'hover:border-orange-300/90 hover:shadow-orange-500/15 dark:hover:border-orange-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(251,146,60,0.4)]',
  },
  sky: {
    tile: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white',
    tileShadow: 'shadow-lg shadow-sky-500/35 dark:shadow-sky-950/55',
    cta: 'text-sky-600 dark:text-sky-300',
    hoverGlow:
      'hover:border-sky-300/90 hover:shadow-sky-500/15 dark:hover:border-sky-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(56,189,248,0.4)]',
  },
  lime: {
    tile: 'bg-gradient-to-br from-emerald-600 via-lime-500 to-yellow-400 text-white',
    tileShadow: 'shadow-lg shadow-lime-500/35 dark:shadow-lime-950/50',
    cta: 'text-lime-700 dark:text-lime-300',
    hoverGlow:
      'hover:border-lime-300/90 hover:shadow-lime-500/15 dark:hover:border-lime-500/35 dark:hover:shadow-[0_0_44px_-10px_rgba(163,230,53,0.35)]',
  },
  indigo: {
    tile: 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white',
    tileShadow: 'shadow-lg shadow-indigo-500/35 dark:shadow-indigo-950/60',
    cta: 'text-indigo-600 dark:text-indigo-300',
    hoverGlow:
      'hover:border-indigo-300/90 hover:shadow-indigo-500/15 dark:hover:border-indigo-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(129,140,248,0.45)]',
  },
  blue: {
    tile: 'bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white',
    tileShadow: 'shadow-lg shadow-blue-500/35 dark:shadow-blue-950/55',
    cta: 'text-blue-600 dark:text-blue-300',
    hoverGlow:
      'hover:border-blue-300/90 hover:shadow-blue-500/15 dark:hover:border-blue-500/40 dark:hover:shadow-[0_0_44px_-10px_rgba(96,165,250,0.45)]',
  },
}

const FALLBACK_KEY = 'violet'

/** @param {string} toolId */
export function getToolCardAccent(toolId) {
  const name = TOOL_ACCENT_KEY_BY_ID[toolId] ?? FALLBACK_KEY
  return TOOL_CARD_ACCENTS[name] ?? TOOL_CARD_ACCENTS[FALLBACK_KEY]
}

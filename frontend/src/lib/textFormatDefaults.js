/** Map pdf.js `TextStyle.fontFamily` (e.g. "g_d0_f1" resolved name) → pdf-lib standard font key. */
export function mapPdfFontNameToServer(pdfFontFamily) {
  const f = String(pdfFontFamily || '').toLowerCase()
  if (/courier|monaco|consolas|menlo|monospace|typewriter/.test(f)) return 'Courier'
  if (
    /times|minion|georgia|garamond|cambria/.test(f) ||
    (/\bserif\b/.test(f) && !/sans/.test(f))
  ) {
    return 'TimesRoman'
  }
  return 'Helvetica'
}

export function parsePdfFontStyle(pdfFontFamily) {
  const s = String(pdfFontFamily || '')
  return {
    bold: /\b(bold|black|heavy|semibold|demibold)\b/i.test(s),
    italic: /\b(italic|oblique)\b/i.test(s),
  }
}

/** CSS stack: prefer embedded PDF name, then web fallbacks matching server family. */
export function cssDisplayFontFromPdf(pdfFontFamily, serverFamily) {
  const fallback =
    serverFamily === 'TimesRoman'
      ? '"Times New Roman", Times, serif'
      : serverFamily === 'Courier'
        ? '"Courier New", Courier, monospace'
        : 'Helvetica, Arial, system-ui, sans-serif'
  const raw = String(pdfFontFamily || '').trim()
  if (!raw) return fallback
  const quoted = /[\s,]/.test(raw) ? `"${raw.replace(/"/g, '\\"')}"` : raw
  return `${quoted}, ${fallback}`
}

/** UI font labels → server `fontFamily` key (pdf-lib StandardFonts mapping on backend). */
export const FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica / Arial' },
  { value: 'TimesRoman', label: 'Times New Roman' },
  { value: 'Courier', label: 'Courier New' },
]

export const FONT_SIZE_OPTIONS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72,
]

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

export function defaultTextFormat() {
  return {
    fontFamily: 'Helvetica',
    fontSizeCss: 14,
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    color: '#111827',
    opacity: 1,
    rotationDeg: 0,
  }
}

/**
 * Toolbar + editor defaults from a merged text line block (geometry + pdf.js styles).
 * pdf.js does not expose fill color per glyph — default black matches most body text.
 */
export function formatFromTextBlock(block, prev) {
  const base = { ...defaultTextFormat(), ...prev }
  if (!block) return base
  const fs = Math.round(Math.max(8, Math.min(200, block.fontSizePx || 14)))
  const pdfFam = block.pdfFontFamily || ''
  const server = block.serverFontFamily || mapPdfFontNameToServer(pdfFam)
  const fromName = parsePdfFontStyle(pdfFam)
  return {
    ...base,
    fontSizeCss: fs,
    fontFamily: server,
    color: block.sourceColorHex || '#000000',
    bold: block.sourceBold ?? fromName.bold,
    italic: block.sourceItalic ?? fromName.italic,
  }
}

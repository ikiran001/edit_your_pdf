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
  const s = String(pdfFontFamily || '').slice(0, 512)
  const lower = s.toLowerCase()
  return {
    bold:
      /bold|black|heavy|semibold|demibold/i.test(s) ||
      /(?:^|[-_+])bd(?=[-_,\s]|$)/i.test(s) ||
      /\b(700|800|900)\b/.test(s) ||
      /boldmt|bolditalic/i.test(lower),
    italic:
      /\b(italic|oblique)\b/i.test(s) ||
      /[-_]it(?:alic)?(?=[-_,\s]|$)/i.test(s) ||
      /\bitalicmt\b/i.test(lower),
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
    color: '#000000',
    opacity: 1,
    rotationDeg: 0,
  }
}

/**
 * Toolbar + editor defaults from a merged text line block (geometry + pdf.js styles).
 * pdf.js does not expose fill color per glyph — default black matches most body text.
 */
/**
 * @param {string} [sampleColorHex] — from rendered canvas when opening inline editor (pdf.js has no fill color).
 * @param {{ pdfToCssScale?: number }} [layoutHint] — `pdfW / cssW` from the page canvas so `block.pdf.fontSize` maps to on-screen px.
 */
export function formatFromTextBlock(block, prev, sampleColorHex, layoutHint) {
  const base = { ...defaultTextFormat(), ...prev }
  if (!block) return base
  let fs = Math.round(Math.max(8, Math.min(200, block.fontSizePx || 14)))
  const scale = Number(layoutHint?.pdfToCssScale)
  const pdfFs = Number(block.pdf?.fontSize)
  if (Number.isFinite(pdfFs) && pdfFs > 0 && Number.isFinite(scale) && scale > 0) {
    const fromPdf = Math.round(Math.min(200, Math.max(8, pdfFs / scale)))
    fs = Math.max(fs, fromPdf)
  }
  const pdfFam = block.pdfFontFamily || ''
  const server = block.serverFontFamily || mapPdfFontNameToServer(pdfFam)
  const fromName = parsePdfFontStyle(pdfFam)
  const color =
    (typeof sampleColorHex === 'string' && sampleColorHex.startsWith('#')
      ? sampleColorHex
      : null) ||
    block.sourceColorHex ||
    '#000000'
  return {
    ...base,
    fontSizeCss: fs,
    fontFamily: server,
    color,
    /* `??` would keep false and ignore “Bold” in the font name */
    bold: !!(block.sourceBold || fromName.bold),
    italic: !!(block.sourceItalic || fromName.italic),
  }
}

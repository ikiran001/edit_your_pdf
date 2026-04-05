/**
 * Stack for the inline PDF text editor so Devanagari (Hindi/Marathi), rupee, and common symbols render.
 * Loaded via Google Fonts in index.html (Noto Sans + Noto Sans Devanagari).
 */
export const EDITOR_UNICODE_FONT_STACK = '"Noto Sans Devanagari", "Noto Sans", sans-serif'

/** Prefer Unicode-capable faces, then pdf.js / toolbar hint for metric similarity. */
export function editorFontFamilyWithPdfHint(pdfCssStack) {
  const hint = typeof pdfCssStack === 'string' ? pdfCssStack.trim() : ''
  if (!hint) return EDITOR_UNICODE_FONT_STACK
  return `${EDITOR_UNICODE_FONT_STACK}, ${hint}`
}

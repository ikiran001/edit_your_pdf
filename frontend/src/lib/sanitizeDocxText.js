/**
 * Remove characters that break WordprocessingML / XML 1.0 text nodes (Word shows “cannot open file”).
 * Keeps TAB/LF/CR (0x09, 0x0A, 0x0D); strips other C0 controls and U+FFFE/U+FFFF (no control-char regex — eslint).
 * @param {string} input
 */
export function sanitizeDocxText(input) {
  if (typeof input !== 'string' || !input.length) return ''
  let out = ''
  for (const ch of input) {
    const c = ch.codePointAt(0)
    if (c === 0xfffe || c === 0xffff) continue
    if (c === 0x9 || c === 0xa || c === 0xd) {
      out += ch
      continue
    }
    if (c <= 8 || c === 11 || c === 12 || (c >= 14 && c <= 31)) continue
    out += ch
  }
  return out
}

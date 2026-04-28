/**
 * Remove characters that break WordprocessingML / XML 1.0 text nodes (Word shows “cannot open file”).
 * @param {string} input
 */
export function sanitizeDocxText(input) {
  if (typeof input !== 'string' || !input.length) return ''
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\uFFFE|\uFFFF/g, '')
}

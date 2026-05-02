/**
 * Search highlights using pdf.js TextLayer + DOM Range (browser-find style).
 * Normalizes to the same element as RedactMarksOverlay (page wrap), not the canvas,
 * so coords match % layout even when canvas is scaled differently from the text layer.
 */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

const PAD = 0.001

function padNorm(nx, ny, nw, nh) {
  const x = clamp(nx - PAD, 0, 1)
  const y = clamp(ny - PAD, 0, 1)
  const w = clamp(nw + 2 * PAD, 0.004, 1 - x)
  const h = clamp(nh + 2 * PAD, 0.004, 1 - y)
  return { nx: x, ny: y, nw: w, nh: h }
}

/**
 * @param {DOMRectReadOnly} a
 * @param {DOMRectReadOnly} b
 */
function intersectDomRect(a, b) {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.right, b.right)
  const bottom = Math.min(a.bottom, b.bottom)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  return { left, top, width, height }
}

/**
 * Build flat string from text-node order (must match div.textContent for simple trees).
 * @param {HTMLElement} el
 */
function collectTextSegments(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  /** @type {{ node: Text, start: number, end: number }[]} */
  const segs = []
  let pos = 0
  let n = walker.nextNode()
  while (n) {
    const text = n.nodeValue ?? ''
    const start = pos
    pos += text.length
    segs.push({ node: /** @type {Text} */ (n), start, end: pos })
    n = walker.nextNode()
  }
  return { full: el.textContent ?? '', segs, length: pos }
}

/**
 * @param {HTMLElement} root
 * @param {number} idx
 * @param {number} len
 * @returns {Range | null}
 */
function rangeForSubstring(root, idx, len) {
  const { full, segs } = collectTextSegments(root)
  if (idx < 0 || len < 1 || idx + len > full.length) return null

  const endIdx = idx + len
  let startNode = null
  let startOff = 0
  let endNode = null
  let endOff = 0

  for (const s of segs) {
    if (!startNode && idx < s.end) {
      startNode = s.node
      startOff = idx - s.start
    }
    if (endIdx <= s.end) {
      endNode = s.node
      endOff = endIdx - s.start
      break
    }
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  try {
    range.setStart(startNode, startOff)
    range.setEnd(endNode, endOff)
  } catch {
    return null
  }
  return range
}

/**
 * @param {{ textDivs: HTMLElement[] }} textLayer - pdf.js TextLayer instance
 * @param {HTMLElement | null} normEl - Element defining 0–1 space (same as overlay parent, e.g. page wrap)
 * @param {string} query
 * @returns {{ nx: number, ny: number, nw: number, nh: number }[]}
 */
export function findSearchNormRectsFromTextLayer(textLayer, normEl, query) {
  const q = String(query || '').trim()
  if (!q || !textLayer?.textDivs?.length || !normEl) return []

  const box = normEl.getBoundingClientRect()
  if (box.width < 1 || box.height < 1) return []

  const qLower = q.toLowerCase()
  /** @type {{ nx: number, ny: number, nw: number, nh: number }[]} */
  const out = []

  for (const div of textLayer.textDivs) {
    const lower = (div.textContent ?? '').toLowerCase()
    let from = 0
    while (from <= lower.length - q.length) {
      const idx = lower.indexOf(qLower, from)
      if (idx < 0) break

      const range = rangeForSubstring(div, idx, q.length)
      if (!range) {
        from = idx + 1
        continue
      }

      let r = range.getBoundingClientRect()

      if (r.width < 0.35 || r.height < 0.35) {
        from = idx + Math.max(1, q.length)
        continue
      }

      r = intersectDomRect(r, box)
      if (r.width < 0.35 || r.height < 0.35) {
        from = idx + Math.max(1, q.length)
        continue
      }

      const nx = clamp((r.left - box.left) / box.width, 0, 1)
      const ny = clamp((r.top - box.top) / box.height, 0, 1)
      const nw = clamp(r.width / box.width, 0.002, 1 - nx)
      const nh = clamp(r.height / box.height, 0.002, 1 - ny)

      out.push(padNorm(nx, ny, nw, nh))
      from = idx + Math.max(1, q.length)
    }
  }

  return out
}

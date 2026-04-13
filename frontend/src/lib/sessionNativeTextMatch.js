import { normRectIou } from './nativeTextOverlap.js'

/**
 * Map a pdf.js line block to persisted native-text metadata after save/reload when PDF x/y drift.
 * `slotId` must stay stable so the next edit updates the same record instead of stacking draws.
 */
export function sessionNativeMetaForBlock(block, pageIndex, sessionNatives) {
  if (!sessionNatives?.length || !block?.pdf) return null

  /* Prefer stable block id so removing one edit cannot “stick” another line’s text via fuzzy x/y match. */
  const bid = typeof block.id === 'string' && block.id.length ? block.id : null
  if (bid) {
    for (const n of sessionNatives) {
      if (Number(n.pageIndex) !== pageIndex) continue
      if (n.blockId === bid) {
        return { text: n.text != null ? String(n.text) : '', slotId: n.slotId }
      }
    }
  }

  const bx = Number(block.pdf.x)
  const by = Number(block.pdf.y)
  const bb = Number(block.pdf.baseline)
  const bn = block.norm
  if (![bx, by, bb].every(Number.isFinite)) return null

  const eps = 1.5
  for (const n of sessionNatives) {
    if (Number(n.pageIndex) !== pageIndex) continue
    const nx = Number(n.x)
    const ny = Number(n.y)
    const nb = Number(n.baseline)
    if (
      Number.isFinite(nx) &&
      Number.isFinite(ny) &&
      Number.isFinite(nb) &&
      Math.abs(nx - bx) < eps &&
      Math.abs(ny - by) < eps &&
      Math.abs(nb - bb) < eps
    ) {
      return { text: n.text != null ? String(n.text) : '', slotId: n.slotId }
    }
  }

  let best = null
  let bestScore = -1
  for (const n of sessionNatives) {
    if (Number(n.pageIndex) !== pageIndex) continue
    let s = 0
    if (bn && n.norm) s = normRectIou(bn, n.norm)
    const nx = Number(n.x)
    const ny = Number(n.y)
    const nb = Number(n.baseline)
    if ([nx, ny, nb].every(Number.isFinite)) {
      const d = Math.abs(nx - bx) + Math.abs(ny - by) + Math.abs(nb - bb)
      if (d < 48) s = Math.max(s, 0.25 - d / 200)
    }
    if (s > bestScore) {
      bestScore = s
      best = n
    }
  }
  if (best && bestScore >= 0.06) {
    return { text: best.text != null ? String(best.text) : '', slotId: best.slotId }
  }

  let best2 = null
  let bestD = Infinity
  for (const n of sessionNatives) {
    if (Number(n.pageIndex) !== pageIndex) continue
    const nx = Number(n.x)
    const ny = Number(n.y)
    const nb = Number(n.baseline)
    if (![nx, ny, nb].every(Number.isFinite)) continue
    const d = Math.abs(nx - bx) + Math.abs(ny - by) + Math.abs(nb - bb)
    if (d < bestD) {
      bestD = d
      best2 = n
    }
  }
  if (best2 && bestD < 72) {
    return { text: best2.text != null ? String(best2.text) : '', slotId: best2.slotId }
  }

  return null
}

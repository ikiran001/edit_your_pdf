import { normRectIou } from './nativeTextOverlap.js'

/**
 * When both sides have a stable `blockId`, never let loose geometry steal another line’s session text.
 * (Legacy rows without `blockId` may still match on tight coordinates / IoU.)
 */
function sessionEntryMayBindToBlock(n, bid) {
  if (bid == null) return true
  const nid = typeof n.blockId === 'string' && n.blockId.length ? n.blockId : null
  if (nid == null) return true
  return nid === bid
}

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

  /* Tight triple — same physical slot after tiny PDF drift; still allow cross-id rematch for id churn. */
  const eps = 1.5
  for (const n of sessionNatives) {
    if (Number(n.pageIndex) !== pageIndex) continue
    /* No blockId filter here: same (x,y,baseline) after rounding drift may use a new `block.id`. */
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
    if (!sessionEntryMayBindToBlock(n, bid)) continue
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
  /* Raised from 0.06 — list items often share column IoU and must not pick a neighbour’s edit. */
  if (best && bestScore >= 0.28) {
    return { text: best.text != null ? String(best.text) : '', slotId: best.slotId }
  }

  let best2 = null
  let bestD = Infinity
  for (const n of sessionNatives) {
    if (Number(n.pageIndex) !== pageIndex) continue
    if (!sessionEntryMayBindToBlock(n, bid)) continue
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
  /* Was 72 PDF units — entire bullet columns matched the wrong row. Legacy-only via filter above. */
  if (best2 && bestD < 3.5) {
    return { text: best2.text != null ? String(best2.text) : '', slotId: best2.slotId }
  }

  return null
}

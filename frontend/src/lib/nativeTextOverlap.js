/**
 * Detect when two native-text edit regions are the same logical line so we merge
 * to one entry (re-save must not stack a second draw on original.pdf).
 */

export function normRectIou(a, b) {
  if (!a || !b) return 0
  const ax1 = a.nx
  const ay1 = a.ny
  const aw = a.nw
  const ah = a.nh
  const bx1 = b.nx
  const by1 = b.ny
  const bw = b.nw
  const bh = b.nh
  if (![ax1, ay1, aw, ah, bx1, by1, bw, bh].every((x) => Number.isFinite(x))) return 0
  const ax2 = ax1 + aw
  const ay2 = ay1 + ah
  const bx2 = bx1 + bw
  const by2 = by1 + bh
  const x1 = Math.max(ax1, bx1)
  const y1 = Math.max(ay1, by1)
  const x2 = Math.min(ax2, bx2)
  const y2 = Math.min(ay2, by2)
  const iw = Math.max(0, x2 - x1)
  const ih = Math.max(0, y2 - y1)
  const inter = iw * ih
  const u = aw * ah + bw * bh - inter
  return u > 1e-10 ? inter / u : 0
}

function verticalNormOverlapRatio(a, b) {
  if (!a || !b) return 0
  const ay2 = a.ny + a.nh
  const by2 = b.ny + b.nh
  const y1 = Math.max(a.ny, b.ny)
  const y2 = Math.min(ay2, by2)
  const ih = Math.max(0, y2 - y1)
  const h = Math.min(a.nh, b.nh)
  return h > 0 ? ih / h : 0
}

function horizontalNormOverlapRatio(a, b) {
  if (!a || !b) return 0
  const ax2 = a.nx + a.nw
  const bx2 = b.nx + b.nw
  const x1 = Math.max(a.nx, b.nx)
  const x2 = Math.min(ax2, bx2)
  const iw = Math.max(0, x2 - x1)
  const w = Math.min(a.nw, b.nw)
  return w > 0 ? iw / w : 0
}

/** True if two edits target the same approximate line (second save replaces first). */
export function nativeTextNormsAreSameSlot(normA, normB) {
  if (!normA || !normB) return false
  const iou = normRectIou(normA, normB)
  if (iou >= 0.06) return true
  const vy = verticalNormOverlapRatio(normA, normB)
  const hx = horizontalNormOverlapRatio(normA, normB)
  if (vy > 0.42 && hx > 0.12) return true
  const da = Number(normA.baselineN)
  const db = Number(normB.baselineN)
  if (Number.isFinite(da) && Number.isFinite(db) && Math.abs(da - db) < 0.018 && hx > 0.08) {
    return true
  }
  return false
}

/**
 * pdf.js / re-saved PDFs shift glyph boxes; compare PDF user-space anchor (persisted on each edit).
 */
export function nativeTextPdfSlotsAreSameSlot(a, b) {
  const ax = Number(a?.x)
  const ay = Number(a?.y)
  const ab = Number(a?.baseline)
  const bx = Number(b?.x)
  const by = Number(b?.y)
  const bb = Number(b?.baseline)
  if (![ax, ay, ab, bx, by, bb].every(Number.isFinite)) return false
  const tol = 16
  return Math.abs(ax - bx) < tol && Math.abs(ay - by) < tol && Math.abs(ab - bb) < tol
}

/** Full record match: norm overlap and/or PDF-slot proximity (handles missing norm). */
export function nativeTextRecordsAreSameSlot(a, b) {
  if (!a || !b) return false
  if (nativeTextNormsAreSameSlot(a.norm, b.norm)) return true
  return nativeTextPdfSlotsAreSameSlot(a, b)
}

const ANNOT_TEXT_SLOT = 0.02

export function annotTextItemsAreSameSlot(a, b) {
  if (!a || !b || a.type !== 'text' || b.type !== 'text') return false
  const dx = Math.abs(Number(a.x ?? 0) - Number(b.x ?? 0))
  const dy = Math.abs(Number(a.y ?? 0) - Number(b.y ?? 0))
  return dx < ANNOT_TEXT_SLOT && dy < ANNOT_TEXT_SLOT
}

/** Later items win: remove earlier `type: 'text'` at the same normalized spot. */
export function dedupeAnnotTextItemsBySlot(items) {
  if (!items?.length) return items
  const out = []
  for (const it of items) {
    if (it?.type !== 'text') {
      out.push(it)
      continue
    }
    const j = out.findIndex((x) => x.type === 'text' && annotTextItemsAreSameSlot(x, it))
    if (j >= 0) out.splice(j, 1)
    out.push(it)
  }
  return out
}

function dedupeNativeTextEditsBySlotId(list) {
  if (!list?.length) return []
  const lastIdx = new Map()
  for (let i = 0; i < list.length; i++) {
    const sid = list[i]?.slotId
    if (typeof sid === 'string' && sid.length >= 8) lastIdx.set(sid, i)
  }
  return list.filter((nt, i) => {
    const sid = nt?.slotId
    if (!(typeof sid === 'string' && sid.length >= 8)) return true
    return lastIdx.get(sid) === i
  })
}

function nativeEditDedupeKey(nt) {
  const p = Number(nt.pageIndex)
  if (!Number.isFinite(p)) return null
  const spatial = `${nt.x}:${nt.y}:${nt.baseline}`
  return typeof nt.key === 'string' && nt.key.length ? `${p}:${nt.key}` : `${p}:${spatial}`
}

function dedupeNativeTextEditsByKey(list) {
  if (!list?.length) return []
  const last = new Map()
  for (const nt of list) {
    const k = nativeEditDedupeKey(nt)
    if (k) last.set(k, nt)
  }
  const seen = new Set()
  const out = []
  for (let i = list.length - 1; i >= 0; i--) {
    const nt = list[i]
    const k = nativeEditDedupeKey(nt)
    if (!k || seen.has(k)) continue
    if (last.get(k) !== nt) continue
    seen.add(k)
    out.push(nt)
  }
  return out.reverse()
}

function dedupeNativeTextEditsByOverlap(list) {
  if (!list?.length) return []
  const picked = []
  for (let i = list.length - 1; i >= 0; i--) {
    const cur = list[i]
    const p = Number(cur.pageIndex)
    if (!Number.isFinite(p)) continue
    const overlaps = picked.some(
      (o) => Number(o.pageIndex) === p && nativeTextRecordsAreSameSlot(o, cur)
    )
    if (overlaps) continue
    picked.push(cur)
  }
  return picked.reverse()
}

/** Match server `dedupeNativeTextEditRecords` for hydration / defensive cleanup. */
export function dedupeNativeTextEditRecords(list) {
  return dedupeNativeTextEditsByOverlap(
    dedupeNativeTextEditsByKey(dedupeNativeTextEditsBySlotId(list)),
  )
}

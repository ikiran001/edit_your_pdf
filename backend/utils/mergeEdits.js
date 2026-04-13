import {
  nativeTextRecordsAreSameSlot,
  dedupeAnnotTextItemsBySlot,
} from './nativeTextOverlap.js';

/**
 * Last write wins per `key` (or fallback spatial id) so duplicate payloads cannot stack the same line.
 */
function nativeEditDedupeKey(nt) {
  const p = Number(nt.pageIndex);
  if (!Number.isFinite(p)) return null;
  const spatial = `${nt.x}:${nt.y}:${nt.baseline}`;
  return typeof nt.key === 'string' && nt.key.length ? `${p}:${nt.key}` : `${p}:${spatial}`;
}

/** Last value per key, ordered by last appearance in `list` (so overlap pass can prefer newest). */
/** One logical line per `slotId` (client-assigned, stable across save/reload). */
function dedupeNativeTextEditsBySlotId(list) {
  if (!list?.length) return [];
  const lastIdx = new Map();
  for (let i = 0; i < list.length; i++) {
    const sid = list[i]?.slotId;
    if (typeof sid === 'string' && sid.length >= 8) lastIdx.set(sid, i);
  }
  return list.filter((nt, i) => {
    const sid = nt?.slotId;
    if (!(typeof sid === 'string' && sid.length >= 8)) return true;
    return lastIdx.get(sid) === i;
  });
}

function dedupeNativeTextEditsByKey(list) {
  if (!list?.length) return [];
  const last = new Map();
  for (const nt of list) {
    const k = nativeEditDedupeKey(nt);
    if (k) last.set(k, nt);
  }
  const seen = new Set();
  const out = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const nt = list[i];
    const k = nativeEditDedupeKey(nt);
    if (!k || seen.has(k)) continue;
    if (last.get(k) !== nt) continue;
    seen.add(k);
    out.push(nt);
  }
  return out.reverse();
}

/**
 * After a save, pdf.js re-parses edited.pdf — x/y/baseline and `key` can drift while still being the same
 * logical line. Keep only the newest edit per overlapping norm slot (later in `list` wins).
 */
function dedupeNativeTextEditsByOverlap(list) {
  if (!list?.length) return [];
  const picked = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const cur = list[i];
    const p = Number(cur.pageIndex);
    if (!Number.isFinite(p)) continue;
    const overlaps = picked.some(
      (o) => Number(o.pageIndex) === p && nativeTextRecordsAreSameSlot(o, cur),
    );
    if (overlaps) continue;
    picked.push(cur);
  }
  return picked.reverse();
}

export function dedupeNativeTextEditRecords(list) {
  const bySlot = dedupeNativeTextEditsBySlotId(list);
  const byKey = dedupeNativeTextEditsByKey(bySlot);
  return dedupeNativeTextEditsByOverlap(byKey);
}

/**
 * Merges `nativeTextEdits` (Word-style replacements) before other page items so masks draw first.
 */
export function mergeEditsWithNative(edits, nativeTextEdits) {
  const map = new Map();

  const ensure = (p) => {
    const n = Number(p);
    if (!map.has(n)) map.set(n, []);
    return map.get(n);
  };

  for (const nt of dedupeNativeTextEditRecords(nativeTextEdits || [])) {
    const p = Number(nt.pageIndex);
    if (!Number.isFinite(p)) continue;
    ensure(p).push({
      type: 'nativeText',
      x: nt.x,
      y: nt.y,
      w: nt.w,
      h: nt.h,
      baseline: nt.baseline,
      fontSize: nt.fontSize,
      norm: nt.norm,
      text: nt.text,
      fontFamily: nt.fontFamily,
      bold: nt.bold,
      italic: nt.italic,
      underline: nt.underline,
      align: nt.align,
      color: nt.color,
      opacity: nt.opacity,
      rotationDeg: nt.rotationDeg,
      maskColor: nt.maskColor,
    });
  }

  for (const g of edits?.pages || []) {
    const p = Number(g.pageIndex);
    if (!Number.isFinite(p)) continue;
    const arr = ensure(p);
    for (const it of g.items || []) {
      if (it?.type === 'nativeText') continue;
      arr.push(it);
    }
  }

  return {
    pages: [...map.entries()]
      .map(([pageIndex, items]) => ({
        pageIndex,
        items: dedupeAnnotTextItemsBySlot(items),
      }))
      .sort((a, b) => a.pageIndex - b.pageIndex),
  };
}

/**
 * Last write wins per `key` (or fallback spatial id) so duplicate payloads cannot stack the same line.
 */
function dedupeNativeTextEdits(list) {
  if (!list?.length) return [];
  const last = new Map();
  for (const nt of list) {
    const p = Number(nt.pageIndex);
    if (!Number.isFinite(p)) continue;
    const spatial = `${nt.x}:${nt.y}:${nt.baseline}`;
    const k =
      typeof nt.key === 'string' && nt.key.length ? `${p}:${nt.key}` : `${p}:${spatial}`;
    last.set(k, nt);
  }
  return [...last.values()];
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

  for (const nt of dedupeNativeTextEdits(nativeTextEdits || [])) {
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
      .map(([pageIndex, items]) => ({ pageIndex, items }))
      .sort((a, b) => a.pageIndex - b.pageIndex),
  };
}

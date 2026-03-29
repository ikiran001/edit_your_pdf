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

  for (const nt of nativeTextEdits || []) {
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
      text: nt.text,
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

import fs from 'fs';
import path from 'path';
import { dedupeNativeTextEditRecords } from './mergeEdits.js';

export function sessionDir(uploadsRoot, sessionId) {
  return path.join(uploadsRoot, sessionId);
}

/** Stable id for merging native replacements (matches client `addNativeTextEdit` key shape). */
export function nativeEditKey(e) {
  if (e?.key && typeof e.key === 'string') return e.key;
  const p = Number(e?.pageIndex);
  if (!Number.isFinite(p)) return null;
  return `${p}:${e.x}:${e.y}:${e.baseline}`;
}

export function loadNativeTextEdits(uploadsRoot, sessionId) {
  const p = path.join(sessionDir(uploadsRoot, sessionId), 'native-text-edits.json');
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function saveNativeTextEdits(uploadsRoot, sessionId, list) {
  const dir = sessionDir(uploadsRoot, sessionId);
  fs.writeFileSync(path.join(dir, 'native-text-edits.json'), JSON.stringify(list));
}

/** Persisted first, then incoming — key + same-line overlap dedupe keeps one slot per line (newest wins). */
export function mergeNativeTextEdits(persisted, incoming) {
  return dedupeNativeTextEditRecords([...(persisted || []), ...(incoming || [])]);
}

export function loadSessionEdits(uploadsRoot, sessionId) {
  const p = path.join(sessionDir(uploadsRoot, sessionId), 'session-edits.json');
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j && typeof j === 'object' && Array.isArray(j.pages) ? j : { pages: [] };
  } catch {
    return { pages: [] };
  }
}

export function saveSessionEdits(uploadsRoot, sessionId, editsPayload) {
  const dir = sessionDir(uploadsRoot, sessionId);
  fs.writeFileSync(path.join(dir, 'session-edits.json'), JSON.stringify(editsPayload));
}

export function sessionHasAnnotationItems(editsPayload) {
  return (editsPayload?.pages || []).some((g) => (g.items || []).length > 0);
}

/**
 * Merge persisted annotation pages with the client's current payload by stable `id`.
 * Each save rebuilds from `original.pdf`; the client only holds unsaved / new overlays after reload,
 * so the server must accumulate all saved annotations here (see POST /edit).
 * Incoming items with the same `id` replace persisted ones (in-place edits in one session).
 */
export function mergeAnnotationEdits(persisted, incoming) {
  const byPage = new Map();

  const ensure = (pageIndex) => {
    if (!byPage.has(pageIndex)) byPage.set(pageIndex, new Map());
    return byPage.get(pageIndex);
  };

  let legacySeq = 0;
  const ingestPages = (pages) => {
    for (const g of pages || []) {
      const p = Number(g.pageIndex);
      if (!Number.isFinite(p)) continue;
      const idMap = ensure(p);
      for (const it of g.items || []) {
        if (!it || typeof it !== 'object') continue;
        const id =
          typeof it.id === 'string' && it.id.length > 0
            ? it.id
            : `_noid_${p}_${legacySeq++}`;
        idMap.set(id, { ...it, id });
      }
    }
  };

  ingestPages(persisted?.pages);
  ingestPages(incoming?.pages);

  const pages = [...byPage.entries()]
    .map(([pageIndex, idMap]) => ({
      pageIndex,
      items: [...idMap.values()],
    }))
    .sort((a, b) => a.pageIndex - b.pageIndex);

  return { pages };
}

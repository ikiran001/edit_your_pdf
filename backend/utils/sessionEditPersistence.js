import fs from 'fs';
import path from 'path';

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

/** Incoming entries override persisted when keys match. */
export function mergeNativeTextEdits(persisted, incoming) {
  const map = new Map();
  for (const e of persisted || []) {
    const k = nativeEditKey(e);
    if (k) map.set(k, { ...e, key: k });
  }
  for (const e of incoming || []) {
    const k = nativeEditKey(e);
    if (k) map.set(k, { ...e, key: k });
  }
  return [...map.values()];
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

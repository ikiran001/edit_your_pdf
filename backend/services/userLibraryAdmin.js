import admin from 'firebase-admin';
import { ensureFirebaseAdmin } from './firebaseAdmin.js';

function dbOrNull() {
  if (!ensureFirebaseAdmin()) return null;
  try {
    return admin.firestore();
  } catch (e) {
    console.warn('[userLibraryAdmin] firestore:', e?.message || e);
    return null;
  }
}

/**
 * @param {string} uid
 * @param {string} sessionId
 * @param {string} fileName
 * @param {string} tool
 * @returns {Promise<boolean>}
 */
export async function upsertUserLibraryDoc(uid, sessionId, fileName, tool) {
  const db = dbOrNull();
  if (!db) return false;
  const ref = db.collection('users').doc(uid).collection('documents').doc(sessionId);
  const snap = await ref.get();
  const FieldValue = admin.firestore.FieldValue;
  const payload = {
    sessionId,
    fileName: String(fileName || 'document.pdf').slice(0, 240),
    tool: String(tool || 'edit_pdf').slice(0, 64),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!snap.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }
  await ref.set(payload, { merge: true });
  return true;
}

/**
 * @param {string} uid
 * @param {string} sessionId
 */
export async function deleteUserLibraryDoc(uid, sessionId) {
  const db = dbOrNull();
  if (!db) return;
  try {
    await db.collection('users').doc(uid).collection('documents').doc(sessionId).delete();
  } catch (e) {
    console.warn('[userLibraryAdmin] delete doc:', e?.message || e);
  }
}

function timestampToIso(v) {
  if (!v) return null;
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {string} uid
 * @returns {Promise<Array<{ sessionId: string, fileName: string, tool: string, updatedAt: string | null, createdAt: string | null }>>}
 */
export async function listUserLibraryDocs(uid) {
  const db = dbOrNull();
  if (!db) return [];
  const snap = await db.collection('users').doc(uid).collection('documents').get();
  const rows = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    rows.push({
      sessionId: typeof x.sessionId === 'string' ? x.sessionId : d.id,
      fileName: typeof x.fileName === 'string' ? x.fileName : 'document.pdf',
      tool: typeof x.tool === 'string' ? x.tool : 'edit_pdf',
      updatedAt: timestampToIso(x.updatedAt),
      createdAt: timestampToIso(x.createdAt),
    });
  });
  rows.sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const tb = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return tb - ta;
  });
  return rows;
}

import fs from 'fs';
import admin from 'firebase-admin';

let initAttempted = false;
let initOk = false;

function parseServiceAccountJson() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Initializes Firebase Admin once. Returns false if credentials are missing or invalid.
 */
export function ensureFirebaseAdmin() {
  if (initAttempted) return initOk;
  initAttempted = true;
  try {
    if (admin.apps.length > 0) {
      initOk = true;
      return true;
    }
    const parsed = parseServiceAccountJson();
    if (parsed && typeof parsed === 'object' && parsed.private_key) {
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      initOk = true;
      return true;
    }
    const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
    if (credPath && fs.existsSync(credPath)) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      initOk = true;
      return true;
    }
  } catch (e) {
    console.error('[firebase-admin] init failed:', e?.message || e);
    initOk = false;
    return false;
  }
  initOk = false;
  return false;
}

/**
 * @param {string} idToken — Firebase ID JWT from the client
 * @returns {Promise<{ uid: string, email?: string } | null>}
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  if (!ensureFirebaseAdmin()) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    return { uid: decoded.uid, email: decoded.email || undefined };
  } catch (e) {
    console.warn('[firebase-admin] verifyIdToken failed:', e?.code || e?.message || e);
    return null;
  }
}

export function isFirebaseAdminReady() {
  return ensureFirebaseAdmin();
}

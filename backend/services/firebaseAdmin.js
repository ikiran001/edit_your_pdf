import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Resolve credential paths relative to `backend/` so GOOGLE_APPLICATION_CREDENTIALS=./file.json works even when cwd is the repo root. */
function resolveCredentialsPath(credPath) {
  if (!credPath) return '';
  const trimmed = credPath.trim();
  if (!trimmed) return '';
  if (path.isAbsolute(trimmed)) return trimmed;
  const backendRoot = path.join(__dirname, '..');
  return path.join(backendRoot, trimmed);
}

let initAttempted = false;
let initOk = false;
/** Last init failure for logs / health (no secrets). */
let lastInitFailure = '';

/**
 * Parses FIREBASE_SERVICE_ACCOUNT_JSON tolerating common paste mistakes (outer quotes, double-encoded JSON).
 * @returns {{ ok: true, data: object } | { ok: false, reason: string }}
 */
export function parseServiceAccountJsonFromEnv() {
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1).trim();
  if (!raw) {
    return { ok: false, reason: 'FIREBASE_SERVICE_ACCOUNT_JSON is empty or unset on this process.' };
  }
  /* Strip one layer of wrapping quotes sometimes pasted around the whole blob */
  if (
    (raw.startsWith("'") && raw.endsWith("'") && raw.length > 2) ||
    (raw.startsWith('"') && raw.endsWith('"') && raw.length > 2 && raw.slice(1).trim().startsWith('{'))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      reason: `JSON.parse failed (${e?.message || 'syntax'}). Check for truncated paste, smart quotes, or missing braces.`,
    };
  }
  /* Value might be a JSON string containing the real JSON (double-encoded) */
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return { ok: false, reason: `Inner JSON.parse failed (${e?.message || 'syntax'}).` };
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'Parsed value is not a JSON object.' };
  }
  if (typeof parsed.private_key !== 'string' || !parsed.private_key.includes('PRIVATE KEY')) {
    return { ok: false, reason: 'Missing or invalid private_key (expected PEM in JSON).' };
  }
  if (typeof parsed.client_email !== 'string' || !parsed.client_email.includes('@')) {
    return { ok: false, reason: 'Missing client_email in service account JSON.' };
  }
  return { ok: true, data: parsed };
}

/**
 * Initializes Firebase Admin once. Returns false if credentials are missing or invalid.
 */
export function ensureFirebaseAdmin() {
  if (initAttempted) return initOk;
  initAttempted = true;
  lastInitFailure = '';
  try {
    if (admin.apps.length > 0) {
      initOk = true;
      return true;
    }
    const parsedResult = parseServiceAccountJsonFromEnv();
    if (parsedResult.ok) {
      admin.initializeApp({
        credential: admin.credential.cert(parsedResult.data),
      });
      initOk = true;
      const pid = parsedResult.data.project_id || '(unknown)';
      console.log('[firebase-admin] initialized with service account, project_id:', pid);
      return true;
    }
    lastInitFailure = parsedResult.reason || lastInitFailure;
    console.error('[firebase-admin]', lastInitFailure);
    const credPath = resolveCredentialsPath(process.env.GOOGLE_APPLICATION_CREDENTIALS || '');
    if (credPath && fs.existsSync(credPath)) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      initOk = true;
      console.log('[firebase-admin] initialized from GOOGLE_APPLICATION_CREDENTIALS file');
      return true;
    }
  } catch (e) {
    lastInitFailure = e?.message || String(e);
    console.error('[firebase-admin] init failed:', lastInitFailure);
    initOk = false;
    return false;
  }
  initOk = false;
  if (!lastInitFailure) {
    lastInitFailure =
      'No valid FIREBASE_SERVICE_ACCOUNT_JSON and no GOOGLE_APPLICATION_CREDENTIALS file found.';
    console.error('[firebase-admin]', lastInitFailure);
  }
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

/** For /health — no secrets. */
export function getFirebaseAdminHealthInfo() {
  const envSet = Boolean((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim());
  const ready = admin.apps.length > 0 ? true : ensureFirebaseAdmin();
  return {
    firebaseAdminReady: ready,
    firebaseServiceAccountEnvSet: envSet,
    ...(ready ? {} : { firebaseAdminHint: lastInitFailure || 'not_initialized' }),
  };
}

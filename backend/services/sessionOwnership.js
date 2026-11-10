import fs from 'fs';
import path from 'path';
import { verifyFirebaseIdToken, isFirebaseAdminReady } from './firebaseAdmin.js';

/** Extract a `Bearer <token>` from the Authorization header, or '' if absent. */
export function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

/** The Firebase uid that claimed a session (via POST /user-sessions/register), or null if unclaimed. */
export function readSessionOwnerUid(sessionDir) {
  try {
    const p = path.join(sessionDir, 'owner.json');
    if (!fs.existsSync(p)) return null;
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    return o && typeof o.uid === 'string' ? o.uid : null;
  } catch {
    return null;
  }
}

/**
 * Authorize a request to read/mutate a session directory, closing the IDOR where
 * anyone holding a (leaked) sessionId could touch another account's document.
 *
 * - Unclaimed session (no owner.json): allowed — these are the pre-sign-in / anonymous
 *   flow, protected by the unguessable UUID. Returns the caller's verified uid if a
 *   valid bearer is present (used for download metering), else null.
 * - Claimed session (owner.json present): requires a verified Firebase bearer whose uid
 *   matches the owner; otherwise denied.
 *
 * @returns {Promise<{ok:true, uid:string|null} | {ok:false, status:number, body:object}>}
 */
export async function authorizeSessionAccess(req, sessionDir) {
  const ownerUid = readSessionOwnerUid(sessionDir);
  const bearer = readBearerToken(req);

  if (!ownerUid) {
    let uid = null;
    if (bearer && isFirebaseAdminReady()) {
      const u = await verifyFirebaseIdToken(bearer);
      uid = u?.uid || null;
    }
    return { ok: true, uid };
  }

  if (!isFirebaseAdminReady()) {
    return {
      ok: false,
      status: 503,
      body: { error: 'auth_unavailable', message: 'Authentication is not configured on this server.' },
    };
  }
  if (!bearer) {
    return {
      ok: false,
      status: 401,
      body: { error: 'auth_required', message: 'Sign in to access this document.' },
    };
  }
  const user = await verifyFirebaseIdToken(bearer);
  if (!user?.uid) {
    return {
      ok: false,
      status: 401,
      body: { error: 'auth_required', message: 'Your sign-in session expired. Sign in again and retry.' },
    };
  }
  if (user.uid !== ownerUid) {
    return {
      ok: false,
      status: 403,
      body: { error: 'forbidden', message: 'This document belongs to another account.' },
    };
  }
  return { ok: true, uid: user.uid };
}

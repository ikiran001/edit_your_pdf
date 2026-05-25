import { verifyFirebaseIdToken, isFirebaseAdminReady } from '../services/firebaseAdmin.js';

function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

/**
 * Express middleware that allows the request only for any signed-in Firebase user.
 *
 * Unlike requirePro, this does NOT check subscription status — any authenticated user passes.
 *
 * Responses:
 *  - 503 `{ error, code: 'auth_unavailable' }` — backend Firebase Admin is not configured.
 *  - 401 `{ error, code: 'auth_required' }`   — missing or invalid `Authorization: Bearer <id-token>`.
 *
 * On success: attaches `req.user = { uid, email }` and calls `next()`.
 */
export async function requireAuth(req, res, next) {
  if (!isFirebaseAdminReady()) {
    return res
      .status(503)
      .json({
        error: 'Authentication is not configured on this server.',
        code: 'auth_unavailable',
      });
  }
  const token = readBearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({
        error: 'Sign in to use this feature.',
        code: 'auth_required',
      });
  }
  const decoded = await verifyFirebaseIdToken(token);
  if (!decoded?.uid) {
    return res
      .status(401)
      .json({
        error: 'Your sign-in session expired. Sign in again and retry.',
        code: 'auth_required',
      });
  }
  req.user = { uid: decoded.uid, email: decoded.email };
  return next();
}

import { verifyFirebaseIdToken, isFirebaseAdminReady } from '../services/firebaseAdmin.js';
import { readSubscriptionSummary } from '../services/subscriptionFirestore.js';

function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

/**
 * Express middleware that allows the request only for authenticated Pro subscribers.
 *
 * Responses:
 *  - 503 `{ error, code: 'auth_unavailable' }` — backend Firebase Admin / Firestore is not configured.
 *  - 401 `{ error, code: 'auth_required' }`   — missing or invalid `Authorization: Bearer <id-token>`.
 *  - 403 `{ error, code: 'pro_required' }`    — authenticated but the subscription is not active Pro.
 *
 * On success: attaches `req.user = { uid, email, subscription }` and calls `next()`.
 */
export async function requirePro(req, res, next) {
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
  let summary;
  try {
    summary = await readSubscriptionSummary(decoded.uid);
  } catch (e) {
    console.error('[requirePro] subscription lookup failed', e?.message || e);
    return res
      .status(503)
      .json({
        error: 'Could not verify your subscription. Try again in a moment.',
        code: 'auth_unavailable',
      });
  }
  if (!summary.isPaid) {
    return res
      .status(403)
      .json({
        error: 'This feature is part of pdfpilot Pro. Upgrade to continue.',
        code: 'pro_required',
        plan: summary.effectivePlan,
      });
  }
  req.user = { uid: decoded.uid, email: decoded.email, subscription: summary };
  return next();
}

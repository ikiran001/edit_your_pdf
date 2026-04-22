import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tryConsumeOneTimeDownloadToken } from '../services/sessionDownloadToken.js';
import { verifyFirebaseIdToken, isFirebaseAdminReady } from '../services/firebaseAdmin.js';
import {
  isDownloadAuthEnabled,
  isFirstAnonymousDownloadEnabled,
} from '../services/downloadAuthPolicy.js';
import { reserveAuthenticatedDownload } from '../services/subscriptionFirestore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

function pipePdf(res, filePath) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="edited.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
}

/**
 * Free-tier daily limits apply to signed-in downloads whenever we can verify the Firebase uid
 * (even if DOWNLOAD_AUTH_ENABLED is false — beta often turns download auth off but still uses accounts).
 * @param {import('express').Response} res
 * @param {string | null} authedUid
 * @returns {Promise<boolean>} false if response already sent with an error
 */
async function enforceSubscriptionForSignedInUser(res, authedUid) {
  if (!authedUid) return true;
  try {
    await reserveAuthenticatedDownload(authedUid);
    return true;
  } catch (e) {
    if (e?.code === 'DOWNLOAD_LIMIT_EXCEEDED') {
      res.status(403).json({
        error: 'download_limit_exceeded',
        message:
          'You have used all free downloads for today (3 per day, UTC). Upgrade to Pro for unlimited downloads.',
        ...(e.meta && typeof e.meta === 'object' ? e.meta : {}),
      });
      return false;
    }
    if (e?.code === 'SUBSCRIPTION_SERVICE_UNAVAILABLE') {
      res.status(503).json({
        error: 'subscription_unavailable',
        message: 'Could not verify download allowance. Try again shortly.',
      });
      return false;
    }
    console.error('[download] subscription check:', e?.message || e);
    res.status(503).json({
      error: 'subscription_check_failed',
      message: 'Could not verify download allowance. Try again shortly.',
    });
    return false;
  }
}

/**
 * GET /download?sessionId=…&downloadToken=… (optional)
 * When DOWNLOAD_AUTH_ENABLED: requires Firebase ID token OR valid one-time downloadToken (if enabled).
 * When DOWNLOAD_AUTH_ENABLED is off: open download, but still enforces Pro/free limits if a valid Bearer is sent.
 */
router.get('/download', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'sessionId query required' });
  }
  const editedPath = path.join(uploadsRoot, sessionId, 'edited.pdf');
  const originalPath = path.join(uploadsRoot, sessionId, 'original.pdf');
  const filePath = fs.existsSync(editedPath) ? editedPath : originalPath;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'not_found', message: 'Not found' });
  }

  const bearer = readBearerToken(req);
  let authedUid = null;
  if (bearer && isFirebaseAdminReady()) {
    const user = await verifyFirebaseIdToken(bearer);
    if (user) authedUid = user.uid;
  }

  if (!isDownloadAuthEnabled()) {
    if (!(await enforceSubscriptionForSignedInUser(res, authedUid))) return;
    pipePdf(res, filePath);
    return;
  }

  if (!isFirebaseAdminReady()) {
    console.error(
      '[download] DOWNLOAD_AUTH_ENABLED but Firebase Admin is not configured (FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS)'
    );
    return res.status(503).json({
      error: 'download_auth_misconfigured',
      message: 'Download is temporarily unavailable.',
    });
  }

  const sessionDir = path.join(uploadsRoot, sessionId);
  let allowed = Boolean(authedUid);
  const downloadToken =
    typeof req.query.downloadToken === 'string' ? req.query.downloadToken.trim() : '';

  if (!allowed && isFirstAnonymousDownloadEnabled() && downloadToken) {
    allowed = tryConsumeOneTimeDownloadToken(sessionDir, downloadToken);
  }

  if (!allowed) {
    return res.status(401).json({
      error: 'download_auth_required',
      message: 'Continue with Google or Apple to download your file.',
    });
  }

  if (!(await enforceSubscriptionForSignedInUser(res, authedUid))) return;

  pipePdf(res, filePath);
});

export default router;

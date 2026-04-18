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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

/**
 * GET /download?sessionId=…&downloadToken=… (optional)
 * When DOWNLOAD_AUTH_ENABLED: requires Firebase ID token OR valid one-time downloadToken (if enabled).
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

  if (!isDownloadAuthEnabled()) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="edited.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
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

  const bearer = readBearerToken(req);
  let authedUid = null;
  if (bearer) {
    const user = await verifyFirebaseIdToken(bearer);
    if (user) authedUid = user.uid;
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

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="edited.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
});

export default router;

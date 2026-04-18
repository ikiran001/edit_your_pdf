import { Router } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyFirebaseIdToken, isFirebaseAdminReady } from '../services/firebaseAdmin.js';
import {
  deleteUserLibraryDoc,
  listUserLibraryDocs,
  upsertUserLibraryDoc,
} from '../services/userLibraryAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

/** Same rule as upload `uuid` v4 session ids. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidSessionId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

function clampFileName(name) {
  const s = String(name || 'document.pdf').trim().slice(0, 240) || 'document.pdf';
  return s.replace(/[\r\n\0]/g, '_');
}

function clampTool(tool) {
  const s = String(tool || 'edit_pdf').trim().slice(0, 64) || 'edit_pdf';
  return s.replace(/[^\w.-]/g, '_');
}

const router = Router();

/**
 * POST /user-sessions/register
 * Body: { sessionId, fileName?, tool? }
 * Writes uploads/{sessionId}/owner.json so cleanup keeps the folder longer for signed-in users.
 */
router.post('/user-sessions/register', express.json({ limit: '32kb' }), async (req, res) => {
  if (!isFirebaseAdminReady()) {
    return res.status(503).json({
      error: 'auth_unavailable',
      message: 'Server cannot verify sign-in (Firebase Admin not configured).',
    });
  }
  const token = readBearerToken(req);
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: 'Valid sign-in required.' });
  }
  const sessionId = req.body?.sessionId;
  if (!isUuidSessionId(sessionId)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid sessionId' });
  }
  const dir = path.join(uploadsRoot, sessionId);
  const original = path.join(dir, 'original.pdf');
  if (!fs.existsSync(original)) {
    return res.status(404).json({ error: 'not_found', message: 'Session not found' });
  }
  const ownerPath = path.join(dir, 'owner.json');
  if (fs.existsSync(ownerPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
      if (prev && typeof prev.uid === 'string' && prev.uid !== user.uid) {
        return res.status(403).json({ error: 'forbidden', message: 'Session belongs to another account.' });
      }
    } catch {
      /* overwrite corrupt owner.json */
    }
  }
  const payload = {
    uid: user.uid,
    updatedAt: Date.now(),
    fileName: clampFileName(req.body?.fileName),
    tool: clampTool(req.body?.tool),
  };
  try {
    fs.writeFileSync(ownerPath, JSON.stringify(payload), 'utf8');
  } catch (e) {
    console.error('[user-sessions] owner.json write failed:', e?.message || e);
    return res.status(500).json({ error: 'write_failed', message: 'Could not save session ownership.' });
  }
  let libraryIndexed = false;
  try {
    libraryIndexed = await upsertUserLibraryDoc(
      user.uid,
      sessionId,
      payload.fileName,
      payload.tool
    );
  } catch (e) {
    console.error('[user-sessions] Firestore library upsert failed:', e?.message || e);
  }
  return res.json({ ok: true, libraryIndexed });
});

/**
 * GET /user-sessions/library
 * Lists My Documents for the signed-in user (Firestore via Admin — no client rules required).
 */
router.get('/user-sessions/library', async (req, res) => {
  if (!isFirebaseAdminReady()) {
    /* 200 so the SPA can show setup instructions instead of a hard “load failed” error. */
    return res.json({
      documents: [],
      adminConfigured: false,
      message:
        'Firebase Admin is not configured on this API. Set FIREBASE_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS) on the server, restart, and enable Firestore on the same Firebase project.',
    });
  }
  const token = readBearerToken(req);
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: 'Valid sign-in required.' });
  }
  try {
    const documents = await listUserLibraryDocs(user.uid);
    return res.json({ documents, adminConfigured: true });
  } catch (e) {
    console.error('[user-sessions] library list failed:', e?.message || e);
    return res.status(500).json({
      error: 'library_list_failed',
      message: e?.message || 'Could not load library (enable Firestore on the Firebase project).',
    });
  }
});

/**
 * DELETE /user-sessions/:sessionId
 * Removes the session directory when the bearer matches owner.json.
 */
router.delete('/user-sessions/:sessionId', async (req, res) => {
  if (!isFirebaseAdminReady()) {
    return res.status(503).json({
      error: 'auth_unavailable',
      message: 'Server cannot verify sign-in (Firebase Admin not configured).',
    });
  }
  const token = readBearerToken(req);
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: 'Valid sign-in required.' });
  }
  const sessionId = req.params.sessionId;
  if (!isUuidSessionId(sessionId)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid sessionId' });
  }
  const dir = path.join(uploadsRoot, sessionId);
  const ownerPath = path.join(dir, 'owner.json');
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'not_found', message: 'Session not found' });
  }
  let ownerUid = null;
  if (fs.existsSync(ownerPath)) {
    try {
      const o = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
      if (o && typeof o.uid === 'string') ownerUid = o.uid;
    } catch {
      /* fall through */
    }
  }
  if (ownerUid !== user.uid) {
    return res.status(403).json({ error: 'forbidden', message: 'You cannot delete this session.' });
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.error('[user-sessions] delete failed:', e?.message || e);
    return res.status(500).json({ error: 'delete_failed', message: 'Could not remove session files.' });
  }
  try {
    await deleteUserLibraryDoc(user.uid, sessionId);
  } catch (e) {
    console.warn('[user-sessions] library doc delete:', e?.message || e);
  }
  return res.json({ ok: true });
});

export default router;

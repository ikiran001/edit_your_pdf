import { Router } from 'express';
import express from 'express';
import crypto from 'crypto';
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

/** Anonymous one-time download token — must not be cloned to a new session. */
const ONE_TIME_DOWNLOAD_FILE = '.eyp-one-time-download.json';

/**
 * Copies session files to a new directory. Skips one-time download token and owner.json
 * (caller writes a fresh owner.json for the new session).
 */
function copyUploadSessionTree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (ent.name === ONE_TIME_DOWNLOAD_FILE || ent.name === 'owner.json') continue;
    const from = path.join(srcDir, ent.name);
    const to = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      copyUploadSessionTree(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

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
 * POST /user-sessions/duplicate
 * Body: { sourceSessionId, fileName? }
 * Copies uploads/{sourceSessionId}/ to a new UUID folder, writes owner.json for the caller,
 * and upserts Firestore library metadata.
 */
router.post('/user-sessions/duplicate', express.json({ limit: '32kb' }), async (req, res) => {
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
  const sourceSessionId = req.body?.sourceSessionId;
  if (!isUuidSessionId(sourceSessionId)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid sourceSessionId' });
  }
  const srcDir = path.join(uploadsRoot, sourceSessionId);
  const original = path.join(srcDir, 'original.pdf');
  if (!fs.existsSync(original)) {
    return res.status(404).json({ error: 'not_found', message: 'Session not found' });
  }
  const srcOwnerPath = path.join(srcDir, 'owner.json');
  if (!fs.existsSync(srcOwnerPath)) {
    return res.status(403).json({
      error: 'forbidden',
      message:
        'This session is not claimed on the server yet. Use Save PDF once while signed in, then try again.',
    });
  }
  let srcOwnerUid = null;
  let srcTool = 'edit_pdf';
  try {
    const o = JSON.parse(fs.readFileSync(srcOwnerPath, 'utf8'));
    if (o && typeof o.uid === 'string') srcOwnerUid = o.uid;
    if (o && typeof o.tool === 'string') srcTool = clampTool(o.tool);
  } catch {
    /* fall through */
  }
  if (srcOwnerUid !== user.uid) {
    return res.status(403).json({ error: 'forbidden', message: 'You can only duplicate your own sessions.' });
  }

  const fileName = clampFileName(req.body?.fileName);
  const newSessionId = crypto.randomUUID();
  const destDir = path.join(uploadsRoot, newSessionId);
  if (fs.existsSync(destDir)) {
    return res.status(409).json({ error: 'conflict', message: 'Could not allocate a new session id.' });
  }
  try {
    copyUploadSessionTree(srcDir, destDir);
  } catch (e) {
    console.error('[user-sessions] duplicate copy failed:', e?.message || e);
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return res.status(500).json({ error: 'copy_failed', message: 'Could not copy session files.' });
  }
  const ownerPayload = {
    uid: user.uid,
    updatedAt: Date.now(),
    fileName,
    tool: srcTool,
  };
  try {
    fs.writeFileSync(path.join(destDir, 'owner.json'), JSON.stringify(ownerPayload), 'utf8');
  } catch (e) {
    console.error('[user-sessions] duplicate owner write failed:', e?.message || e);
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return res.status(500).json({ error: 'write_failed', message: 'Could not finalize the new session.' });
  }
  let libraryIndexed = false;
  try {
    libraryIndexed = await upsertUserLibraryDoc(user.uid, newSessionId, fileName, srcTool);
  } catch (e) {
    console.error('[user-sessions] duplicate Firestore upsert failed:', e?.message || e);
  }
  return res.json({ ok: true, newSessionId, fileName, libraryIndexed });
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
 * PATCH /user-sessions/:sessionId
 * Body: { fileName }
 * Updates uploads/{sessionId}/owner.json display name and Firestore library row.
 */
router.patch('/user-sessions/:sessionId', express.json({ limit: '32kb' }), async (req, res) => {
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
  const original = path.join(dir, 'original.pdf');
  const ownerPath = path.join(dir, 'owner.json');
  if (!fs.existsSync(original)) {
    return res.status(404).json({ error: 'not_found', message: 'Session not found' });
  }
  if (!fs.existsSync(ownerPath)) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'This session has no owner record; open it in the editor and use Save PDF while signed in first.',
    });
  }
  let ownerUid = null;
  let tool = 'edit_pdf';
  try {
    const o = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
    if (o && typeof o.uid === 'string') ownerUid = o.uid;
    if (o && typeof o.tool === 'string') tool = clampTool(o.tool);
  } catch {
    return res.status(500).json({ error: 'owner_corrupt', message: 'Could not read session ownership.' });
  }
  if (ownerUid !== user.uid) {
    return res.status(403).json({ error: 'forbidden', message: 'You cannot rename this session.' });
  }
  const fileName = clampFileName(req.body?.fileName);
  const payload = {
    uid: user.uid,
    updatedAt: Date.now(),
    fileName,
    tool,
  };
  try {
    fs.writeFileSync(ownerPath, JSON.stringify(payload), 'utf8');
  } catch (e) {
    console.error('[user-sessions] rename owner write failed:', e?.message || e);
    return res.status(500).json({ error: 'write_failed', message: 'Could not update session metadata.' });
  }
  let libraryIndexed = false;
  try {
    libraryIndexed = await upsertUserLibraryDoc(user.uid, sessionId, fileName, tool);
  } catch (e) {
    console.error('[user-sessions] rename Firestore upsert failed:', e?.message || e);
  }
  return res.json({ ok: true, fileName, libraryIndexed });
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

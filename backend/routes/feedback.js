import { randomUUID, timingSafeEqual } from 'crypto';
import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'site-feedback.json');

const MAX_STORED = 2000;
const MAX_PUBLIC = 80;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

/** @type {Map<string, number[]>} */
const rateBuckets = new Map();

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function readAll() {
  try {
    if (!fs.existsSync(dataFile)) return [];
    const raw = fs.readFileSync(dataFile, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function writeAll(arr) {
  ensureDataDir();
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(arr), 'utf8');
  fs.renameSync(tmp, dataFile);
}

function adminSecretConfigured() {
  const s = process.env.FEEDBACK_ADMIN_SECRET;
  return typeof s === 'string' && s.trim().length >= 16;
}

function bearerToken(req) {
  const h = req.headers?.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

function adminAuthOk(req) {
  if (!adminSecretConfigured()) return false;
  const tok = bearerToken(req);
  const secret = String(process.env.FEEDBACK_ADMIN_SECRET || '').trim();
  if (!tok) return false;
  try {
    const a = Buffer.from(secret, 'utf8');
    const b = Buffer.from(tok, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!adminSecretConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Admin feedback is not configured. Set FEEDBACK_ADMIN_SECRET (at least 16 characters) on the API.',
    });
  }
  if (!adminAuthOk(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

function allowRate(ip) {
  const now = Date.now();
  const prev = rateBuckets.get(ip) || [];
  const next = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (next.length >= RATE_MAX) return false;
  next.push(now);
  rateBuckets.set(ip, next);
  return true;
}

const router = Router();
const postJson = express.json({ limit: '24kb' });

router.get('/feedback/admin', requireAdmin, (_req, res) => {
  const all = readAll();
  const sorted = [...all].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const reviews = sorted.map((row) => ({
    id: row.id,
    name: row.name ?? null,
    rating: row.rating,
    text: row.text,
    createdAt: row.createdAt,
    source: row.source ?? null,
  }));
  res.json({ ok: true, total: reviews.length, reviews });
});

router.post('/feedback/admin', requireAdmin, postJson, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ ok: false, error: 'Rating must be an integer from 1 to 5.' });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 4 || text.length > 2000) {
    return res.status(400).json({
      ok: false,
      error: 'Text must be at least 4 characters and at most 2000 characters.',
    });
  }
  let name = null;
  if (body.name != null && String(body.name).trim()) {
    name = String(body.name).trim().slice(0, 80);
    if (!name) name = null;
  }
  let source = 'admin';
  if (typeof body.source === 'string' && body.source.trim()) {
    source = body.source.trim().slice(0, 40);
  }
  const entry = {
    id: randomUUID(),
    name,
    rating,
    text,
    createdAt: new Date().toISOString(),
    source,
  };
  const all = readAll();
  all.push(entry);
  const capped = all.length > MAX_STORED ? all.slice(-MAX_STORED) : all;
  try {
    writeAll(capped);
  } catch (e) {
    console.error('[feedback] admin write failed:', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Could not save review.' });
  }
  return res.status(201).json({
    ok: true,
    review: {
      id: entry.id,
      name: entry.name,
      rating: entry.rating,
      text: entry.text,
      createdAt: entry.createdAt,
      source: entry.source,
    },
  });
});

router.delete('/feedback/admin/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Missing id' });
  }
  const all = readAll();
  const next = all.filter((row) => String(row.id) !== id);
  if (next.length === all.length) {
    return res.status(404).json({ ok: false, error: 'Review not found' });
  }
  try {
    writeAll(next);
  } catch (e) {
    console.error('[feedback] admin delete failed:', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Could not delete review.' });
  }
  return res.json({ ok: true });
});

router.get('/feedback', (_req, res) => {
  const all = readAll();
  const sorted = [...all].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const reviews = sorted.slice(0, MAX_PUBLIC).map((row) => ({
    id: row.id,
    name: row.name ?? null,
    rating: row.rating,
    text: row.text,
    createdAt: row.createdAt,
  }));
  res.json({ ok: true, reviews });
});

router.post('/feedback', postJson, (req, res) => {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  if (!allowRate(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many submissions from this network. Try again in an hour.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ ok: false, error: 'Please choose a star rating from 1 to 5.' });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 4 || text.length > 2000) {
    return res.status(400).json({
      ok: false,
      error: 'Feedback must be at least 4 characters and at most 2000 characters.',
    });
  }

  let name = null;
  if (body.name != null && String(body.name).trim()) {
    name = String(body.name).trim().slice(0, 80);
    if (!name) name = null;
  }

  let source = 'home';
  if (typeof body.source === 'string' && body.source.trim()) {
    source = body.source.trim().slice(0, 40);
  }

  const entry = {
    id: randomUUID(),
    name,
    rating,
    text,
    createdAt: new Date().toISOString(),
    source,
  };

  const all = readAll();
  all.push(entry);
  const capped = all.length > MAX_STORED ? all.slice(-MAX_STORED) : all;
  try {
    writeAll(capped);
  } catch (e) {
    console.error('[feedback] write failed:', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Could not save feedback. Please try again later.' });
  }

  return res.status(201).json({
    ok: true,
    review: {
      id: entry.id,
      name: entry.name,
      rating: entry.rating,
      text: entry.text,
      createdAt: entry.createdAt,
    },
  });
});

export default router;

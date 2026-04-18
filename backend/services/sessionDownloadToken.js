import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = '.eyp-one-time-download.json';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Creates a single-use download token for an upload session (server-side only until first download).
 * @param {string} sessionDir absolute path to uploads/{sessionId}
 * @returns {string} opaque token to return to the client once
 */
export function createOneTimeDownloadToken(sessionDir) {
  const token = crypto.randomBytes(32).toString('hex');
  const payload = JSON.stringify({ token, createdAt: Date.now() });
  fs.writeFileSync(path.join(sessionDir, TOKEN_FILE), payload, { mode: 0o600 });
  return token;
}

/**
 * Validates token and deletes the grant file so it cannot be reused.
 * @param {string} sessionDir
 * @param {string} clientToken
 * @returns {boolean}
 */
export function tryConsumeOneTimeDownloadToken(sessionDir, clientToken) {
  if (typeof clientToken !== 'string' || clientToken.length < 32) return false;
  const filePath = path.join(sessionDir, TOKEN_FILE);
  if (!fs.existsSync(filePath)) return false;
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    return false;
  }
  if (!stored || typeof stored.token !== 'string') {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    return false;
  }
  const ok = timingSafeEqual(stored.token, clientToken);
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
  return ok;
}

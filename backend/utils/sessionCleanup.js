import fs from 'fs';
import path from 'path';

/** Anonymous uploads: short TTL. */
const MAX_AGE_ANONYMOUS_MS = 60 * 60 * 1000; // 1 hour
/** Folders with `owner.json` from POST /user-sessions/register (signed-in library). */
const MAX_AGE_OWNER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readOwnerUid(dir) {
  try {
    const p = path.join(dir, 'owner.json');
    if (!fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j && typeof j.uid === 'string' && j.uid.length > 8) return j.uid;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Periodically removes stale upload directories under `uploadsDir`.
 */
export function startSessionCleanup(uploadsDir) {
  const run = () => {
    try {
      if (!fs.existsSync(uploadsDir)) return;
      const now = Date.now();
      for (const name of fs.readdirSync(uploadsDir)) {
        const dir = path.join(uploadsDir, name);
        if (!fs.statSync(dir).isDirectory()) continue;
        const stat = fs.statSync(dir);
        const maxAge = readOwnerUid(dir) ? MAX_AGE_OWNER_MS : MAX_AGE_ANONYMOUS_MS;
        if (now - stat.mtimeMs > maxAge) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    } catch (e) {
      console.error('sessionCleanup:', e.message);
    }
  };
  run();
  setInterval(run, 15 * 60 * 1000);
}

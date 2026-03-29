import fs from 'fs';
import path from 'path';

/** Max age for session folders (ms); aligns with “auto-delete after session”. */
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

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
        if (now - stat.mtimeMs > MAX_AGE_MS) {
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

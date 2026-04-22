import fs from 'fs';
import { execFileSync } from 'child_process';

let cached = undefined;

/**
 * Resolve `ocrmypdf` binary (Docker/Debian: `apt install ocrmypdf`).
 * @returns {string | null}
 */
export function getOcrmypdfBinary() {
  if (cached !== undefined) return cached;

  const fromEnv = process.env.OCRMYPDF_BIN?.trim();
  if (fromEnv) {
    try {
      if (fs.existsSync(fromEnv) && fs.statSync(fromEnv).isFile()) {
        cached = fromEnv;
        return cached;
      }
    } catch {
      /* ignore */
    }
    cached = null;
    return cached;
  }

  const candidates = ['/usr/bin/ocrmypdf', '/usr/local/bin/ocrmypdf'];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        cached = p;
        return cached;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const out = execFileSync('which', ['ocrmypdf'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const line = out.trim().split('\n')[0]?.trim();
    if (line && fs.existsSync(line)) {
      cached = line;
      return cached;
    }
  } catch {
    /* ignore */
  }

  cached = null;
  return cached;
}

export function resetOcrmypdfBinaryCache() {
  cached = undefined;
}

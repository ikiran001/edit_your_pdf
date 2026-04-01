import fs from 'fs';
import { execFileSync } from 'child_process';

let cached = undefined;

/**
 * Resolve path to qpdf binary. Set QPDF_BIN in production if needed.
 * @returns {string | null}
 */
export function getQpdfBinary() {
  if (cached !== undefined) return cached;

  const fromEnv = process.env.QPDF_BIN?.trim();
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

  const candidates = ['/usr/bin/qpdf', '/usr/local/bin/qpdf', '/bin/qpdf'];
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
    const out = execFileSync('which', ['qpdf'], {
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

/** Clear cache (tests). */
export function resetQpdfBinaryCache() {
  cached = undefined;
}

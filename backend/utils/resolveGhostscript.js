import fs from 'fs';
import { execFileSync } from 'child_process';

let cached = undefined;

/**
 * Ghostscript is preinstalled on Render native deploy images (see Render docs: Deploys → ghostscript).
 * Used as fallback when qpdf is unavailable.
 */
export function getGhostscriptBinary() {
  if (cached !== undefined) return cached;

  const fromEnv = process.env.GS_BIN?.trim();
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

  const candidates = ['/usr/bin/gs', '/usr/local/bin/gs', '/bin/gs'];
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
    const out = execFileSync('which', ['gs'], {
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

export function resetGhostscriptBinaryCache() {
  cached = undefined;
}

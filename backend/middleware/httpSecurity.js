import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

function intEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default Helmet for a JSON/PDF API served to browser clients on another origin (SPA). */
export function securityHelmet() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/**
 * CORS: if `ALLOWED_ORIGINS` is set (comma-separated), only those origins may use credentialed requests.
 * If unset, reflects `Origin` (previous behaviour) — fine for local dev; production should set the allowlist.
 */
export function securityCors() {
  const raw = process.env.ALLOWED_ORIGINS;
  const list =
    raw && raw.trim()
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

  if (process.env.NODE_ENV === 'production' && (!list || list.length === 0)) {
    console.warn(
      '[cors] ALLOWED_ORIGINS is empty — any browser origin is accepted. Set comma-separated origins (e.g. https://pdfpilot.pro) for strict CORS.'
    );
  }

  const origin =
    !list || list.length === 0
      ? true
      : (requestOrigin, cb) => {
          if (!requestOrigin) return cb(null, true);
          if (list.includes(requestOrigin)) return cb(null, true);
          return cb(null, false);
        };

  return cors({
    origin,
    credentials: true,
    exposedHeaders: ['X-OCR-Page-Count', 'X-OCR-Truncated', 'X-OCR-Original-Pages'],
  });
}

export const cpuHeavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: intEnv('RATE_LIMIT_CPU_HEAVY_MAX', 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many heavy requests from this network. Try again in a few minutes.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: intEnv('RATE_LIMIT_UPLOAD_MAX', 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many uploads from this network. Try again in a few minutes.' },
});

/** `/edit` can be chatty during autosave — keep generous but bounded. */
export const editLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: intEnv('RATE_LIMIT_EDIT_MAX', 400),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many save requests from this network. Try again in a few minutes.' },
});

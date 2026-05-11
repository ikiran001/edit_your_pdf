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
 * In production, missing/empty allowlist denies cross-origin requests (set the env var explicitly).
 * In dev, an empty allowlist reflects the request origin so localhost on any port works.
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

  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && (!list || list.length === 0)) {
    console.warn(
      '[cors] ALLOWED_ORIGINS is empty in production — denying all cross-origin requests. Set comma-separated origins (e.g. https://pdfpilot.pro) to allow.'
    );
  }

  let origin;
  if (list && list.length > 0) {
    origin = (requestOrigin, cb) => {
      if (!requestOrigin) return cb(null, true);
      if (list.includes(requestOrigin)) return cb(null, true);
      return cb(null, false);
    };
  } else if (isProd) {
    origin = (requestOrigin, cb) => (requestOrigin ? cb(null, false) : cb(null, true));
  } else {
    origin = true;
  }

  return cors({
    origin,
    credentials: true,
    exposedHeaders: ['X-OCR-Page-Count', 'X-OCR-Truncated', 'X-OCR-Original-Pages'],
  });
}

/**
 * Heavy ops (compress/ocr/repair/unlock/encrypt/document-flow) each spend ~10–60s of CPU
 * per request, so the per-IP budget is much smaller than upload/edit. Override via env if needed.
 */
export const cpuHeavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: intEnv('RATE_LIMIT_CPU_HEAVY_MAX', 15),
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

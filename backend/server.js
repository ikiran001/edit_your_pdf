import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import uploadRouter from './routes/upload.js';
import editRouter from './routes/edit.js';
import downloadRouter from './routes/download.js';
import unlockRouter from './routes/unlock.js';
import ocrPdfRouter from './routes/ocrPdf.js';
import encryptRouter from './routes/encrypt.js';
import compressPdfRouter from './routes/compressPdf.js';
import repairPdfRouter from './routes/repairPdf.js';
import documentFlowRouter from './routes/documentFlow.js';
import userSessionsRouter from './routes/userSessions.js';
import feedbackRouter from './routes/feedback.js';
import subscriptionRouter, { handleRazorpayWebhook } from './routes/subscription.js';
import { getDocumentFlowCapabilities } from './services/documentFlowConvert.js';
import { isDownloadAuthEnabled, isFirstAnonymousDownloadEnabled } from './services/downloadAuthPolicy.js';
import { getFirebaseAdminHealthInfo, isFirebaseAdminReady } from './services/firebaseAdmin.js';
import { startSessionCleanup } from './utils/sessionCleanup.js';
import { getQpdfBinary } from './utils/resolveQpdf.js';
import { getGhostscriptBinary } from './utils/resolveGhostscript.js';
import { getOcrmypdfBinary } from './utils/resolveOcrmypdf.js';
import { ensureNotoFontsReady } from './services/pdfUnicodeFonts.js';
import {
  cpuHeavyLimiter,
  editLimiter,
  securityCors,
  securityHelmet,
  uploadLimiter,
} from './middleware/httpSecurity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Optional local overrides (gitignored). Skips keys already set to a non-empty value in the shell. */
function loadBackendDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Treat empty shell values as unset so backend/.env can fill SOFFICE_PATH and similar.
      if (key && (process.env[key] === undefined || process.env[key] === '')) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    console.warn('[env] could not read .env:', e?.message || e);
  }
}
loadBackendDotEnv();

const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY_HOPS === '0' ? false : Number(process.env.TRUST_PROXY_HOPS || 1));
app.use(securityHelmet());
app.use(securityCors());

const healthVerbose =
  process.env.HEALTH_VERBOSE === '1' ||
  process.env.HEALTH_VERBOSE === 'true' ||
  process.env.NODE_ENV !== 'production';

/** Root URL — browsers and uptime checks often hit `/` first (Docker/Render default). */
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>pdfpilot API</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;line-height:1.5">
<h1 style="font-size:1.25rem">pdfpilot API</h1>
<p>This URL is the <strong>backend</strong> for the PDF editor and tools. There is no web app here — open your <strong>frontend</strong> site instead.</p>
<p>Useful checks: <a href="/health">GET /health</a> · <a href="/document-flow/capabilities">GET /document-flow/capabilities</a></p>
</body></html>`);
    return;
  }
  res.json({
    ok: true,
    service: 'pdfpilot-api',
    message: 'Backend only — open the frontend app in the browser.',
    get: { health: '/health', documentFlowCapabilities: '/document-flow/capabilities' },
  });
});

/** Production check: GET https://your-api.onrender.com/health — minimal JSON unless `HEALTH_VERBOSE=1` or non-production. */
app.get('/health', (_req, res) => {
  if (!healthVerbose) {
    return res.json({ ok: true, service: 'pdfpilot-api' });
  }

  const qpdfBin = getQpdfBinary();
  let qpdfVersion = null;
  if (qpdfBin) {
    try {
      qpdfVersion = execFileSync(qpdfBin, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0];
    } catch {
      qpdfVersion = null;
    }
  }

  const gsBin = getGhostscriptBinary();
  let gsVersion = null;
  if (gsBin) {
    try {
      gsVersion = execFileSync(gsBin, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0];
    } catch {
      gsVersion = null;
    }
  }

  const unlock =
    qpdfBin && qpdfVersion ? 'qpdf' : gsBin && gsVersion ? 'ghostscript' : 'none';

  const ocrmypdfBin = getOcrmypdfBinary();
  let ocrmypdfVersion = null;
  if (ocrmypdfBin) {
    try {
      ocrmypdfVersion = execFileSync(ocrmypdfBin, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0];
    } catch {
      ocrmypdfVersion = null;
    }
  }

  res.json({
    ok: true,
    /** Client tools should POST; GET returns 405 (see route in compressPdf.js). */
    compressPdf: 'POST /compress-pdf',
    repairPdf: 'POST /repair-pdf',
    qpdf: Boolean(qpdfBin && qpdfVersion),
    qpdfPath: qpdfBin,
    qpdfVersion,
    ghostscript: Boolean(gsBin && gsVersion),
    ghostscriptPath: gsBin,
    ghostscriptVersion: gsVersion,
    unlock,
    ocrmypdf: Boolean(ocrmypdfBin && ocrmypdfVersion),
    ocrmypdfPath: ocrmypdfBin,
    ocrmypdfVersion,
    /** Present on builds that include Razorpay + Firestore billing routes (404 on /subscription/me = stale deploy). */
    subscription: {
      me: '/subscription/me',
      razorpayOrder: '/subscription/razorpay/order',
      razorpayVerify: '/subscription/razorpay/verify',
      webhook: '/subscription/webhooks/razorpay',
    },
    ...getFirebaseAdminHealthInfo(),
  });
});

app.post(
  '/subscription/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

app.use('/ocr-pdf', cpuHeavyLimiter);
app.use('/compress-pdf', cpuHeavyLimiter);
app.use('/document-flow', cpuHeavyLimiter);
app.use('/unlock-pdf', cpuHeavyLimiter);
app.use('/encrypt-pdf', cpuHeavyLimiter);
app.use('/repair-pdf', cpuHeavyLimiter);
app.use('/upload', uploadLimiter);
app.use('/edit', editLimiter);

app.use(uploadRouter);
app.use(editRouter);
app.use(downloadRouter);
app.use(unlockRouter);
app.use(ocrPdfRouter);
app.use(encryptRouter);
app.use(compressPdfRouter);
app.use(repairPdfRouter);
app.use(documentFlowRouter);
app.use(userSessionsRouter);
app.use(feedbackRouter);
app.use(subscriptionRouter);
console.log(
  '[subscription] mounted: GET /subscription/me, POST /subscription/razorpay/order, POST /subscription/razorpay/verify, POST /subscription/webhooks/razorpay'
);

/** Serve PDF for pdf.js: latest edited file when present, else original upload. */
app.get('/pdf/:sessionId', (req, res) => {
  const dir = path.join(uploadsDir, req.params.sessionId);
  const edited = path.join(dir, 'edited.pdf');
  const original = path.join(dir, 'original.pdf');
  const p = fs.existsSync(edited) ? edited : original;
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(p).pipe(res);
});

startSessionCleanup(uploadsDir);

function logUnlockBackends() {
  const q = getQpdfBinary();
  if (q) {
    try {
      const v = execFileSync(q, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0];
      console.log('[unlock] qpdf —', q, '—', v);
    } catch {
      console.warn('[unlock] qpdf path set but --version failed:', q);
    }
  } else {
    console.log('[unlock] qpdf not on PATH (optional if Ghostscript is available)');
  }

  const g = getGhostscriptBinary();
  if (g) {
    try {
      const v = execFileSync(g, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0];
      console.log('[unlock] ghostscript —', g, '—', v);
    } catch {
      console.warn('[unlock] ghostscript path set but --version failed:', g);
    }
  } else {
    console.warn('[unlock] ghostscript not found — install gs or qpdf for /unlock-pdf');
  }
}
logUnlockBackends();

const docFlow = getDocumentFlowCapabilities();
console.log(
  '[document-flow]',
  docFlow.pdfToDocx ? 'PDF→DOCX' : 'PDF→DOCX off',
  '·',
  docFlow.pdfToXlsx ? 'PDF→XLSX' : 'PDF→XLSX off',
  '·',
  docFlow.officeToPdf ? 'Office→PDF' : 'Office→PDF off',
  '·',
  docFlow.translate ? 'translate' : 'translate off',
  '·',
  'SOFFICE_PATH',
  docFlow.sofficePath ? 'set' : 'unset'
);

{
  const o = getOcrmypdfBinary();
  if (o) console.log('[ocr] ocrmypdf —', o);
  else console.warn('[ocr] ocrmypdf not on PATH — POST /ocr-pdf returns 503 until the Docker image installs it');
}

if (isDownloadAuthEnabled()) {
  const fb = isFirebaseAdminReady();
  console.log(
    '[download-auth] ON · first anonymous download:',
    isFirstAnonymousDownloadEnabled(),
    '· firebase-admin:',
    fb ? 'ready' : 'MISSING — /download returns 503 until credentials are set'
  );
} else {
  console.log('[download-auth] off (set DOWNLOAD_AUTH_ENABLED=true to require sign-in or one-time token)');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF editor API http://localhost:${PORT}`);
  ensureNotoFontsReady().then((ok) => {
    if (ok) console.log('[fonts] Noto ready for Hindi/Marathi PDF text');
    else console.warn('[fonts] Noto not available — Unicode edits may be blank until fonts download succeeds');
  });
});

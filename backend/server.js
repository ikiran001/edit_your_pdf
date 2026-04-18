import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import uploadRouter from './routes/upload.js';
import editRouter from './routes/edit.js';
import downloadRouter from './routes/download.js';
import unlockRouter from './routes/unlock.js';
import documentFlowRouter from './routes/documentFlow.js';
import userSessionsRouter from './routes/userSessions.js';
import { getDocumentFlowCapabilities } from './services/documentFlowConvert.js';
import { isDownloadAuthEnabled, isFirstAnonymousDownloadEnabled } from './services/downloadAuthPolicy.js';
import { getFirebaseAdminHealthInfo, isFirebaseAdminReady } from './services/firebaseAdmin.js';
import { startSessionCleanup } from './utils/sessionCleanup.js';
import { getQpdfBinary } from './utils/resolveQpdf.js';
import { getGhostscriptBinary } from './utils/resolveGhostscript.js';
import { ensureNotoFontsReady } from './services/pdfUnicodeFonts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Optional local overrides (gitignored). Does not replace vars already set in the shell. */
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
      if (key && process.env[key] === undefined) process.env[key] = val;
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
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/** Production check: GET https://your-api.onrender.com/health */
app.get('/health', (_req, res) => {
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

  res.json({
    ok: true,
    qpdf: Boolean(qpdfBin && qpdfVersion),
    qpdfPath: qpdfBin,
    qpdfVersion,
    ghostscript: Boolean(gsBin && gsVersion),
    ghostscriptPath: gsBin,
    ghostscriptVersion: gsVersion,
    unlock,
    ...getFirebaseAdminHealthInfo(),
  });
});

app.use(uploadRouter);
app.use(editRouter);
app.use(downloadRouter);
app.use(unlockRouter);
app.use(documentFlowRouter);
app.use(userSessionsRouter);

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
  docFlow.pdfToDocx ? 'PDF→DOCX (SOFFICE_PATH)' : 'PDF→DOCX off',
  '·',
  docFlow.docxToPdf ? 'DOCX→PDF (GOTENBERG_URL)' : 'DOCX→PDF off'
);

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

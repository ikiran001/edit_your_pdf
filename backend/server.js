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
import { startSessionCleanup } from './utils/sessionCleanup.js';
import { getQpdfBinary } from './utils/resolveQpdf.js';
import { getGhostscriptBinary } from './utils/resolveGhostscript.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  });
});

app.use(uploadRouter);
app.use(editRouter);
app.use(downloadRouter);
app.use(unlockRouter);

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF editor API http://localhost:${PORT}`);
});

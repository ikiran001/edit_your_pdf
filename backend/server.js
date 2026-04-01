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
  const bin = getQpdfBinary();
  let version = null;
  if (bin) {
    try {
      version = execFileSync(bin, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0];
    } catch {
      version = null;
    }
  }
  res.json({
    ok: true,
    qpdf: Boolean(bin && version),
    qpdfPath: bin,
    qpdfVersion: version,
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

function logQpdfAvailability() {
  const bin = getQpdfBinary();
  if (!bin) {
    console.warn(
      '[qpdf] NOT FOUND — POST /unlock-pdf will return 503. Install qpdf (Dockerfile at repo root or backend/) or set QPDF_BIN. Check GET /health.'
    );
    return;
  }
  try {
    const v = execFileSync(bin, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')[0];
    console.log('[qpdf] OK —', bin, '—', v);
  } catch {
    console.warn('[qpdf] binary present but --version failed:', bin);
  }
}
logQpdfAvailability();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF editor API http://localhost:${PORT}`);
});

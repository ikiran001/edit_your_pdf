import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import uploadRouter from './routes/upload.js';
import editRouter from './routes/edit.js';
import downloadRouter from './routes/download.js';
import { startSessionCleanup } from './utils/sessionCleanup.js';

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

app.use(uploadRouter);
app.use(editRouter);
app.use(downloadRouter);

/** Serve uploaded PDF for pdf.js (same origin when dev proxy is used). */
app.get('/pdf/:sessionId', (req, res) => {
  const p = path.join(uploadsDir, req.params.sessionId, 'original.pdf');
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(p).pipe(res);
});

startSessionCleanup(uploadsDir);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF editor API http://localhost:${PORT}`);
});

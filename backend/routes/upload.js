import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

/**
 * POST /upload — stores PDF under uploads/{sessionId}/original.pdf
 */
router.post('/upload', (req, res) => {
  const sessionId = uuidv4();
  const dir = path.join(uploadsRoot, sessionId);
  fs.mkdirSync(dir, { recursive: true });

  const disk = multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, dir),
    filename: (_r, _f, cb) => cb(null, 'original.pdf'),
  });

  const single = multer({
    storage: disk,
    limits: { fileSize: 52 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        cb(new Error('Only PDF files are allowed'));
        return;
      }
      cb(null, true);
    },
  }).single('file');

  single(req, res, (err) => {
    if (err) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return res.status(400).json({ error: 'No file' });
    }
    /* Magic-byte check: reject files that don't start with %PDF- */
    try {
      const fd = fs.openSync(req.file.path, 'r');
      const head = Buffer.alloc(5);
      fs.readSync(fd, head, 0, 5, 0);
      fs.closeSync(fd);
      if (head.toString('ascii') !== '%PDF-') {
        fs.rmSync(dir, { recursive: true, force: true });
        return res.status(400).json({ error: 'Invalid PDF file (missing %PDF- header).' });
      }
    } catch {
      fs.rmSync(dir, { recursive: true, force: true });
      return res.status(400).json({ error: 'Could not validate uploaded file.' });
    }
    return res.json({ sessionId, filename: req.file.originalname });
  });
});

export default router;

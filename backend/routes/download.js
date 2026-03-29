import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

/**
 * GET /download?sessionId=… — streams edited.pdf (falls back to original if not edited yet).
 */
router.get('/download', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).send('sessionId query required');
  }
  const editedPath = path.join(uploadsRoot, sessionId, 'edited.pdf');
  const originalPath = path.join(uploadsRoot, sessionId, 'original.pdf');
  const filePath = fs.existsSync(editedPath) ? editedPath : originalPath;
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="edited.pdf"');
  fs.createReadStream(filePath).pipe(res);
});

export default router;

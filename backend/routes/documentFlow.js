import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { convertPdfFileToDocxBuffer, getDocumentFlowCapabilities, isUuidLikeSessionId } from '../services/documentFlowConvert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

router.get('/document-flow/capabilities', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getDocumentFlowCapabilities());
});

/**
 * GET /document-flow/session/:sessionId/export-docx?source=original|edited
 * Streams a .docx when SOFFICE_PATH is configured.
 */
router.get('/document-flow/session/:sessionId/export-docx', async (req, res) => {
  const { sessionId } = req.params;
  const source = req.query.source === 'original' ? 'original' : 'edited';
  if (!isUuidLikeSessionId(sessionId)) {
    return res.status(400).json({ error: 'invalid sessionId' });
  }
  const sofficePath = (process.env.SOFFICE_PATH || '').trim();
  if (!sofficePath) {
    return res.status(501).json({
      error: 'pdf_to_docx_unconfigured',
      message:
        'Set SOFFICE_PATH to your LibreOffice soffice binary to enable PDF → Word export.',
    });
  }
  const dir = path.join(uploadsRoot, sessionId);
  const editedPath = path.join(dir, 'edited.pdf');
  const originalPath = path.join(dir, 'original.pdf');
  let chosen;
  if (source === 'original') {
    chosen = originalPath;
  } else {
    chosen = fs.existsSync(editedPath) ? editedPath : originalPath;
  }

  if (!fs.existsSync(chosen)) {
    return res.status(404).json({ error: 'pdf_not_found' });
  }

  try {
    const docx = await convertPdfFileToDocxBuffer({ pdfPath: chosen, sofficePath });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="from-pdf.docx"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(docx);
  } catch (e) {
    console.error('[document-flow] pdf→docx failed:', e);
    return res.status(500).json({
      error: 'convert_failed',
      message: e?.message || 'Conversion failed',
    });
  }
});

const pdfMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/octet-stream' ||
      name.endsWith('.pdf');
    if (!ok) {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /document-flow/convert-pdf-to-docx (multipart field `file`)
 * Returns .docx when SOFFICE_PATH is configured (LibreOffice headless).
 */
router.post('/document-flow/convert-pdf-to-docx', (req, res) => {
  const sofficePath = (process.env.SOFFICE_PATH || '').trim();
  if (!sofficePath) {
    return res.status(501).json({
      error: 'pdf_to_docx_unconfigured',
      message:
        'Set SOFFICE_PATH to your LibreOffice soffice binary to enable PDF → Word conversion.',
    });
  }

  const single = pdfMem.single('file');
  single(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'file required' });
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pdf2docx-upload-'));
    const inputAbs = path.join(tmp, 'upload.pdf');
    try {
      fs.writeFileSync(inputAbs, req.file.buffer);
      const docx = await convertPdfFileToDocxBuffer({ pdfPath: inputAbs, sofficePath });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="from-pdf.docx"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(docx);
    } catch (e) {
      console.error('[document-flow] pdf→docx (upload) failed:', e);
      return res.status(500).json({
        error: 'convert_failed',
        message: e?.message || 'Conversion failed',
      });
    } finally {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });
});

export default router;

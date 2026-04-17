import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  convertDocxBufferToPdfBuffer,
  convertPdfFileToDocxBuffer,
  getDocumentFlowCapabilities,
  isUuidLikeSessionId,
  probeGotenbergHealth,
  resolveGotenbergBaseUrl,
} from '../services/documentFlowConvert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

router.get('/document-flow/capabilities', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const caps = getDocumentFlowCapabilities();
  const url = resolveGotenbergBaseUrl();
  if (!url || !caps.docxToPdf) {
    return res.json(caps);
  }
  try {
    const probe = await probeGotenbergHealth(url);
    if (!probe.ok) {
      return res.json({
        ...caps,
        docxToPdf: false,
        gotenbergReachable: false,
        gotenbergHealthHint: probe.hint,
        gotenbergProbeStatus: probe.status ?? null,
        gotenbergRenderNoServer: Boolean(probe.noServer),
      });
    }
    return res.json({ ...caps, gotenbergReachable: true });
  } catch (e) {
    return res.json({
      ...caps,
      docxToPdf: false,
      gotenbergReachable: false,
      gotenbergHealthHint: e?.message || 'Capabilities probe failed',
    });
  }
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

const docxMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/octet-stream' ||
      name.endsWith('.docx');
    if (!ok) {
      cb(new Error('Only .docx files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /document-flow/convert-docx-to-pdf (multipart field `file`)
 * Returns application/pdf when GOTENBERG_URL is configured.
 */
router.post('/document-flow/convert-docx-to-pdf', (req, res) => {
  const gotenbergUrl = resolveGotenbergBaseUrl();
  if (!gotenbergUrl) {
    return res.status(501).json({
      error: 'docx_to_pdf_unconfigured',
      message:
        'Set GOTENBERG_URL (full URL) or GOTENBERG_HOSTPORT (host:port for private network, e.g. from Render Blueprint).',
    });
  }

  const single = docxMem.single('file');
  single(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'file required' });
    }
    try {
      const pdf = await convertDocxBufferToPdfBuffer({
        gotenbergBaseUrl: gotenbergUrl,
        docxBuffer: req.file.buffer,
        filename: req.file.originalname || 'document.docx',
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="from-word.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(pdf);
    } catch (e) {
      console.error('[document-flow] docx→pdf failed:', e);
      return res.status(500).json({
        error: 'convert_failed',
        message: e?.message || 'Conversion failed',
      });
    }
  });
});

export default router;

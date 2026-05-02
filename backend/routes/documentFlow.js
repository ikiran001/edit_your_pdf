import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  convertPdfFileToDocxBuffer,
  convertPdfFileToXlsxBuffer,
  convertPdfFileToPptxBuffer,
  convertFileToPdfBuffer,
  getDocumentFlowCapabilities,
  isUuidLikeSessionId,
  resolveSofficePath,
} from '../services/documentFlowConvert.js';
import { translateViaLibreTranslate, translateViaMyMemory } from '../services/translateText.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

const translateJson = express.json({ limit: '2mb' });

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
  const sofficePath = resolveSofficePath();
  if (!sofficePath) {
    return res.status(501).json({
      error: 'pdf_to_docx_unconfigured',
      message:
        'Install LibreOffice and set SOFFICE_PATH to its soffice binary, or ensure soffice is on PATH.',
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
  const sofficePath = resolveSofficePath();
  if (!sofficePath) {
    return res.status(501).json({
      error: 'pdf_to_docx_unconfigured',
      message:
        'Install LibreOffice and set SOFFICE_PATH to its soffice binary, or ensure soffice is on PATH.',
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

/**
 * POST /document-flow/translate — JSON { q, source?, target? }
 * Tries LibreTranslate when configured; falls back to MyMemory when the public LT API rejects (no API key).
 */
router.post('/document-flow/translate', translateJson, async (req, res) => {
  const { q, source, target } = req.body || {};
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'invalid_body', message: 'Field "q" (text to translate) is required.' });
  }
  const base = (process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '');
  const apiKey = (process.env.LIBRETRANSLATE_API_KEY || '').trim();
  const tgt = target || 'en';
  const src = source || 'auto';

  try {
    const lt = await translateViaLibreTranslate(base, q, src, tgt, apiKey);
    const out = lt.data?.translatedText;
    if (lt.ok && typeof out === 'string' && out.trim().length > 0) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ translatedText: out, provider: 'libretranslate' });
    }

    const translatedText = await translateViaMyMemory(q, src, tgt);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ translatedText, provider: 'mymemory' });
  } catch (e) {
    console.error('[document-flow] translate failed:', e);
    return res.status(502).json({
      error: 'translate_failed',
      message:
        e?.message ||
        'Translation failed. Set LIBRETRANSLATE_API_KEY for LibreTranslate, or use the MyMemory fallback (daily quota).',
    });
  }
});

/** PDF → XLSX */
router.post('/document-flow/convert-pdf-to-xlsx', (req, res) => {
  const sofficePath = resolveSofficePath();
  if (!sofficePath) {
    return res.status(501).json({
      error: 'soffice_unconfigured',
      message:
        'LibreOffice (soffice) not found. Install it, add soffice to PATH, or set SOFFICE_PATH (e.g. /Applications/LibreOffice.app/Contents/MacOS/soffice on macOS).',
    });
  }
  const single = pdfMem.single('file');
  single(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pdf2xlsx-upload-'));
    const inputAbs = path.join(tmp, 'upload.pdf');
    try {
      fs.writeFileSync(inputAbs, req.file.buffer);
      const xlsx = await convertPdfFileToXlsxBuffer({ pdfPath: inputAbs, sofficePath });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="from-pdf.xlsx"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(xlsx);
    } catch (e) {
      console.error('[document-flow] pdf→xlsx failed:', e);
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

/** PDF → PPTX */
router.post('/document-flow/convert-pdf-to-pptx', (req, res) => {
  const sofficePath = resolveSofficePath();
  if (!sofficePath) {
    return res.status(501).json({
      error: 'soffice_unconfigured',
      message:
        'LibreOffice (soffice) not found. Install it, add soffice to PATH, or set SOFFICE_PATH.',
    });
  }
  const single = pdfMem.single('file');
  single(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pdf2pptx-upload-'));
    const inputAbs = path.join(tmp, 'upload.pdf');
    try {
      fs.writeFileSync(inputAbs, req.file.buffer);
      const pptx = await convertPdfFileToPptxBuffer({ pdfPath: inputAbs, sofficePath });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="from-pdf.pptx"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(pptx);
    } catch (e) {
      console.error('[document-flow] pdf→pptx failed:', e);
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

const officeMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = (file.originalname || '').toLowerCase();
    const ok =
      n.endsWith('.pptx') ||
      n.endsWith('.xlsx') ||
      n.endsWith('.html') ||
      n.endsWith('.htm');
    if (!ok) {
      cb(new Error('Expected .pptx, .xlsx, or .html'));
      return;
    }
    cb(null, true);
  },
});

/** PPTX → PDF */
router.post('/document-flow/convert-pptx-to-pdf', (req, res) => {
  const single = officeMem.single('file');
  single(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const n = (req.file.originalname || '').toLowerCase();
    if (!n.endsWith('.pptx')) return res.status(400).json({ error: 'Expected a .pptx file' });
    const sofficePath = resolveSofficePath();
    if (!sofficePath) {
      return res.status(501).json({
        error: 'soffice_unconfigured',
        message:
          'LibreOffice (soffice) not found. Install it, add soffice to PATH, or set SOFFICE_PATH.',
      });
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pptx2pdf-'));
    const inputAbs = path.join(tmp, 'upload.pptx');
    try {
      fs.writeFileSync(inputAbs, req.file.buffer);
      const buf = await convertFileToPdfBuffer({ inputPath: inputAbs, sofficePath });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="presentation.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buf);
    } catch (e) {
      console.error('[document-flow] pptx→pdf failed:', e);
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

/** XLSX → PDF */
router.post('/document-flow/convert-xlsx-to-pdf', (req, res) => {
  const single = officeMem.single('file');
  single(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const n = (req.file.originalname || '').toLowerCase();
    if (!n.endsWith('.xlsx')) return res.status(400).json({ error: 'Expected a .xlsx file' });
    const sofficePath = resolveSofficePath();
    if (!sofficePath) {
      return res.status(501).json({
        error: 'soffice_unconfigured',
        message:
          'LibreOffice (soffice) not found. Install it, add soffice to PATH, or set SOFFICE_PATH.',
      });
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-xlsx2pdf-'));
    const inputAbs = path.join(tmp, 'upload.xlsx');
    try {
      fs.writeFileSync(inputAbs, req.file.buffer);
      const buf = await convertFileToPdfBuffer({ inputPath: inputAbs, sofficePath });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="spreadsheet.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buf);
    } catch (e) {
      console.error('[document-flow] xlsx→pdf failed:', e);
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

/** HTML → PDF */
router.post('/document-flow/convert-html-to-pdf', (req, res) => {
  const single = officeMem.single('file');
  single(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const n = (req.file.originalname || '').toLowerCase();
    if (!n.endsWith('.html') && !n.endsWith('.htm')) {
      return res.status(400).json({ error: 'Expected an .html file' });
    }
    const sofficePath = resolveSofficePath();
    if (!sofficePath) {
      return res.status(501).json({
        error: 'soffice_unconfigured',
        message:
          'LibreOffice (soffice) not found. Install it, add soffice to PATH, or set SOFFICE_PATH.',
      });
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-html2pdf-'));
    const inputAbs = path.join(tmp, n.endsWith('.htm') ? 'upload.htm' : 'upload.html');
    try {
      fs.writeFileSync(inputAbs, req.file.buffer);
      const buf = await convertFileToPdfBuffer({ inputPath: inputAbs, sofficePath });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="page.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buf);
    } catch (e) {
      console.error('[document-flow] html→pdf failed:', e);
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

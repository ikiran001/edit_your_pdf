import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { getOcrmypdfBinary } from '../utils/resolveOcrmypdf.js';

const MAX_BYTES = 52 * 1024 * 1024;

function parsePositiveInt(v, fallback, cap) {
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(cap, n);
}

/**
 * @param {Buffer} pdfBytes
 * @param {number} maxPages
 * @returns {Promise<{ bytes: Buffer, truncated: boolean, pageCount: number, originalPages: number }>}
 */
async function maybeTruncatePdfToMaxPages(pdfBytes, maxPages) {
  const buf = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  let doc;
  try {
    doc = await PDFDocument.load(buf, { ignoreEncryption: false });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (/encrypt|password|Encrypted/i.test(msg)) {
      const err = new Error('This PDF is password-protected. Use Unlock PDF first, then run OCR.');
      err.code = 'ENCRYPTED';
      throw err;
    }
    throw e;
  }
  const n = doc.getPageCount();
  if (n <= maxPages) {
    return { bytes: buf, truncated: false, pageCount: n, originalPages: n };
  }
  const out = await PDFDocument.create();
  const indices = Array.from({ length: maxPages }, (_, i) => i);
  const pages = await out.copyPages(doc, indices);
  for (const p of pages) out.addPage(p);
  const saved = await out.save();
  return {
    bytes: Buffer.from(saved),
    truncated: true,
    pageCount: maxPages,
    originalPages: n,
  };
}

function runOcrmypdf(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stderr = '';
    let settled = false;
    let timerId = null;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      if (timerId) clearTimeout(timerId);
      fn();
    };
    timerId = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      finish(() =>
        reject(
          Object.assign(new Error('OCR timed out — try a smaller PDF or fewer pages.'), { code: 'TIMEOUT' })
        )
      );
    }, timeoutMs);
    child.stderr?.on('data', (c) => {
      stderr += c.toString();
    });
    child.stdout?.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('error', (err) => finish(() => reject(err)));
    child.on('close', (code) => {
      if (code === 0) finish(() => resolve({ stderr }));
      else
        finish(() =>
          reject(
            Object.assign(new Error(stderr.trim() || `ocrmypdf exited with code ${code}`), {
              exitCode: code,
              stderr,
            })
          )
        );
    });
  });
}

const router = Router();

const mem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file');

/**
 * POST /ocr-pdf — multipart field `file` (PDF) → searchable PDF (Tesseract via ocrmypdf).
 */
router.post('/ocr-pdf', (req, res) => {
  mem(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No file' });
    }
    const bin = getOcrmypdfBinary();
    if (!bin) {
      return res.status(503).json({
        error: 'ocr_unavailable',
        message:
          'OCR is not installed on this server. Deploy the API Docker image (includes ocrmypdf + Tesseract) or set OCRMYPDF_BIN.',
      });
    }

    const maxPages = parsePositiveInt(process.env.OCR_MAX_PAGES, 40, 100);
    const timeoutMs = parsePositiveInt(process.env.OCR_TIMEOUT_MS, 540000, 900000);
    /* Default `eng` so local Homebrew Tesseract works; Docker sets OCR_LANGS=eng+hin. */
    const langs = String(process.env.OCR_LANGS || 'eng').trim() || 'eng';

    const head = req.file.buffer.subarray(0, 5).toString('ascii');
    if (head !== '%PDF-') {
      return res.status(400).json({ error: 'Invalid PDF file (missing %PDF- header).' });
    }

    const work = path.join(os.tmpdir(), `eyp-ocr-${crypto.randomUUID()}`);
    const inPath = path.join(work, 'in.pdf');
    const outPath = path.join(work, 'out.pdf');

    try {
      fs.mkdirSync(work, { recursive: true });
      let prepared;
      try {
        prepared = await maybeTruncatePdfToMaxPages(req.file.buffer, maxPages);
      } catch (e) {
        if (e?.code === 'ENCRYPTED') {
          return res.status(400).json({ error: e.message });
        }
        console.error('[ocr-pdf] preprocess:', e?.message || e);
        return res.status(400).json({ error: 'Could not read this PDF. It may be corrupt or unsupported.' });
      }

      fs.writeFileSync(inPath, prepared.bytes);

      const args = ['--optimize', '0', '--skip-text', '--jobs', '1', '-l', langs, inPath, outPath];
      try {
        await runOcrmypdf(bin, args, timeoutMs);
      } catch (e) {
        console.error('[ocr-pdf] ocrmypdf:', e?.message || e);
        const msg = String(e?.message || e || 'OCR failed');
        if (e?.code === 'TIMEOUT') {
          return res.status(504).json({ error: msg });
        }
        return res.status(500).json({ error: msg.slice(0, 2000) });
      }

      if (!fs.existsSync(outPath)) {
        return res.status(500).json({ error: 'OCR finished but output file is missing.' });
      }
      const outBuf = fs.readFileSync(outPath);
      const rawBase = String(req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '') || 'document';
      const safeBase = rawBase.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'document';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeBase}-ocr.pdf"`);
      res.setHeader('X-OCR-Page-Count', String(prepared.pageCount));
      res.setHeader('X-OCR-Truncated', prepared.truncated ? 'yes' : 'no');
      res.setHeader('X-OCR-Original-Pages', String(prepared.originalPages));
      res.setHeader('Cache-Control', 'no-store');
      return res.send(outBuf);
    } finally {
      try {
        fs.rmSync(work, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });
});

export default router;

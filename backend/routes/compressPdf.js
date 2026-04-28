import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { getQpdfBinary } from '../utils/resolveQpdf.js';
import { getGhostscriptBinary } from '../utils/resolveGhostscript.js';

const MAX_BYTES = 52 * 1024 * 1024;

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

function runProcess(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stderr = '';
    let settled = false;
    const done = (fn) => {
      if (settled) return;
      settled = true;
      fn();
    };
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      done(() => reject(err));
    });
    child.on('close', (code) => {
      if (code === 0) done(() => resolve({ stderr }));
      else
        done(() =>
          reject(
            Object.assign(new Error(stderr.trim() || `${bin} exited with code ${code}`), {
              exitCode: code,
              stderr,
            })
          )
        );
    });
  });
}

/** @param {string} raw */
function normalizeLevel(raw) {
  const s = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (s === 'low' || s === 'medium' || s === 'high') return s;
  return 'medium';
}

/**
 * qpdf flags — structural flate/object-stream optimization.
 * @param {'low'|'medium'|'high'} level
 */
function qpdfCompressionArgs(level) {
  const base = ['--compress-streams=y', '--object-streams=generate'];
  if (level === 'low') {
    return [...base, '--recompress-flate', '--compression-level=3'];
  }
  if (level === 'medium') {
    return [...base, '--recompress-flate', '--compression-level=6'];
  }
  return [...base, '--recompress-flate', '--compression-level=9', '--optimize-images'];
}

/**
 * Second pass: Ghostscript pdfwrite rewrites images/fonts — often the only way to shrink scans significantly.
 * @param {'medium'|'high'} level
 * @returns {`/ebook`|`/screen`|null}
 */
function ghostscriptPdfSettings(level) {
  if (level === 'medium') return '/ebook';
  if (level === 'high') return '/screen';
  return null;
}

/**
 * GET/HEAD: not supported — only POST runs compression. (Without this, GET returned 404 and looked
 * like the tool was missing after deploy; 405 + Allow makes it obvious in curl and uptime checks.)
 */
router.head('/compress-pdf', (_req, res) => {
  res.set('Allow', 'POST');
  res.status(204).end();
});
router.get('/compress-pdf', (_req, res) => {
  res.set('Allow', 'POST');
  res.status(405).json({
    error:
      'Use POST with multipart field "file" (application/pdf) and optional "level" (low|medium|high).',
  });
});

/**
 * POST multipart: `file` (PDF), optional `level` (`low`|`medium`|`high`).
 * Returns compressed PDF bytes (application/pdf).
 */
router.post('/compress-pdf', (req, res) => {
  mem(req, res, async (err) => {
    if (err) {
      console.warn('[compress-pdf] upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Missing PDF file.' });
    }

    const bin = getQpdfBinary();
    if (!bin) {
      return res.status(503).json({
        error: 'Compress PDF is not available on this server (qpdf not installed).',
      });
    }

    const level = normalizeLevel(req.body?.level);
    let workRoot = null;

    try {
      workRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'compress-pdf-'));
      const inPath = path.join(workRoot, 'in.pdf');
      const qpdfOut = path.join(workRoot, 'qpdf-out.pdf');
      await fs.promises.writeFile(inPath, req.file.buffer);

      const args = [...qpdfCompressionArgs(level), inPath, qpdfOut];
      await runProcess(bin, args);

      let finalPath = qpdfOut;
      const gsProfile = ghostscriptPdfSettings(level);
      const gsBin = gsProfile ? getGhostscriptBinary() : null;

      if (gsBin && gsProfile) {
        const gsOut = path.join(workRoot, 'gs-out.pdf');
        try {
          await runProcess(gsBin, [
            '-q',
            '-dNOPAUSE',
            '-dBATCH',
            '-sDEVICE=pdfwrite',
            `-dPDFSETTINGS=${gsProfile}`,
            '-dCompatibilityLevel=1.4',
            `-sOutputFile=${gsOut}`,
            qpdfOut,
          ]);
          const st = await fs.promises.stat(gsOut);
          if (st.size > 0) finalPath = gsOut;
        } catch (e) {
          console.warn('[compress-pdf] ghostscript pass skipped:', e?.message || e);
        }
      }

      const outBuf = await fs.promises.readFile(finalPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(outBuf));
    } catch (e) {
      console.error('[compress-pdf]', e?.stderr || e?.message || e);
      const msg = String(e?.message || e || 'Compression failed');
      return res.status(500).json({
        error: msg.includes('qpdf') ? msg : `Compression failed: ${msg}`,
      });
    } finally {
      if (workRoot) {
        try {
          await fs.promises.rm(workRoot, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  });
});

export default router;

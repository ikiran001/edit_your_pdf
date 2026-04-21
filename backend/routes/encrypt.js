import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { getQpdfBinary } from '../utils/resolveQpdf.js';

const MAX_BYTES = 52 * 1024 * 1024;
const MIN_PASSWORD_LEN = 12;
const MAX_PASSWORD_LEN = 128;

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

/**
 * AES-256 PDF encryption via qpdf (same family as /unlock-pdf).
 * POST multipart: `file` (PDF), `password` (string, UTF-8).
 */
router.post('/encrypt-pdf', (req, res) => {
  mem(req, res, async (err) => {
    if (err) {
      console.warn('[encrypt-pdf] upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Missing PDF file.' });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < MIN_PASSWORD_LEN) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
      });
    }
    if (password.length > MAX_PASSWORD_LEN) {
      return res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_LEN} characters.` });
    }

    const bin = getQpdfBinary();
    if (!bin) {
      return res.status(503).json({
        error: 'Encrypt PDF is not available on this server (qpdf not installed).',
      });
    }

    let workRoot = null;
    const originalName = (req.file.originalname || 'document.pdf').replace(/[^\w.\-()+ ]/g, '_');
    const ts = Date.now();
    const outName = `encrypted_${ts}.pdf`;

    try {
      const buf = req.file.buffer;
      workRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'encrypt-pdf-'));
      const inPath = path.join(workRoot, 'in.pdf');
      const outPath = path.join(workRoot, 'out.pdf');
      await fs.promises.writeFile(inPath, buf);

      /*
       * qpdf: user + owner password (same), 256 = AES-256.
       * https://qpdf.readthedocs.io/en/stable/cli.html#encrypt
       */
      await runProcess(bin, [
        '--encrypt',
        password,
        password,
        '256',
        '--',
        inPath,
        outPath,
      ]);

      const stat = await fs.promises.stat(outPath);
      if (!stat.isFile() || stat.size === 0) {
        return res.status(500).json({ error: 'Encrypted output was empty.' });
      }

      const outBuf = await fs.promises.readFile(outPath);
      console.log(`[encrypt-pdf] ok: in="${originalName}" bytes=${buf.length} out=${outBuf.length}`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(outBuf);
    } catch (e) {
      const msg = String(e?.stderr || e?.message || e);
      console.error('[encrypt-pdf]', msg);
      if (/already.*encrypt|encrypted/i.test(msg)) {
        return res.status(400).json({
          error:
            'This PDF is already encrypted. Unlock it first (Unlock PDF), then encrypt with a new password.',
        });
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'Could not encrypt this PDF. It may be corrupted or unsupported.' });
      }
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

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { getQpdfBinary } from '../utils/resolveQpdf.js';

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

/**
 * Run qpdf; rejects with { code, stderr } on failure.
 */
function qpdf(args) {
  const bin = getQpdfBinary();
  if (!bin) {
    return Promise.reject(Object.assign(new Error('spawn qpdf ENOENT'), { code: 'ENOENT' }));
  }
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
    child.on('error', (err) => {
      done(() => reject(err));
    });
    child.on('close', (code) => {
      if (code === 0) done(() => resolve());
      else
        done(() =>
          reject(
            Object.assign(new Error(stderr.trim() || `qpdf exited with code ${code}`), {
              exitCode: code,
              stderr,
            })
          )
        );
    });
  });
}

function logSafeFilename(name) {
  if (!name || typeof name !== 'string') return '(unknown)';
  return name.replace(/[\u0000-\u001f]/g, '').slice(0, 200);
}

/**
 * POST /unlock-pdf — multipart: field `file` (PDF), field `password` (string).
 * Returns decrypted PDF bytes (no /Encrypt). Requires `qpdf` on PATH.
 */
router.post('/unlock-pdf', (req, res) => {
  mem(req, res, async (err) => {
    const ts = Date.now();
    const outName = `unlocked_${ts}.pdf`;

    if (err) {
      console.warn('[unlock-pdf] upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No PDF file' });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      console.warn('[unlock-pdf] rejected: empty password');
      return res.status(400).json({ error: 'Password is required' });
    }

    const originalName = logSafeFilename(req.file.originalname);
    const inputSize = req.file.buffer.length;
    console.log(`[unlock-pdf] input: name="${originalName}" bytes=${inputSize}`);
    console.log(`[unlock-pdf] password: provided (length=${password.length})`);

    let workRoot;
    try {
      workRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unlock-pdf-'));
      const inPath = path.join(workRoot, 'in.pdf');
      const outPath = path.join(workRoot, 'out.pdf');
      const pwPath = path.join(workRoot, 'password.txt');

      await fs.promises.writeFile(inPath, req.file.buffer);
      await fs.promises.writeFile(pwPath, password, { mode: 0o600 });

      const args = [`--password-file=${pwPath}`, '--decrypt', inPath, outPath];
      try {
        await qpdf(args);
      } catch (e) {
        if (e && (e.code === 'ENOENT' || /ENOENT/i.test(String(e.message)))) {
          console.error('[unlock-pdf] qpdf not found on PATH — install qpdf (brew install qpdf / apt install qpdf)');
          return res.status(503).json({
            error:
              'Unlock service is not available: qpdf is not installed on the server. Install qpdf and restart the API.',
          });
        }

        const stderr = (e.stderr || e.message || '').toString().toLowerCase();
        const wrongPw =
          /invalid password|incorrect password|password.*failed|check.*password|bad password/i.test(stderr) ||
          /invalid password|incorrect password|password.*failed|check.*password|bad password/i.test(
            String(e.message)
          );

        if (wrongPw) {
          console.warn('[unlock-pdf] password validation: FAILED (invalid password)');
          return res.status(401).json({ error: 'Wrong password. The PDF could not be decrypted.' });
        }

        console.error('[unlock-pdf] qpdf error:', e.stderr || e.message || e);
        return res.status(422).json({
          error:
            'Could not remove encryption from this PDF. It may use an unsupported cipher or be corrupted. Try opening it in a desktop PDF tool.',
        });
      }

      const stat = await fs.promises.stat(outPath);
      if (!stat.isFile() || stat.size === 0) {
        console.error('[unlock-pdf] output missing or empty');
        return res.status(500).json({ error: 'Unlock produced an empty file.' });
      }

      console.log('[unlock-pdf] password validation: OK');
      console.log(`[unlock-pdf] output: ${outName} bytes=${stat.size}`);

      const outBuf = await fs.promises.readFile(outPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(outBuf);
    } catch (unexpected) {
      console.error('[unlock-pdf]', unexpected);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Unexpected server error while unlocking.' });
      }
    } finally {
      if (workRoot) {
        await fs.promises.rm(workRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
});

export default router;

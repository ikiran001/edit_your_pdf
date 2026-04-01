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
      if (code === 0) done(() => resolve());
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
 * qpdf --password-file + --decrypt (preferred).
 */
function decryptWithQpdf(inPath, outPath, pwPath) {
  const bin = getQpdfBinary();
  if (!bin) {
    return Promise.reject(Object.assign(new Error('qpdf not found'), { code: 'ENOENT' }));
  }
  return runProcess(bin, [`--password-file=${pwPath}`, '--decrypt', inPath, outPath]);
}

/**
 * Ghostscript: rewrite PDF without encryption (Render native has `gs` on PATH).
 */
function decryptWithGhostscript(inPath, outPath, password) {
  const bin = getGhostscriptBinary();
  if (!bin) {
    return Promise.reject(Object.assign(new Error('gs not found'), { code: 'ENOENT' }));
  }
  return runProcess(bin, [
    '-dNOPAUSE',
    '-dBATCH',
    '-q',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-sOutputFile=${outPath}`,
    `-sPDFPassword=${password}`,
    '-f',
    inPath,
  ]);
}

function isWrongPassword(stderr, message) {
  const s = `${stderr || ''} ${message || ''}`.toLowerCase();
  return (
    /invalid password|incorrect password|password.*failed|check.*password|bad password|cannot decrypt|wrong password|owner password|incorrect.*owner|could not open|cannot open pdf|invalidfileaccess|no pdf file opened/i.test(
      s
    )
  );
}

function isNoBackendError(e) {
  return e?.code === 'ENOENT' || /not found|enoent/i.test(String(e.message || ''));
}

function logSafeFilename(name) {
  if (!name || typeof name !== 'string') return '(unknown)';
  return name.replace(/[\u0000-\u001f]/g, '').slice(0, 200);
}

/**
 * POST /unlock-pdf — multipart: field `file` (PDF), field `password` (string).
 * Uses qpdf when available, else Ghostscript (e.g. Render native without Docker).
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

      let backend = 'qpdf';
      try {
        await decryptWithQpdf(inPath, outPath, pwPath);
      } catch (qErr) {
        if (isNoBackendError(qErr) || /qpdf not found/i.test(String(qErr.message))) {
          console.log('[unlock-pdf] qpdf unavailable, trying ghostscript');
          backend = 'ghostscript';
          try {
            await decryptWithGhostscript(inPath, outPath, password);
          } catch (gErr) {
            if (isNoBackendError(gErr)) {
              console.error('[unlock-pdf] neither qpdf nor ghostscript available');
              return res.status(503).json({
                error:
                  'Unlock is not available on this server (need qpdf or Ghostscript). On Render, use the default Node build (npm install) — Ghostscript is included — or deploy with Docker.',
              });
            }
            const gsText = (gErr.stderr || gErr.message || '').toString();
            if (isWrongPassword(gsText, gErr.message)) {
              console.warn('[unlock-pdf] password validation: FAILED (ghostscript)');
              return res.status(401).json({ error: 'Wrong password. The PDF could not be decrypted.' });
            }
            console.error('[unlock-pdf] ghostscript error:', gsText || gErr);
            return res.status(422).json({
              error:
                'Could not remove encryption from this PDF. It may use encryption Ghostscript cannot open — try qpdf locally or a desktop PDF tool.',
            });
          }
        } else {
          const stderr = (qErr.stderr || qErr.message || '').toString();
          if (isWrongPassword(stderr, qErr.message)) {
            console.warn('[unlock-pdf] password validation: FAILED (qpdf)');
            return res.status(401).json({ error: 'Wrong password. The PDF could not be decrypted.' });
          }
          console.error('[unlock-pdf] qpdf error:', qErr.stderr || qErr.message || qErr);
          return res.status(422).json({
            error:
              'Could not remove encryption from this PDF. It may use an unsupported cipher or be corrupted. Try opening it in a desktop PDF tool.',
          });
        }
      }

      const stat = await fs.promises.stat(outPath);
      if (!stat.isFile() || stat.size === 0) {
        console.error('[unlock-pdf] output missing or empty');
        return res.status(500).json({ error: 'Unlock produced an empty file.' });
      }

      console.log(`[unlock-pdf] password validation: OK (via ${backend})`);
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

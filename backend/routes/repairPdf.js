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

function pdfHeadOk(buf) {
  const head = buf.subarray(0, Math.min(5, buf.length)).toString('latin1');
  return head.startsWith('%PDF');
}

/**
 * POST /repair-pdf — multipart: field `file` (PDF), optional field `password` (string).
 * Rewrites the PDF through qpdf (normalize), then tries a page-rebuild pass if needed.
 */
router.post('/repair-pdf', (req, res) => {
  mem(req, res, async (err) => {
    const ts = Date.now();
    const outName = `repaired_${ts}.pdf`;

    if (err) {
      console.warn('[repair-pdf] upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No PDF file' });
    }

    const bin = getQpdfBinary();
    if (!bin) {
      return res.status(503).json({
        error: 'Repair PDF is not available on this server (qpdf not installed).',
      });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    let workRoot;

    try {
      workRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repair-pdf-'));
      const inPath = path.join(workRoot, 'in.pdf');
      const outDirect = path.join(workRoot, 'out-direct.pdf');
      const outPages = path.join(workRoot, 'out-pages.pdf');
      const pwPath = path.join(workRoot, 'password.txt');

      await fs.promises.writeFile(inPath, req.file.buffer);
      if (password) {
        await fs.promises.writeFile(pwPath, password, { mode: 0o600 });
      }

      const pwArg = password ? [`--password-file=${pwPath}`] : [];

      const tryDirect = async () => {
        await runProcess(bin, [...pwArg, inPath, outDirect]);
      };

      const tryPageRebuild = async () => {
        await runProcess(bin, [...pwArg, '--empty', '--pages', inPath, '1-z', '--', outPages]);
      };

      let outPath = null;
      try {
        await tryDirect();
        const st = await fs.promises.stat(outDirect);
        if (st.size > 0) {
          const buf = await fs.promises.readFile(outDirect);
          if (pdfHeadOk(buf)) outPath = outDirect;
        }
      } catch (e) {
        console.warn('[repair-pdf] direct qpdf pass failed:', e?.stderr || e?.message || e);
      }

      if (!outPath) {
        try {
          await tryPageRebuild();
          const st = await fs.promises.stat(outPages);
          if (st.size > 0) {
            const buf = await fs.promises.readFile(outPages);
            if (pdfHeadOk(buf)) outPath = outPages;
          }
        } catch (e) {
          console.warn('[repair-pdf] page-rebuild pass failed:', e?.stderr || e?.message || e);
        }
      }

      if (!outPath) {
        return res.status(422).json({
          error:
            'qpdf could not repair this PDF. It may be too damaged, or it may need the document password — use the optional password field on the tool page, or unlock it first.',
        });
      }

      const outBuf = await fs.promises.readFile(outPath);
      if (!pdfHeadOk(outBuf) || outBuf.length < 32) {
        return res.status(422).json({
          error: 'Repair produced an invalid or empty PDF. The source file may be beyond automatic recovery.',
        });
      }

      console.log(`[repair-pdf] ok bytes_in=${req.file.buffer.length} bytes_out=${outBuf.length}`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(outBuf);
    } catch (unexpected) {
      console.error('[repair-pdf]', unexpected);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Unexpected server error while repairing.' });
      }
    } finally {
      if (workRoot) {
        await fs.promises.rm(workRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
});

export default router;

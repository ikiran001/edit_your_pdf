import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'node:url';
import { Document, Packer, Paragraph, TextRun } from 'docx';

/**
 * @param {string} file
 * @param {string[]} args
 * @param {import('child_process').ExecFileOptions} options
 */
function execFileWithCapture(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...options, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        Object.assign(err, {
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
        reject(err);
      } else {
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
      }
    });
  });
}

/** Pick Writer output .docx after --convert-to docx (prefer source.docx, else sole/multiple matches). */
function pickDocxOutput(dir) {
  const preferred = path.join(dir, 'source.docx');
  if (fs.existsSync(preferred)) return preferred;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const docx = entries.filter((f) => f.toLowerCase().endsWith('.docx'));
  if (docx.length === 1) return path.join(dir, docx[0]);
  if (docx.length > 1) {
    const stem = docx.find((f) => /^source\b/i.test(path.basename(f, '.docx')));
    if (stem) return path.join(dir, stem);
    return path.join(dir, docx[0]);
  }
  return null;
}

/** Pick intermediate .odt after PDF → ODT (prefer source.odt). */
function pickOdtOutput(dir) {
  const preferred = path.join(dir, 'source.odt');
  if (fs.existsSync(preferred)) return preferred;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const odts = entries.filter((f) => f.toLowerCase().endsWith('.odt'));
  if (odts.length === 1) return path.join(dir, odts[0]);
  if (odts.length > 1) {
    const stem = odts.find((f) => /^source\b/i.test(path.basename(f, '.odt')));
    if (stem) return path.join(dir, stem);
    return path.join(dir, odts[0]);
  }
  return null;
}

/**
 * Run `soffice` under Xvfb when available — headless PDF import often produces no export without a display on Docker.
 * Disable with `PDF_TO_DOCX_USE_XVFB=0`.
 */
async function execSofficeConvert(sofficePath, argv, options) {
  const disableXvfb = (process.env.PDF_TO_DOCX_USE_XVFB || '').trim() === '0';
  const xvfbRun = '/usr/bin/xvfb-run';
  if (!disableXvfb && fs.existsSync(xvfbRun)) {
    return execFileWithCapture(xvfbRun, ['-a', '--', sofficePath, ...argv], options);
  }
  return execFileWithCapture(sofficePath, argv, options);
}

/** Remove prior .docx/.odt attempts so filter retries do not pick stale outputs. */
function cleanLoConversionArtifacts(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!/\.(docx|odt)$/i.test(name)) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Strip illegal XML 1.0 / WordprocessingML chars (Office otherwise shows “cannot open file”).
 * @param {string} input
 */
function sanitizeDocxText(input) {
  if (typeof input !== 'string' || !input.length) return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\uFFFE|\uFFFF/g, '');
}

/**
 * Last resort: extract embedded text with pdftotext and build a minimal DOCX (layout not preserved).
 * Image-only / scanned PDFs typically yield empty text → returns null.
 */
async function convertPdfToDocxViaPdftotextFallback(pdfPath) {
  if ((process.env.PDF_TO_DOCX_TEXT_FALLBACK || '1').trim() === '0') {
    return null;
  }
  const pdftotext = '/usr/bin/pdftotext';
  if (!fs.existsSync(pdftotext)) {
    return null;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pdf2txt-'));
  const txtPath = path.join(tmp, 'extracted.txt');
  try {
    await execFileWithCapture(pdftotext, ['-layout', '-enc', 'UTF-8', pdfPath, txtPath], {
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
      env: process.env,
    });
    if (!fs.existsSync(txtPath)) return null;
    let text = fs.readFileSync(txtPath, 'utf8');
    text = text.replace(/\r\n/g, '\n').trim();
    if (!text.length) return null;
    text = sanitizeDocxText(text);

    const lines = text.split('\n').map((line) => sanitizeDocxText(line));
    const children = lines.map((line) => {
      const safe = line.length ? line : '\u00a0';
      return new Paragraph({
        children: [new TextRun({ text: safe })],
      });
    });
    const doc = new Document({
      sections: [{ properties: {}, children }],
    });
    const buf = await Packer.toBuffer(doc);
    return Buffer.from(buf);
  } catch {
    return null;
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/** UUID v4 from `uuid` package (version nibble = 4, variant = 8/9/a/b). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLikeSessionId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

/**
 * Document-flow capabilities for API introspection.
 * Word→PDF is implemented in the web app (browser); the server route was removed.
 *
 * @returns {{
 *   pdfToDocx: boolean,
 *   docxToPdf: boolean,
 *   docxToPdfViaSoffice: boolean,
 *   docxToPdfViaGotenberg: boolean,
 *   sofficePath: string | null,
 * }}
 */
export function getDocumentFlowCapabilities() {
  const sofficePath = (process.env.SOFFICE_PATH || '').trim() || null;
  return {
    pdfToDocx: Boolean(sofficePath),
    docxToPdf: false,
    docxToPdfViaSoffice: false,
    docxToPdfViaGotenberg: false,
    sofficePath: sofficePath ? '(set)' : null,
  };
}

/**
 * Best-effort PDF → DOCX using local LibreOffice (`soffice`).
 * @param {{ pdfPath: string, sofficePath: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertPdfFileToDocxBuffer(opts) {
  const { pdfPath, sofficePath } = opts;
  if (!fs.existsSync(pdfPath)) {
    const err = new Error('PDF not found');
    err.code = 'ENOENT';
    throw err;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-docflow-'));
  const inputName = 'source.pdf';
  const inputAbs = path.join(tmp, inputName);
  const profileDir = path.join(tmp, 'lo-profile');
  fs.mkdirSync(profileDir, { recursive: true });
  const userInstallUrl = pathToFileURL(profileDir).href;

  /** Headless Docker/Render: writable HOME + SVP plugin avoids silent PDF→DOCX failures. */
  const loEnv = {
    ...process.env,
    HOME: tmp,
    TMPDIR: tmp,
    TMP: tmp,
    TEMP: tmp,
    SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN || 'svp',
  };

  const loPrefix = [
    `-env:UserInstallation=${userInstallUrl}`,
    '--headless',
    '--nologo',
    '--nofirststartwizard',
    '--norestore',
  ];

  try {
    fs.copyFileSync(pdfPath, inputAbs);

    const runConvert = async (convertArg, inputFile) => {
      try {
        await execSofficeConvert(
          sofficePath,
          [...loPrefix, '--convert-to', convertArg, '--outdir', tmp, inputFile],
          {
            timeout: 180_000,
            maxBuffer: 64 * 1024 * 1024,
            env: loEnv,
          }
        );
      } catch (e) {
        const tail = String(e.stderr || '').trim().slice(-1200);
        const err = new Error(
          tail
            ? `LibreOffice failed while converting PDF to Word: ${tail}`
            : 'LibreOffice failed while converting PDF to Word (no stderr output).'
        );
        err.code = 'CONVERT_SOFFICE_FAILED';
        err.cause = e;
        throw err;
      }
    };

    const docxAttempts = ['docx', 'docx:Office Open XML Text', 'docx:MS Word 2007 XML'];
    let outDocx = null;

    for (const fmt of docxAttempts) {
      cleanLoConversionArtifacts(tmp);
      await runConvert(fmt, inputAbs);
      outDocx = pickDocxOutput(tmp);
      if (outDocx) break;
    }

    // PDF → ODT → DOCX (some builds export DOCX only after an ODT round-trip)
    if (!outDocx) {
      cleanLoConversionArtifacts(tmp);
      await runConvert('odt', inputAbs);
      const odtPath = pickOdtOutput(tmp);
      if (odtPath && fs.existsSync(odtPath)) {
        await runConvert('docx', odtPath);
        outDocx = pickDocxOutput(tmp);
      }
    }

    if (!outDocx) {
      const fallbackBuf = await convertPdfToDocxViaPdftotextFallback(inputAbs);
      if (fallbackBuf?.length) {
        return fallbackBuf;
      }
    }

    if (!outDocx) {
      let listing = '';
      try {
        listing = fs.readdirSync(tmp).join(', ');
      } catch {
        listing = '(could not read temp dir)';
      }
      const err = new Error(
        `Could not produce a Word file from this PDF. LibreOffice wrote no export in ${tmp}; text extraction also failed or found no text (scanned PDFs need OCR first). Directory listing: ${listing}`
      );
      err.code = 'CONVERT_MISSING_OUTPUT';
      throw err;
    }
    return fs.readFileSync(outDocx);
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

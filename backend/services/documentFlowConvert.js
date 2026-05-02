import { execFile, execFileSync } from 'child_process';
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

/** Known install locations when `SOFFICE_PATH` is unset or invalid. */
const SOFFICE_DEFAULT_CANDIDATES = [
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
];

function tryResolveSofficeFromPathEnv() {
  const isWin = process.platform === 'win32';
  try {
    const out = execFileSync(isWin ? 'where' : 'which', ['soffice'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const line = out.trim().split(/\r?\n/)[0];
    if (line && fs.existsSync(line)) return line;
  } catch {
    /* not on PATH */
  }
  return null;
}

/**
 * LibreOffice `soffice` binary: `SOFFICE_PATH` if present and exists, else `which soffice`,
 * else common Linux/macOS install paths.
 * @returns {string | null}
 */
export function resolveSofficePath() {
  const fromEnv = (process.env.SOFFICE_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const viaPath = tryResolveSofficeFromPathEnv();
  if (viaPath) return viaPath;

  for (const p of SOFFICE_DEFAULT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
  const sofficePath = resolveSofficePath();
  const lt = (process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com').trim();
  return {
    pdfToDocx: Boolean(sofficePath),
    pdfToXlsx: Boolean(sofficePath),
    pdfToPptx: Boolean(sofficePath),
    officeToPdf: Boolean(sofficePath),
    htmlToPdf: Boolean(sofficePath),
    docxToPdf: false,
    docxToPdfViaSoffice: false,
    docxToPdfViaGotenberg: false,
    translate: Boolean(lt),
    libreTranslateConfigured: Boolean(lt),
    sofficePath: sofficePath ? '(set)' : null,
  };
}

/** Pick first matching `*.ext` in dir (prefer source.ext). */
function pickOutputByExt(dir, ext) {
  const preferred = path.join(dir, `source.${ext}`);
  if (fs.existsSync(preferred)) return preferred;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const dot = `.${ext.toLowerCase()}`;
  const matches = entries.filter((f) => f.toLowerCase().endsWith(dot));
  if (matches.length === 1) return path.join(dir, matches[0]);
  if (matches.length > 1) {
    const stem = matches.find((f) => /^source\b/i.test(path.basename(f, dot)));
    if (stem) return path.join(dir, stem);
    return path.join(dir, matches[0]);
  }
  return null;
}

function cleanExtArtifacts(dir, exts) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  const set = new Set(exts.map((e) => e.toLowerCase()));
  for (const name of entries) {
    const low = name.toLowerCase();
    const hit = [...set].some((e) => low.endsWith(`.${e}`));
    if (!hit) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch {
      /* ignore */
    }
  }
}

/** Shared argv prefix for headless conversions (isolated UserInstallation). */
function buildLibreOfficeArgv(profileDir) {
  return [
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    '--headless',
    '--invisible',
    '--nologo',
    '--nofirststartwizard',
    '--norestore',
    '--nodefault',
  ];
}

/**
 * Child env: writable HOME/TMP. Linux/Render uses SVP. macOS must not force SVP
 * (LO still uses Aqua under --headless; forcing SVP is unstable); prefer Skia raster + no GL.
 */
function buildLibreOfficeEnv(tmpHome) {
  const env = { ...process.env, HOME: tmpHome, TMPDIR: tmpHome, TMP: tmpHome, TEMP: tmpHome };
  if (process.platform === 'darwin') {
    delete env.SAL_USE_VCLPLUGIN;
    const vcl = (process.env.SAL_USE_VCLPLUGIN || '').trim();
    if (vcl) env.SAL_USE_VCLPLUGIN = vcl;
    if ((process.env.SAL_DISABLEGL || '1').trim() !== '0') env.SAL_DISABLEGL = '1';
    env.SAL_SKIA = (process.env.SAL_SKIA || 'raster').trim();
    if ((process.env.SAL_DISABLE_WATCHDOG || '1').trim() !== '0') env.SAL_DISABLE_WATCHDOG = '1';
  } else {
    env.SAL_USE_VCLPLUGIN = process.env.SAL_USE_VCLPLUGIN || 'svp';
  }
  return env;
}

function sofficeStderrTail(err, maxLen = 800) {
  const raw = String(err?.stderr || '').trim();
  if (!raw) return '';
  if (/\.dylib\b/i.test(raw) && /#\d+\s+\d+\s+/i.test(raw)) {
    return (
      'LibreOffice crashed during export (common on macOS headless). ' +
      'Update LibreOffice, or run the API on Linux/Docker. ' +
      `Raw stderr (truncated): ${raw.slice(0, Math.min(500, maxLen))}`
    );
  }
  return raw.length > maxLen ? raw.slice(-maxLen) : raw;
}

/**
 * PDF → .xlsx via LibreOffice (layout is best-effort; scans need OCR first).
 * @param {{ pdfPath: string, sofficePath: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertPdfFileToXlsxBuffer(opts) {
  const { pdfPath, sofficePath } = opts;
  if (!fs.existsSync(pdfPath)) {
    const err = new Error('PDF not found');
    err.code = 'ENOENT';
    throw err;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pdf2xlsx-'));
  const inputAbs = path.join(tmp, 'source.pdf');
  const profileDir = path.join(tmp, 'lo-profile');
  fs.mkdirSync(profileDir, { recursive: true });
  const loEnv = buildLibreOfficeEnv(tmp);
  const loPrefix = buildLibreOfficeArgv(profileDir);
  try {
    fs.copyFileSync(pdfPath, inputAbs);
    const attempts = ['xlsx', 'xlsx:Calc MS Excel 2007 XML'];
    let out = null;
    let lastErr = null;
    for (const fmt of attempts) {
      cleanExtArtifacts(tmp, ['xlsx']);
      try {
        await execSofficeConvert(
          sofficePath,
          [...loPrefix, '--convert-to', fmt, '--outdir', tmp, inputAbs],
          { timeout: 180_000, maxBuffer: 64 * 1024 * 1024, env: loEnv }
        );
      } catch (e) {
        lastErr = e;
        continue;
      }
      out = pickOutputByExt(tmp, 'xlsx');
      if (out) break;
    }
    if (!out && lastErr) {
      const tail = sofficeStderrTail(lastErr);
      const err = new Error(
        tail ? `LibreOffice failed (PDF→Excel): ${tail}` : 'LibreOffice failed while converting PDF to Excel.'
      );
      err.code = 'CONVERT_SOFFICE_FAILED';
      throw err;
    }
    if (!out) {
      const err = new Error(
        'Could not produce an Excel file from this PDF. Try a text-based PDF or run OCR on scans first.'
      );
      err.code = 'CONVERT_MISSING_OUTPUT';
      throw err;
    }
    return fs.readFileSync(out);
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * PDF → .pptx via LibreOffice (editable slides are best-effort).
 * @param {{ pdfPath: string, sofficePath: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertPdfFileToPptxBuffer(opts) {
  const { pdfPath, sofficePath } = opts;
  if (!fs.existsSync(pdfPath)) {
    const err = new Error('PDF not found');
    err.code = 'ENOENT';
    throw err;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-pdf2pptx-'));
  const inputAbs = path.join(tmp, 'source.pdf');
  const profileDir = path.join(tmp, 'lo-profile');
  fs.mkdirSync(profileDir, { recursive: true });
  const loEnv = buildLibreOfficeEnv(tmp);
  const loPrefix = buildLibreOfficeArgv(profileDir);
  try {
    fs.copyFileSync(pdfPath, inputAbs);
    const attempts = ['pptx', 'pptx:Impress MS PowerPoint 2007 XML'];
    let out = null;
    let lastErr = null;
    for (const fmt of attempts) {
      cleanExtArtifacts(tmp, ['pptx']);
      try {
        await execSofficeConvert(
          sofficePath,
          [...loPrefix, '--convert-to', fmt, '--outdir', tmp, inputAbs],
          { timeout: 180_000, maxBuffer: 64 * 1024 * 1024, env: loEnv }
        );
      } catch (e) {
        lastErr = e;
        continue;
      }
      out = pickOutputByExt(tmp, 'pptx');
      if (out) break;
    }
    if (!out && lastErr) {
      const tail = sofficeStderrTail(lastErr);
      const err = new Error(
        tail ? `LibreOffice failed (PDF→PowerPoint): ${tail}` : 'LibreOffice failed while converting PDF to PowerPoint.'
      );
      err.code = 'CONVERT_SOFFICE_FAILED';
      throw err;
    }
    if (!out) {
      const err = new Error(
        'Could not produce a PowerPoint file from this PDF. Try a simpler PDF or use PDF to Word instead.'
      );
      err.code = 'CONVERT_MISSING_OUTPUT';
      throw err;
    }
    return fs.readFileSync(out);
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Office / HTML → PDF via LibreOffice (`--convert-to pdf`).
 * @param {{ inputPath: string, sofficePath: string }} opts — input must exist with correct extension
 * @returns {Promise<Buffer>}
 */
export async function convertFileToPdfBuffer(opts) {
  const { inputPath, sofficePath } = opts;
  if (!fs.existsSync(inputPath)) {
    const err = new Error('Input file not found');
    err.code = 'ENOENT';
    throw err;
  }
  const dir = path.dirname(inputPath);
  const profileDir = path.join(dir, 'lo-profile');
  fs.mkdirSync(profileDir, { recursive: true });
  const loEnv = buildLibreOfficeEnv(dir);
  const loPrefix = buildLibreOfficeArgv(profileDir);
  try {
    await execSofficeConvert(
      sofficePath,
      [...loPrefix, '--convert-to', 'pdf', '--outdir', dir, inputPath],
      { timeout: 300_000, maxBuffer: 64 * 1024 * 1024, env: loEnv }
    );
  } catch (e) {
    const tail = sofficeStderrTail(e, 1200);
    const err = new Error(tail ? `LibreOffice failed (→PDF): ${tail}` : 'LibreOffice failed while converting to PDF.');
    err.code = 'CONVERT_SOFFICE_FAILED';
    throw err;
  }
  const stem = path.basename(inputPath, path.extname(inputPath));
  const outPdf = path.join(dir, `${stem}.pdf`);
  if (!fs.existsSync(outPdf)) {
    const err = new Error('LibreOffice did not write an output PDF. Check the input format and try again.');
    err.code = 'CONVERT_MISSING_OUTPUT';
    throw err;
  }
  return fs.readFileSync(outPdf);
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

  const loEnv = buildLibreOfficeEnv(tmp);
  const loPrefix = buildLibreOfficeArgv(profileDir);

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
        const tail = sofficeStderrTail(e, 1200);
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

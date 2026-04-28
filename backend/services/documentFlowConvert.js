import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'node:url';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const execFileAsync = promisify(execFile);

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

    const lines = text.split('\n');
    const children = lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun(line.length ? line : '\u00a0')],
        })
    );
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
 * Full Gotenberg base URL (no trailing slash).
 * - `GOTENBERG_URL`: explicit URL (local or public), e.g. https://gotenberg.example.com
 * - `GOTENBERG_HOSTPORT`: Render private network `host:port` from Blueprint `fromService`; `http://` is prepended.
 */
export function resolveGotenbergBaseUrl() {
  const direct = (process.env.GOTENBERG_URL || '').trim().replace(/\/$/, '');
  if (direct) return direct;
  const hp = (process.env.GOTENBERG_HOSTPORT || '').trim();
  if (!hp) return '';
  if (/^https?:\/\//i.test(hp)) return hp.replace(/\/$/, '');
  return `http://${hp}`.replace(/\/$/, '');
}

/** True if two URLs refer to the same host (Gotenberg must be a different service than this API). */
function sameHostname(a, b) {
  try {
    const ua = new URL(/^https?:\/\//i.test(a) ? a : `http://${a}`);
    const ub = new URL(/^https?:\/\//i.test(b) ? b : `http://${b}`);
    return ua.hostname.toLowerCase() === ub.hostname.toLowerCase();
  } catch {
    return false;
  }
}

function assertGotenbergNotSameHostAsApi(gotenbergBaseUrl) {
  const apiPublic = (process.env.RENDER_EXTERNAL_URL || '').trim();
  if (!apiPublic) return;
  if (!sameHostname(gotenbergBaseUrl, apiPublic)) return;
  const err = new Error(
    'GOTENBERG_URL points at this API (same host as RENDER_EXTERNAL_URL). It must be the base URL of your separate Gotenberg service, e.g. https://<your-gotenberg-name>.onrender.com — not this Node server.'
  );
  err.code = 'GOTENBERG_SELF_REFERENCE';
  throw err;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transientHealthStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

/**
 * GET Gotenberg `/health` so we can treat dead hostnames (e.g. Render `no-server`) as unreachable.
 * Retries transient gateway errors (502/503/504) — common right after a cold start on Render.
 *
 * @param {string} gotenbergBaseUrl
 * @param {{ maxAttempts?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, status?: number, noServer?: boolean, hint: string }>}
 */
export async function probeGotenbergHealth(gotenbergBaseUrl, opts = {}) {
  const base = gotenbergBaseUrl.replace(/\/$/, '');
  const healthUrl = `${base}/health`;
  const envAttempts = Number((process.env.GOTENBERG_HEALTH_ATTEMPTS || '').trim());
  const maxAttempts = Math.min(
    8,
    Math.max(1, Number.isFinite(envAttempts) && envAttempts > 0 ? envAttempts : opts.maxAttempts ?? 5)
  );
  const envDelay = Number((process.env.GOTENBERG_HEALTH_RETRY_MS || '').trim());
  const retryDelayMs = Math.min(
    15_000,
    Math.max(500, Number.isFinite(envDelay) && envDelay > 0 ? envDelay : opts.retryDelayMs ?? 2000)
  );

  let lastStatus;
  let lastHint;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const r = await fetch(healthUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      });
      lastStatus = r.status;
      const noServer = r.status === 404 && r.headers.get('x-render-routing') === 'no-server';
      if (noServer) {
        return {
          ok: false,
          status: 404,
          noServer: true,
          hint:
            'GOTENBERG_URL uses a hostname where Render has no running Web Service (404 + x-render-routing: no-server). In the Render dashboard, create a separate Web Service from the Gotenberg image (see render.yaml in this repo), deploy it, then set GOTENBERG_URL to the exact https URL on that service’s Overview page. Checking /health on your PDF API (edit-your-pdf-…) is not the same as checking Gotenberg.',
        };
      }
      if (r.ok) return { ok: true };
      lastHint = `Gotenberg GET ${healthUrl} returned HTTP ${r.status}. Fix GOTENBERG_URL or redeploy the Gotenberg service.${
        transientHealthStatus(r.status)
          ? ' Persistent 502 often means the Gotenberg instance is out of memory — use docker.io/gotenberg/gotenberg:8-libreoffice and/or a larger Render plan (see render.yaml in this repo).'
          : ''
      }`;
      if (transientHealthStatus(r.status) && attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
      return { ok: false, status: r.status, hint: lastHint };
    } catch (e) {
      const label = e?.name === 'TimeoutError' ? 'timed out' : e?.message || 'request failed';
      lastHint = `Could not reach Gotenberg at ${healthUrl} (${label}).`;
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
      return { ok: false, hint: lastHint };
    }
  }
  return {
    ok: false,
    status: lastStatus,
    hint: lastHint || `Gotenberg GET ${healthUrl} failed after ${maxAttempts} attempts.`,
  };
}

/** True when GOTENBERG_URL resolves and is not the same host as this API (Render public URL). */
export function isGotenbergBaseUsableForDocx() {
  const gotenbergUrl = resolveGotenbergBaseUrl();
  if (!gotenbergUrl) return false;
  const apiPublic = (process.env.RENDER_EXTERNAL_URL || '').trim();
  if (apiPublic && sameHostname(gotenbergUrl, apiPublic)) return false;
  return true;
}

/**
 * @returns {{
 *   pdfToDocx: boolean,
 *   docxToPdf: boolean,
 *   docxToPdfViaSoffice: boolean,
 *   docxToPdfViaGotenberg: boolean,
 *   sofficePath: string | null,
 *   gotenbergUrl: string | null,
 *   gotenbergSameHostAsApi?: boolean,
 * }}
 */
export function getDocumentFlowCapabilities() {
  const sofficePath = (process.env.SOFFICE_PATH || '').trim() || null;
  const gotenbergUrl = resolveGotenbergBaseUrl() || null;
  const apiPublic = (process.env.RENDER_EXTERNAL_URL || '').trim();
  const sameHost =
    Boolean(gotenbergUrl && apiPublic) && sameHostname(gotenbergUrl, apiPublic);
  const viaGotenberg = Boolean(gotenbergUrl) && !sameHost;
  const out = {
    pdfToDocx: Boolean(sofficePath),
    docxToPdf: Boolean(sofficePath) || viaGotenberg,
    docxToPdfViaSoffice: Boolean(sofficePath),
    docxToPdfViaGotenberg: viaGotenberg,
    sofficePath: sofficePath ? '(set)' : null,
    gotenbergUrl: gotenbergUrl ? '(set)' : null,
  };
  if (sameHost) out.gotenbergSameHostAsApi = true;
  return out;
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

function buildDocxMultipartForm(docxBuffer, filename) {
  const form = new FormData();
  const file = new File([new Uint8Array(docxBuffer)], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  form.append('files', file);
  return form;
}

function safeDocxInputName(filename) {
  const raw = path.basename(filename || 'document.docx');
  const cleaned = raw.replace(/[^\w.\- \u00C0-\u024f()]+/g, '_').slice(0, 120) || 'document.docx';
  return cleaned.toLowerCase().endsWith('.docx') ? cleaned : `${cleaned}.docx`;
}

/**
 * DOCX → PDF using local LibreOffice (`soffice`), same pattern as PDF → DOCX.
 *
 * @param {{ docxBuffer: Buffer, filename?: string, sofficePath: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertDocxBufferToPdfWithSoffice(opts) {
  const { docxBuffer, filename = 'document.docx', sofficePath } = opts;
  const inputName = safeDocxInputName(filename);
  const stem = inputName.toLowerCase().endsWith('.docx') ? inputName.slice(0, -5) : inputName;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfpilot-docx2pdf-'));
  const inputAbs = path.join(tmp, inputName);
  try {
    fs.writeFileSync(inputAbs, docxBuffer);
    await execFileAsync(
      sofficePath,
      [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--norestore',
        '--convert-to',
        'pdf',
        '--outdir',
        tmp,
        inputAbs,
      ],
      { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 }
    );
    const outPdf = path.join(tmp, `${stem}.pdf`);
    if (!fs.existsSync(outPdf)) {
      const err = new Error(
        'LibreOffice finished but the PDF was not created (unsupported or corrupt .docx).'
      );
      err.code = 'CONVERT_MISSING_OUTPUT';
      throw err;
    }
    const buf = fs.readFileSync(outPdf);
    if (buf.length < 64 || buf.toString('ascii', 0, 4) !== '%PDF') {
      const err = new Error('LibreOffice output was not a valid PDF');
      err.code = 'CONVERT_NOT_PDF';
      throw err;
    }
    return buf;
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * DOCX → PDF via Gotenberg LibreOffice module.
 * Retries transient 502/503/504 and timeouts (Render cold start / gateway) — does not fix chronic OOM; upgrade RAM/plan for that.
 *
 * @param {{ gotenbergBaseUrl: string, docxBuffer: Buffer, filename?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertDocxBufferToPdfViaGotenberg(opts) {
  const { gotenbergBaseUrl, docxBuffer, filename = 'document.docx' } = opts;
  const base = gotenbergBaseUrl.replace(/\/$/, '');
  assertGotenbergNotSameHostAsApi(base);
  const url = `${base}/forms/libreoffice/convert`;

  const envAttempts = Number((process.env.GOTENBERG_CONVERT_MAX_ATTEMPTS || '').trim());
  const maxAttempts = Math.min(
    8,
    Math.max(1, Number.isFinite(envAttempts) && envAttempts > 0 ? envAttempts : 3)
  );
  const envDelay = Number((process.env.GOTENBERG_CONVERT_RETRY_MS || '').trim());
  const retryDelayMs = Math.min(
    20_000,
    Math.max(800, Number.isFinite(envDelay) && envDelay > 0 ? envDelay : 2500)
  );
  const envTimeout = Number((process.env.GOTENBERG_CONVERT_TIMEOUT_MS || '').trim());
  const timeoutMs = Math.min(
    600_000,
    Math.max(45_000, Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 180_000)
  );

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const form = buildDocxMultipartForm(docxBuffer, filename);
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok) {
        if (transientHealthStatus(res.status) && attempt < maxAttempts) {
          await sleep(retryDelayMs);
          continue;
        }
        let msg = buf.slice(0, 800).toString('utf8') || res.statusText;
        if (res.status === 404) {
          const noServer = res.headers.get('x-render-routing') === 'no-server';
          if (noServer) {
            const host = (() => {
              try {
                return new URL(base).hostname;
              } catch {
                return base;
              }
            })();
            msg += `\n\nRender reports no web service for host "${host}" (x-render-routing: no-server). That hostname is not attached to a running service — create or resume your Gotenberg Web Service on Render and set GOTENBERG_URL to the exact URL shown on that service’s Overview page (not a guessed *.onrender.com name).`;
          } else {
            msg += `\n\n404 usually means GOTENBERG_URL is not a Gotenberg base URL (this app calls POST …/forms/libreoffice/convert). Try GET ${base}/health in a browser — Gotenberg returns JSON; if you see HTML, 404, or your own API, set GOTENBERG_URL to your separate Gotenberg Web Service on Render.`;
          }
        }
        const err = new Error(`Gotenberg error ${res.status}: ${msg}`);
        err.code = 'GOTENBERG_HTTP';
        err.status = res.status;
        throw err;
      }
      if (buf.length < 64 || buf.toString('ascii', 0, 4) !== '%PDF') {
        const err = new Error('Gotenberg response was not a PDF');
        err.code = 'GOTENBERG_NOT_PDF';
        throw err;
      }
      return buf;
    } catch (e) {
      lastErr = e;
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      const transientNet =
        !e?.status &&
        typeof e?.message === 'string' &&
        /fetch|ECONNRESET|ECONNREFUSED|socket|network/i.test(e.message);
      if ((timedOut || transientNet) && attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Gotenberg convert failed after retries');
}

/**
 * DOCX → PDF: uses **SOFFICE_PATH** first when set, then falls back to Gotenberg if `gotenbergBaseUrl` is provided.
 *
 * @param {{
 *   gotenbergBaseUrl?: string,
 *   docxBuffer: Buffer,
 *   filename?: string,
 *   sofficePath?: string,
 * }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertDocxBufferToPdfBuffer(opts) {
  const { gotenbergBaseUrl = '', docxBuffer, filename = 'document.docx', sofficePath: sofficeOpt } = opts;
  const sofficePath = (sofficeOpt || process.env.SOFFICE_PATH || '').trim();
  const gotenberg = (gotenbergBaseUrl || '').trim();

  const engine = (process.env.DOCX_TO_PDF_ENGINE || 'auto').trim().toLowerCase();

  if (engine === 'gotenberg') {
    if (!gotenberg) {
      const err = new Error('DOCX_TO_PDF_ENGINE=gotenberg but GOTENBERG_URL is not usable');
      err.code = 'DOCX_TO_PDF_UNCONFIGURED';
      throw err;
    }
    return convertDocxBufferToPdfViaGotenberg({ gotenbergBaseUrl: gotenberg, docxBuffer, filename });
  }
  if (engine === 'soffice') {
    if (!sofficePath) {
      const err = new Error('DOCX_TO_PDF_ENGINE=soffice but SOFFICE_PATH is not set');
      err.code = 'DOCX_TO_PDF_UNCONFIGURED';
      throw err;
    }
    return convertDocxBufferToPdfWithSoffice({ docxBuffer, filename, sofficePath });
  }

  if (sofficePath) {
    try {
      return await convertDocxBufferToPdfWithSoffice({ docxBuffer, filename, sofficePath });
    } catch (e) {
      console.warn('[document-flow] LibreOffice DOCX→PDF failed:', e?.message || e);
      if (gotenberg) {
        console.warn('[document-flow] Falling back to Gotenberg');
        return convertDocxBufferToPdfViaGotenberg({ gotenbergBaseUrl: gotenberg, docxBuffer, filename });
      }
      throw e;
    }
  }
  if (gotenberg) {
    return convertDocxBufferToPdfViaGotenberg({ gotenbergBaseUrl: gotenberg, docxBuffer, filename });
  }
  const err = new Error(
    'DOCX→PDF: set SOFFICE_PATH (LibreOffice on this server) and/or GOTENBERG_URL (separate Gotenberg service).'
  );
  err.code = 'DOCX_TO_PDF_UNCONFIGURED';
  throw err;
}

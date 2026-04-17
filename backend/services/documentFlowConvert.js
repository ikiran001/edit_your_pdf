import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

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

/**
 * GET Gotenberg `/health` so we can treat dead hostnames (e.g. Render `no-server`) as unreachable.
 * @param {string} gotenbergBaseUrl
 * @returns {Promise<{ ok: true } | { ok: false, status?: number, noServer?: boolean, hint: string }>}
 */
export async function probeGotenbergHealth(gotenbergBaseUrl) {
  const base = gotenbergBaseUrl.replace(/\/$/, '');
  const healthUrl = `${base}/health`;
  try {
    const r = await fetch(healthUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
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
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        hint: `Gotenberg GET ${healthUrl} returned HTTP ${r.status}. Fix GOTENBERG_URL or redeploy the Gotenberg service.`,
      };
    }
    return { ok: true };
  } catch (e) {
    const label = e?.name === 'TimeoutError' ? 'timed out' : e?.message || 'request failed';
    return {
      ok: false,
      hint: `Could not reach Gotenberg at ${healthUrl} (${label}).`,
    };
  }
}

/**
 * @returns {{
 *   pdfToDocx: boolean,
 *   docxToPdf: boolean,
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
  const out = {
    pdfToDocx: Boolean(sofficePath),
    docxToPdf: Boolean(gotenbergUrl) && !sameHost,
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
  try {
    fs.copyFileSync(pdfPath, inputAbs);
    await execFileAsync(
      sofficePath,
      [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--norestore',
        '--convert-to',
        'docx',
        '--outdir',
        tmp,
        inputAbs,
      ],
      { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 }
    );
    const outDocx = path.join(tmp, 'source.docx');
    if (!fs.existsSync(outDocx)) {
      const err = new Error(
        'LibreOffice finished but source.docx was not created (this PDF may not export to Word).'
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

/**
 * DOCX → PDF via Gotenberg LibreOffice module.
 * @param {{ gotenbergBaseUrl: string, docxBuffer: Buffer, filename?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function convertDocxBufferToPdfBuffer(opts) {
  const { gotenbergBaseUrl, docxBuffer, filename = 'document.docx' } = opts;
  const base = gotenbergBaseUrl.replace(/\/$/, '');
  assertGotenbergNotSameHostAsApi(base);
  const url = `${base}/forms/libreoffice/convert`;

  const form = new FormData();
  const file = new File([new Uint8Array(docxBuffer)], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  form.append('files', file);

  const res = await fetch(url, { method: 'POST', body: form });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
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
}

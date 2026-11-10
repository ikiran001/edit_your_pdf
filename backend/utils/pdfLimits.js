import { PDFDocument } from 'pdf-lib';

/** Max pages a single PDF may have before a heavy native tool is allowed to touch it. */
export const MAX_PDF_PAGES = Number.parseInt(process.env.MAX_PDF_PAGES || '', 10) || 500;

/**
 * Guard against page / decompression bombs: a 52 MB upload can expand to an enormous
 * page or object count that pins CPU/RAM in qpdf / Ghostscript / LibreOffice for the
 * full timeout. Count pages cheaply with pdf-lib and reject before handing the bytes off.
 *
 * Fail-open on unparseable input (e.g. an encrypted PDF pdf-lib can't open): the
 * downstream tool and its timeout still apply.
 *
 * @returns {Promise<{ok:true, pageCount:number|null} | {ok:false, status:number, body:object, pageCount:number}>}
 */
export async function guardPdfPageCount(buffer, max = MAX_PDF_PAGES) {
  let pageCount;
  try {
    const doc = await PDFDocument.load(buffer, { updateMetadata: false, ignoreEncryption: true });
    pageCount = doc.getPageCount();
  } catch {
    return { ok: true, pageCount: null };
  }
  if (pageCount > max) {
    return {
      ok: false,
      status: 413,
      body: {
        error: 'too_many_pages',
        message: `This PDF has ${pageCount} pages, over the ${max}-page limit for this tool.`,
      },
      pageCount,
    };
  }
  return { ok: true, pageCount };
}

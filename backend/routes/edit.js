import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyEditsToPdf } from '../services/applyEdits.js';
import {
  applyTextReplacements,
  defaultEditorToLoveRules,
} from '../services/applyTextReplacements.js';
import { dedupeNativeTextEditRecords, mergeEditsWithNative } from '../utils/mergeEdits.js';
import { dedupeAnnotTextItemsBySlot } from '../utils/nativeTextOverlap.js';
import {
  loadNativeTextEdits,
  saveNativeTextEdits,
  loadSessionEdits,
  saveSessionEdits,
  sessionHasAnnotationItems,
  mergeAnnotationEdits,
} from '../utils/sessionEditPersistence.js';

/** Full snapshot from editor: each page list replaces persisted markup for that page (omitted pages = none). */
function normalizeAuthoritativeAnnotationEdits(incoming) {
  const pages = (incoming?.pages || [])
    .map((g) => {
      const pageIndex = Number(g.pageIndex);
      const items = dedupeAnnotTextItemsBySlot(Array.isArray(g.items) ? g.items : []);
      return { pageIndex, items };
    })
    .filter((g) => Number.isFinite(g.pageIndex) && g.items.length > 0);
  return { pages };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

function isValidPdfBytes(buf) {
  if (!buf || buf.length < 32) return false;
  const head = buf.subarray(0, 5).toString('ascii');
  return head === '%PDF-';
}

const router = Router();

const debugEdit = process.env.DEBUG_PDF_EDIT === '1' || process.env.DEBUG_PDF_EDIT === 'true';

/**
 * GET /editor-state/:sessionId — persisted native text edits + session markup for the editor.
 * Markup is also baked into edited.pdf; the client marks hydrated items `rasterizedInPdf` so it does
 * not draw them twice on the canvas (see PdfPageCanvas).
 */
router.get('/editor-state/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }
  const dir = path.join(uploadsRoot, sessionId);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Session not found' });
  const nativeTextEdits = loadNativeTextEdits(uploadsRoot, sessionId);
  const edits = loadSessionEdits(uploadsRoot, sessionId);
  return res.json({ nativeTextEdits, edits });
});

/**
 * POST /edit — applies client edit payload with pdf-lib, writes edited.pdf for the session.
 *
 * Rebuilds from original.pdf + merged native text edits + merged annotation items. Annotation items
 * are accumulated in session-edits.json by stable `id` so a second save (client only sends new boxes
 * after reload) does not drop earlier flattened text.
 */
router.post('/edit', express.json({ limit: '52mb' }), async (req, res) => {
  const {
    sessionId,
    edits,
    applyTextSwap,
    textReplaceRules,
    nativeTextEdits,
    /** When true, replace session-edits.json with empty (used by editor “Clear all”). */
    replaceSessionAnnotations,
    /**
     * When true, `edits.pages` is the full current markup snapshot (Add Text / draw / …).
     * Replaces session-edits.json so removals are not resurrected from the old merge-with-persisted logic.
     */
    annotationsAuthoritative,
    /** When true, pdf-lib flattens AcroForm fields into page content (no fillable widgets). */
    flattenForms,
  } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }
  const originalPath = path.join(uploadsRoot, sessionId, 'original.pdf');
  const editedPath = path.join(uploadsRoot, sessionId, 'edited.pdf');
  const outPath = editedPath;
  if (!fs.existsSync(originalPath)) {
    return res.status(404).json({ error: 'Session or PDF not found' });
  }
  try {
    /**
     * Client always sends the full current native list; treat it as authoritative so removals
     * are not resurrected from native-text-edits.json (old merge concatenated persisted + incoming).
     */
    let mergedNative;
    if (Array.isArray(nativeTextEdits)) {
      mergedNative = dedupeNativeTextEditRecords(nativeTextEdits);
      saveNativeTextEdits(uploadsRoot, sessionId, mergedNative);
    } else {
      mergedNative = loadNativeTextEdits(uploadsRoot, sessionId);
    }

    const incomingEdits = edits && typeof edits === 'object' ? edits : { pages: [] };
    const persistedAnnot = loadSessionEdits(uploadsRoot, sessionId);
    let pagesEdits;
    if (replaceSessionAnnotations) {
      pagesEdits = { pages: [] };
      saveSessionEdits(uploadsRoot, sessionId, pagesEdits);
    } else if (annotationsAuthoritative === true) {
      pagesEdits = normalizeAuthoritativeAnnotationEdits(incomingEdits);
      saveSessionEdits(uploadsRoot, sessionId, pagesEdits);
    } else if (sessionHasAnnotationItems(incomingEdits)) {
      pagesEdits = mergeAnnotationEdits(persistedAnnot, incomingEdits);
      saveSessionEdits(uploadsRoot, sessionId, pagesEdits);
    } else {
      pagesEdits = persistedAnnot;
    }

    let pdfBytes = fs.readFileSync(originalPath);

    const rules =
      Array.isArray(textReplaceRules) && textReplaceRules.length
        ? textReplaceRules
        : applyTextSwap
          ? defaultEditorToLoveRules
          : null;
    if (rules?.length) {
      try {
        const swapped = await applyTextReplacements(pdfBytes, rules);
        if (isValidPdfBytes(swapped)) {
          pdfBytes = swapped;
        } else {
          console.error(
            'edit: applyTextReplacements returned invalid PDF; keeping previous bytes',
          );
        }
      } catch (replErr) {
        console.error('edit: applyTextReplacements skipped:', replErr);
      }
    }

    const merged = mergeEditsWithNative(pagesEdits || { pages: [] }, mergedNative);
    const doFlatten = flattenForms === true;
    const out = await applyEditsToPdf(pdfBytes, merged, { flattenForms: doFlatten });
    fs.writeFileSync(outPath, out);

    if (debugEdit) {
      const nItems = (mergedNative || []).length;
      const annPages = (pagesEdits?.pages || []).filter((g) => (g.items || []).length > 0)
        .length;
      console.info(
        `[edit] session=${sessionId.slice(0, 8)}… native=${nItems} annotationPages=${annPages} bytesOut=${out.length}`,
      );
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('edit:', e);
    const details = e instanceof Error ? e.message : String(e);
    return res.status(500).json({
      error: 'Failed to apply edits',
      details: details.slice(0, 500),
    });
  }
});

export default router;

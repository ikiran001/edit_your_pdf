import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyEditsToPdf } from '../services/applyEdits.js';
import {
  applyTextReplacements,
  defaultEditorToLoveRules,
} from '../services/applyTextReplacements.js';
import { mergeEditsWithNative } from '../utils/mergeEdits.js';
import {
  loadNativeTextEdits,
  saveNativeTextEdits,
  mergeNativeTextEdits,
  loadSessionEdits,
  saveSessionEdits,
  sessionHasAnnotationItems,
  mergeAnnotationEdits,
} from '../utils/sessionEditPersistence.js';

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
 * GET /editor-state/:sessionId — persisted native text edits for client hydration.
 * Annotation overlays are not returned: they are flattened into edited.pdf; re-hydrating them would
 * duplicate text on top of the raster. Accumulated annotations live only in session-edits.json for
 * server-side rebuild-from-original on each POST /edit.
 */
router.get('/editor-state/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }
  const dir = path.join(uploadsRoot, sessionId);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Session not found' });
  const nativeTextEdits = loadNativeTextEdits(uploadsRoot, sessionId);
  return res.json({ nativeTextEdits, edits: { pages: [] } });
});

/**
 * POST /edit — applies client edit payload with pdf-lib, writes edited.pdf for the session.
 *
 * Rebuilds from original.pdf + merged native text edits + merged annotation items. Annotation items
 * are accumulated in session-edits.json by stable `id` so a second save (client only sends new boxes
 * after reload) does not drop earlier flattened text.
 */
router.post('/edit', express.json({ limit: '52mb' }), async (req, res) => {
  const { sessionId, edits, applyTextSwap, textReplaceRules, nativeTextEdits } =
    req.body || {};
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
    const persistedNative = loadNativeTextEdits(uploadsRoot, sessionId);
    const mergedNative = mergeNativeTextEdits(persistedNative, nativeTextEdits || []);
    saveNativeTextEdits(uploadsRoot, sessionId, mergedNative);

    const incomingEdits = edits && typeof edits === 'object' ? edits : { pages: [] };
    const persistedAnnot = loadSessionEdits(uploadsRoot, sessionId);
    let pagesEdits;
    if (sessionHasAnnotationItems(incomingEdits)) {
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
    const out = await applyEditsToPdf(pdfBytes, merged);
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

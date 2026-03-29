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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

/**
 * POST /edit — applies client edit payload with pdf-lib, writes edited.pdf for the session.
 */
router.post('/edit', express.json({ limit: '50mb' }), async (req, res) => {
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
    // Chain edits: after the first save, client clears in-memory native edits and reloads from
    // edited.pdf — the next POST must start from the latest file, not original, or changes revert.
    let pdfBytes;
    if (fs.existsSync(editedPath)) {
      try {
        pdfBytes = fs.readFileSync(editedPath);
      } catch {
        pdfBytes = fs.readFileSync(originalPath);
      }
    } else {
      pdfBytes = fs.readFileSync(originalPath);
    }
    const rules =
      Array.isArray(textReplaceRules) && textReplaceRules.length
        ? textReplaceRules
        : applyTextSwap
          ? defaultEditorToLoveRules
          : null;
    if (rules?.length) {
      pdfBytes = await applyTextReplacements(pdfBytes, rules);
    }
    const merged = mergeEditsWithNative(edits || { pages: [] }, nativeTextEdits);
    const out = await applyEditsToPdf(pdfBytes, merged);
    fs.writeFileSync(outPath, out);
    return res.json({ ok: true });
  } catch (e) {
    console.error('edit:', e);
    return res.status(500).json({ error: 'Failed to apply edits' });
  }
});

export default router;

import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyEditsToPdf } from '../services/applyEdits.js';
import {
  applyTextReplacements,
  defaultEditorToLoveRules,
} from '../services/applyTextReplacements.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

/**
 * POST /edit — applies client edit payload with pdf-lib, writes edited.pdf for the session.
 */
router.post('/edit', express.json({ limit: '50mb' }), async (req, res) => {
  const { sessionId, edits, applyTextSwap, textReplaceRules } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }
  const originalPath = path.join(uploadsRoot, sessionId, 'original.pdf');
  const outPath = path.join(uploadsRoot, sessionId, 'edited.pdf');
  if (!fs.existsSync(originalPath)) {
    return res.status(404).json({ error: 'Session or PDF not found' });
  }
  try {
    let pdfBytes = fs.readFileSync(originalPath);
    const rules =
      Array.isArray(textReplaceRules) && textReplaceRules.length
        ? textReplaceRules
        : applyTextSwap
          ? defaultEditorToLoveRules
          : null;
    if (rules?.length) {
      pdfBytes = await applyTextReplacements(pdfBytes, rules);
    }
    const out = await applyEditsToPdf(pdfBytes, edits || { pages: [] });
    fs.writeFileSync(outPath, out);
    return res.json({ ok: true });
  } catch (e) {
    console.error('edit:', e);
    return res.status(500).json({ error: 'Failed to apply edits' });
  }
});

export default router;

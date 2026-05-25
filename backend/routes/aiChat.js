import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { extractPdfText } from '../services/extractPdfText.js';
import { requirePro } from '../middleware/requirePro.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const router = Router();

/** ~120k characters ≈ 30k tokens — comfortably inside gpt-4o-mini's 128k context with headroom for chat history. */
const MAX_CONTEXT_CHARS = 120_000;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_TURNS = 12;

/** Cached extracted PDF text per session: { text, numPages, mtimeMs, filePath }. */
const textCache = new Map();

async function getSessionPdfText(sessionId) {
  const dir = path.join(uploadsRoot, sessionId);
  const edited = path.join(dir, 'edited.pdf');
  const original = path.join(dir, 'original.pdf');
  const filePath = fs.existsSync(edited) ? edited : original;
  if (!fs.existsSync(filePath)) {
    const err = new Error('Session not found. Re-upload the PDF.');
    err.status = 404;
    throw err;
  }
  const stat = await fs.promises.stat(filePath);
  const cached = textCache.get(sessionId);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.filePath === filePath) {
    return cached;
  }
  const { text, numPages, truncated } = await extractPdfText(filePath);
  const entry = { text, numPages, truncated, mtimeMs: stat.mtimeMs, filePath };
  textCache.set(sessionId, entry);
  return entry;
}

router.post('/ai/chat', express.json({ limit: '1mb' }), requirePro, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res
        .status(503)
        .json({ error: 'AI chat is not configured on this server (missing OPENAI_API_KEY).' });
    }

    const { sessionId, message, history } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Missing sessionId.' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Missing message.' });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(413).json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} chars).` });
    }

    let pdf;
    try {
      pdf = await getSessionPdfText(sessionId);
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message || 'Failed to read PDF.' });
    }

    let context = pdf.text || '';
    let contextTruncated = pdf.truncated;
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS);
      contextTruncated = true;
    }
    if (!context.trim()) {
      return res.status(422).json({
        error:
          'No selectable text found in this PDF. Run OCR (Tools → OCR PDF) first, then re-upload.',
      });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string'
          )
          .slice(-MAX_HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
      : [];

    const systemPrompt = [
      'You are a helpful assistant that answers questions about a PDF document the user has uploaded.',
      'Use ONLY the document text provided below to answer. If the answer is not in the document, say so plainly.',
      'Cite page numbers like (p. 3) when the answer is supported by a specific page. Keep answers concise.',
      contextTruncated
        ? 'NOTE: The document was truncated to fit the context window — some content may be missing.'
        : '',
      '',
      '--- DOCUMENT TEXT START ---',
      context,
      '--- DOCUMENT TEXT END ---',
    ]
      .filter(Boolean)
      .join('\n');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          ...safeHistory,
          { role: 'user', content: message },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const body = await openaiRes.text().catch(() => '');
      console.error('[ai/chat] openai error', openaiRes.status, body.slice(0, 500));
      const status = openaiRes.status === 401 ? 503 : 502;
      return res.status(status).json({ error: 'AI provider request failed.' });
    }

    const data = await openaiRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '';
    return res.json({
      reply,
      numPages: pdf.numPages,
      contextTruncated,
      model,
    });
  } catch (e) {
    console.error('[ai/chat] unhandled', e);
    return res.status(500).json({ error: 'AI chat failed.' });
  }
});

export default router;

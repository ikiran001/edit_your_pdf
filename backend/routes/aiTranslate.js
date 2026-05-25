import express, { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

/** Keeps prompts comfortably inside gpt-4o-mini's 128k context with headroom for the translation output. */
const MAX_INPUT_CHARS = 80_000;

const TARGET_LANG_LABELS = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  hi: 'Hindi',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
  nl: 'Dutch',
  en: 'English',
};

router.post(
  '/ai/translate',
  express.json({ limit: '2mb' }),
  requireAuth,
  async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res
          .status(503)
          .json({ error: 'AI translation is not configured on this server (missing OPENAI_API_KEY).' });
      }

      const { text, targetLang } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Missing text to translate.' });
      }
      const langKey = typeof targetLang === 'string' ? targetLang.toLowerCase() : '';
      const languageLabel = TARGET_LANG_LABELS[langKey];
      if (!languageLabel) {
        return res
          .status(400)
          .json({ error: `Unsupported target language: ${targetLang}` });
      }

      let input = text;
      let truncated = false;
      if (input.length > MAX_INPUT_CHARS) {
        input = input.slice(0, MAX_INPUT_CHARS);
        truncated = true;
      }

      const systemPrompt = [
        `You are a professional translator. Translate the user's text into ${languageLabel}.`,
        'Rules:',
        '- Preserve paragraph breaks and line spacing exactly.',
        '- Translate meaning faithfully; do not summarize, paraphrase, or add commentary.',
        '- Keep proper nouns, numbers, and acronyms unchanged unless they have a well-known localized form.',
        '- Return ONLY the translated text — no preface, no quotes, no explanations.',
      ].join('\n');

      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
        }),
      });

      if (!openaiRes.ok) {
        const body = await openaiRes.text().catch(() => '');
        console.error('[ai/translate] openai error', openaiRes.status, body.slice(0, 500));
        const status = openaiRes.status === 401 ? 503 : 502;
        return res.status(status).json({ error: 'AI provider request failed.' });
      }

      const data = await openaiRes.json();
      const translated = data?.choices?.[0]?.message?.content?.trim() || '';
      if (!translated) {
        return res.status(502).json({ error: 'AI returned an empty translation.' });
      }
      return res.json({
        translated,
        targetLang: langKey,
        targetLanguageLabel: languageLabel,
        truncated,
        model,
      });
    } catch (e) {
      console.error('[ai/translate] unhandled', e);
      return res.status(500).json({ error: 'AI translation failed.' });
    }
  }
);

export default router;

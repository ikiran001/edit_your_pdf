/**
 * On-device translation via Transformers.js (NLLB ONNX). Downloads model weights from Hugging Face on first use.
 */

const NLLB_MODEL = 'Xenova/nllb-200-distilled-600M'

/** UI target codes → NLLB FLORES 200 targets */
const TARGET_UI_TO_NLLB = {
  es: 'spa_Latn',
  fr: 'fra_Latn',
  de: 'deu_Latn',
  it: 'ita_Latn',
  pt: 'por_Latn',
  hi: 'hin_Deva',
  ja: 'jpn_Jpan',
  zh: 'zho_Hans',
  ko: 'kor_Hang',
  ar: 'arb_Arab',
  ru: 'rus_Cyrl',
  nl: 'nld_Latn',
}

/** franc ISO 639-3 → NLLB FLORES src tag (unknown → eng_Latn). Keep conservative to avoid invalid codes. */
const ISO3_TO_NLLB_SRC = {
  eng: 'eng_Latn',
  spa: 'spa_Latn',
  fra: 'fra_Latn',
  deu: 'deu_Latn',
  ita: 'ita_Latn',
  por: 'por_Latn',
  hin: 'hin_Deva',
  jpn: 'jpn_Jpan',
  zho: 'zho_Hans',
  cmn: 'zho_Hans',
  kor: 'kor_Hang',
  ara: 'arb_Arab',
  arb: 'arb_Arab',
  rus: 'rus_Cyrl',
  nld: 'nld_Latn',
  swe: 'swe_Latn',
  pol: 'pol_Latn',
  tur: 'tur_Latn',
  vie: 'vie_Latn',
  tha: 'tha_Thai',
  ben: 'ben_Beng',
  tam: 'tam_Taml',
  tel: 'tel_Telu',
  pan: 'pan_Guru',
  guj: 'guj_Gujr',
  kan: 'kan_Knda',
  mal: 'mal_Mlym',
  urd: 'urd_Arab',
  pes: 'pes_Arab',
  fas: 'pes_Arab',
  ukr: 'ukr_Cyrl',
  ces: 'ces_Latn',
  hun: 'hun_Latn',
  ron: 'ron_Latn',
  bul: 'bul_Cyrl',
  ell: 'ell_Grek',
  heb: 'heb_Hebr',
  ind: 'ind_Latn',
  zsm: 'zsm_Latn',
  msa: 'zsm_Latn',
  tgl: 'tgl_Latn',
  fil: 'tgl_Latn',
}

const MAX_CHARS_PER_CHUNK = 380

let translatorPromise = null
let progressSink = null

function chunkText(text) {
  const t = String(text || '')
  if (t.length <= MAX_CHARS_PER_CHUNK) return [t]
  const parts = []
  let i = 0
  while (i < t.length) {
    let end = Math.min(i + MAX_CHARS_PER_CHUNK, t.length)
    if (end < t.length) {
      const slice = t.slice(i, end)
      const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '))
      if (breakAt > 120) end = i + breakAt + 1
    }
    parts.push(t.slice(i, end))
    i = end
  }
  return parts
}

async function detectSrcNllb(sample) {
  const { franc } = await import('franc-min')
  const iso3 = franc(sample.slice(0, 2048), { minLength: 10 })
  if (!iso3 || iso3 === 'und') return 'eng_Latn'
  return ISO3_TO_NLLB_SRC[iso3] || 'eng_Latn'
}

function normalizeTranslatorOutput(raw) {
  if (!raw) return ''
  const first = Array.isArray(raw) ? raw[0] : raw
  const s = first?.translation_text ?? first?.generated_text ?? ''
  return String(s || '').trim()
}

async function getTranslator() {
  if (!translatorPromise) {
    const p = import('@xenova/transformers').then(async (transformers) => {
      // Default allowLocalModels hits same-origin /models/... — Vite serves index.html → JSON.parse fails.
      transformers.env.allowLocalModels = false
      transformers.env.allowRemoteModels = true
      const { pipeline } = transformers
      return pipeline('translation', NLLB_MODEL, {
        quantized: true,
        progress_callback: (data) => progressSink?.(data),
      })
    })
    translatorPromise = p.catch((err) => {
      translatorPromise = null
      throw err
    })
  }
  return translatorPromise
}

function formatProgressMessage(data) {
  if (!data || typeof data !== 'object') return null
  if (data.status === 'download' && data.file) {
    return `Downloading model: ${data.file}…`
  }
  if (data.status === 'progress' && typeof data.progress === 'number') {
    const pct = Math.round(data.progress)
    const file = data.file ? ` · ${data.file}` : ''
    return `Loading model ${pct}%${file}`
  }
  if (data.status === 'ready') {
    return 'Model ready.'
  }
  return null
}

/**
 * @param {object} opts
 * @param {string} opts.text - plain text to translate
 * @param {string} opts.targetUiCode - es, fr, de, it, pt, hi, ja, zh, ko, ar, ru, nl
 * @param {(msg: string) => void} [opts.onStatus] - loading / chunk progress
 * @returns {Promise<string>}
 */
function looksLikeHtmlInsteadOfJsonError(err) {
  const msg = String(err?.message || '')
  return /Unexpected token|not valid JSON|<!doctype/i.test(msg)
}

async function translatePlainTextOnDeviceOnce({ text, targetUiCode, onStatus }) {
  const tgtLang = TARGET_UI_TO_NLLB[targetUiCode]
  if (!tgtLang) {
    throw new Error(`Unsupported target language: ${targetUiCode}`)
  }

  const trimmed = String(text || '').trim()
  if (trimmed.length < 2) return ''

  const srcLang = await detectSrcNllb(trimmed)
  if (srcLang === tgtLang) {
    onStatus?.('Source and target language look the same — skipping translation.')
    return trimmed
  }

  const chunks = chunkText(trimmed)

  progressSink = (data) => {
    const msg = formatProgressMessage(data)
    if (msg) onStatus?.(msg)
  }

  try {
    const translator = await getTranslator()

    const parts = []
    for (let i = 0; i < chunks.length; i++) {
      onStatus?.(`Translating section ${i + 1} of ${chunks.length}…`)
      const raw = await translator(chunks[i], {
        src_lang: srcLang,
        tgt_lang: tgtLang,
        max_new_tokens: 256,
      })
      parts.push(normalizeTranslatorOutput(raw))
    }
    return parts.join('\n\n').trim()
  } finally {
    progressSink = null
  }
}

export async function translatePlainTextOnDevice(opts) {
  try {
    return await translatePlainTextOnDeviceOnce(opts)
  } catch (e) {
    if (looksLikeHtmlInsteadOfJsonError(e) && typeof caches !== 'undefined') {
      try {
        await caches.delete('transformers-cache')
      } catch (_) {
        /* ignore */
      }
      translatorPromise = null
      return translatePlainTextOnDeviceOnce(opts)
    }
    throw e
  }
}

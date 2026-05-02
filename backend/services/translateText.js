/**
 * Translation helpers for POST /document-flow/translate.
 * LibreTranslate public hosts often require an API key; MyMemory is used as a no-key fallback (quota limits apply).
 */

/** Map app language codes to MyMemory langpair codes where they differ */
const MYMEMORY_TARGET_MAP = {
  zh: 'zh-CN',
}

const MYMEMORY_CHUNK = 450

/**
 * @param {string} text
 * @returns {string[]}
 */
function chunkForMyMemory(text) {
  const t = String(text || '')
  if (t.length <= MYMEMORY_CHUNK) return t ? [t] : []
  const parts = []
  let i = 0
  while (i < t.length) {
    let end = Math.min(i + MYMEMORY_CHUNK, t.length)
    if (end < t.length) {
      const slice = t.slice(i, end)
      const br = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '))
      if (br > 80) end = i + br + 1
    }
    parts.push(t.slice(i, end))
    i = end
  }
  return parts
}

/**
 * @param {string} chunk
 * @param {string} source — ISO code or 'auto'
 * @param {string} target
 */
async function translateMyMemoryOne(chunk, source, target) {
  const tgt = MYMEMORY_TARGET_MAP[target] || target
  const pairs =
    source === 'auto'
      ? [
          ['auto', tgt],
          ['en', tgt],
        ]
      : [[source, tgt]]

  let lastErr = null
  for (const [src, tg] of pairs) {
    const langpair = encodeURIComponent(`${src}|${tg}`)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langpair}`
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } })
      const data = await r.json().catch(() => ({}))
      const out = data.responseData?.translatedText
      const status = data.responseStatus
      if (typeof out === 'string' && out.length) {
        if (out.includes('MYMEMORY WARNING')) {
          lastErr = new Error(
            'Free translation quota exceeded for today. Set LIBRETRANSLATE_API_KEY on the server or try again tomorrow.'
          )
          continue
        }
        if (status == null || status === 200 || status === 206) {
          return out
        }
      }
      const errLine = data.responseData?.error || data.errormessage
      if (errLine) {
        lastErr = new Error(String(errLine))
      } else {
        lastErr = new Error(`MyMemory returned status ${status ?? 'unknown'}`)
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr || new Error('MyMemory translation failed')
}

/**
 * @param {string} q
 * @param {string} source
 * @param {string} target
 */
export async function translateViaMyMemory(q, source, target) {
  const chunks = chunkForMyMemory(q)
  if (!chunks.length) return ''
  const out = []
  for (let i = 0; i < chunks.length; i++) {
    const piece = await translateMyMemoryOne(chunks[i], source || 'auto', target || 'en')
    out.push(piece)
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 120))
    }
  }
  return out.join('')
}

/**
 * @param {string} base — LibreTranslate base URL (no trailing slash)
 * @param {string} q
 * @param {string} source
 * @param {string} target
 * @param {string} [apiKey]
 */
export async function translateViaLibreTranslate(base, q, source, target, apiKey) {
  const url = `${base}/translate`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      q,
      source: source || 'auto',
      target: target || 'en',
      format: 'text',
      ...(apiKey ? { api_key: apiKey } : {}),
    }),
  })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}

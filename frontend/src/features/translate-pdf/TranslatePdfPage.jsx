import { useCallback, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { trackErrorOccurred, trackFileDownloaded, trackToolCompleted } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { extractPdfPlainText, CLIENT_PDF_MAX_BYTES, CLIENT_PDF_MAX_PAGES } from '../pdf-to-word/extractPdfText.js'
import { buildDraftPdfBlob } from '../word-to-pdf/buildDraftPdfFromPlainText.js'
import { translatePlainTextOnDevice } from './clientOnnxTranslate.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const TOOL = ANALYTICS_TOOL.translate_pdf

const TARGET_LANGS = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
]

function triggerDownloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function TranslatePdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [target, setTarget] = useState('es')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)

  useToolEngagement(TOOL, true)

  const onPdf = useCallback(
    async (files) => {
      const file = files?.[0]
      if (!file) return
      if (file.size > CLIENT_PDF_MAX_BYTES) {
        setError(`PDF must be under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB.`)
        return
      }
      setError(null)
      setStatus(null)
      setBusy(true)
      try {
        const buf = await file.arrayBuffer()
        const { text, numPages } = await extractPdfPlainText(buf)
        if (numPages > CLIENT_PDF_MAX_PAGES) {
          setError(`This PDF has more than ${CLIENT_PDF_MAX_PAGES} pages. Split it first.`)
          return
        }
        const trimmed = String(text || '').trim()
        if (trimmed.length < 10) {
          setError('Not enough selectable text. Run OCR PDF on scans, then try again.')
          return
        }

        setStatus('Preparing on-device translator…')
        const merged = await translatePlainTextOnDevice({
          text: trimmed,
          targetUiCode: target,
          onStatus: (msg) => setStatus(msg),
        })

        await runWithSignInForDownload(
          async () => {
            const { blob, numPages: outPages } = await buildDraftPdfBlob(merged)
            const base = (file.name || 'document').replace(/\.pdf$/i, '') || 'document'
            triggerDownloadBlob(blob, `${base}-translated-${target}.pdf`)
            trackToolCompleted(TOOL, true)
            trackFileDownloaded({
              tool: TOOL,
              file_size: blob.size / 1024,
              total_pages: outPages,
            })
          },
          { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
        )
      } catch (e) {
        if (e?.code === 'EYP_AUTH_CANCELLED') {
          /* dismissed */
        } else if (e?.code === 'EYP_AUTH_LOADING') {
          setError(e.message || 'Still checking sign-in.')
        } else {
          console.error(e)
          trackErrorOccurred(TOOL, e?.message || 'translate_failed')
          setError(
            e?.message ||
              'Translation failed. Try a smaller PDF, ensure WebAssembly is allowed, or use a stable network for the first model download.'
          )
        }
      } finally {
        setBusy(false)
        setStatus(null)
      }
    },
    [runWithSignInForDownload, target]
  )

  return (
    <ToolPageShell
      title="Translate PDF"
      subtitle="Extract text in your browser, translate with an on-device model (Transformers.js / NLLB), then download a simple text PDF (layout is not preserved)."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Translate to</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={busy}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        >
          {TARGET_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <FileDropzone
        accept="application/pdf,.pdf"
        disabled={busy}
        onFiles={onPdf}
        label={busy ? 'Translating…' : 'Drop a PDF here'}
      />

      {status && !error && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-200">
          {status}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        First run downloads the quantized NLLB model from Hugging Face (cached in your browser). Source language is guessed
        from the text; quality varies by language pair and PDF noise. Long documents are translated in sections and may take
        several minutes on slower devices.
      </p>
    </ToolPageShell>
  )
}

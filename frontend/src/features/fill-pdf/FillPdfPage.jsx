import { useCallback, useMemo, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  markFunnelUpload,
  trackErrorOccurred,
  trackFileDownloaded,
  trackFileUploaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { MSG } from '../../shared/constants/branding.js'
import { applyAcroFormValues, listAcroFormFields } from './fillPdfCore.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import { CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'

const TOOL = ANALYTICS_TOOL.fill_pdf

function downloadUint8(u8, name) {
  const blob = new Blob([u8], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export default function FillPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [hint, setHint] = useState(null)
  const [fileName, setFileName] = useState('')
  const [pdfBytes, setPdfBytes] = useState(null)
  const [fields, setFields] = useState([])
  const [values, setValues] = useState(() => ({}))

  useToolEngagement(TOOL, true)

  const editableFields = useMemo(() => fields.filter((f) => f.kind !== 'unknown'), [fields])

  const onPdf = useCallback(async (files) => {
    const file = files[0]
    if (!file || file.type !== 'application/pdf') return
    if (file.size > CLIENT_PDF_MAX_BYTES) {
      setError(`Choose a PDF under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB for this browser tool.`)
      return
    }
    setError(null)
    setHint(null)
    setBusy(true)
    setFileName(file.name.replace(/\.pdf$/i, '') || 'document')
    try {
      const buf = await file.arrayBuffer()
      const u8 = new Uint8Array(buf)
      setPdfBytes(u8)
      const desc = await listAcroFormFields(u8)
      setFields(desc)
      const init = {}
      for (const f of desc) {
        if (f.kind === 'checkbox') init[f.name] = false
        else if (f.kind === 'dropdown' || f.kind === 'radio') init[f.name] = f.options?.[0] ?? ''
        else if (f.kind === 'text') init[f.name] = ''
      }
      setValues(init)
      if (!desc.length) {
        setHint('No AcroForm fields were detected. This tool fills standard PDF forms, not free-floating text.')
      }
    } catch (e) {
      console.error(e)
      setPdfBytes(null)
      setFields([])
      setValues({})
      setError(e?.message || 'Could not read form fields')
    } finally {
      setBusy(false)
    }
  }, [])

  const setVal = useCallback((name, v) => {
    setValues((prev) => ({ ...prev, [name]: v }))
  }, [])

  const onDownload = useCallback(async () => {
    if (!pdfBytes) return
    setError(null)
    setHint(null)
    setBusy(true)
    markFunnelUpload(TOOL)
    trackFileUploaded({
      file_type: 'pdf',
      file_size: pdfBytes.byteLength / 1024,
      tool: TOOL,
    })
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await runWithSignInForDownload(
        async () => {
          const out = await applyAcroFormValues(pdfBytes, values)
          downloadUint8(out, `${fileName || 'form'}-filled.pdf`)
          trackToolCompleted(TOOL, true)
          trackFileDownloaded({
            tool: TOOL,
            file_size: out.byteLength / 1024,
            total_pages: undefined,
          })
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(TOOL, elapsed)
          setHint(MSG.fileReady)
          window.setTimeout(() => setHint(null), 6000)
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
        trackErrorOccurred(TOOL, e?.message || 'fill_failed')
        setError(e?.message || 'Could not save PDF')
      }
    } finally {
      setBusy(false)
    }
  }, [pdfBytes, values, fileName, runWithSignInForDownload])

  return (
    <ToolPageShell
      title="Fill PDF form"
      subtitle="Complete AcroForm fields and download — your file stays in the browser until you save."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdf}
        label={busy && !pdfBytes ? MSG.processingFile : 'Drop a PDF form here or click to browse'}
      />

      {pdfBytes && (
        <div className="mb-6 mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Fields</h2>
          {fields.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No fillable fields detected — you can still download to save a copy.
            </p>
          )}
          {editableFields.length === 0 && fields.some((f) => f.kind === 'unknown') && (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Some form widgets are not editable in the browser — complex PDFs may need a desktop reader.
            </p>
          )}
          <div className="max-h-[min(420px,60vh)] space-y-3 overflow-y-auto pr-1">
            {editableFields.map((f) => (
              <div key={f.name}>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{f.name}</label>
                {f.kind === 'text' && (
                  <input
                    type="text"
                    value={values[f.name] ?? ''}
                    onChange={(e) => setVal(f.name, e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                )}
                {f.kind === 'checkbox' && (
                  <label className="mt-1 flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.name])}
                      onChange={(e) => setVal(f.name, e.target.checked)}
                      disabled={busy}
                    />
                    Checked
                  </label>
                )}
                {(f.kind === 'dropdown' || f.kind === 'radio') && (
                  <select
                    value={values[f.name] ?? ''}
                    onChange={(e) => setVal(f.name, e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  >
                    {(f.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onDownload()}
            disabled={busy}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50"
          >
            Download filled PDF
          </button>
        </div>
      )}

      {hint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {hint}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <ToolFeatureSeoSection toolId="fill-pdf" />
      {busy && (
        <div className="mt-6 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
    </ToolPageShell>
  )
}

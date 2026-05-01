import { useCallback, useEffect, useRef, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  markFunnelUpload,
  trackErrorOccurred,
  trackEvent,
  trackFileDownloaded,
  trackFileUploaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { MSG } from '../../shared/constants/branding.js'
import { flattenPdfForms, flattenPdfRasterize } from './flattenPdfCore.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import { CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'

const TOOL = ANALYTICS_TOOL.flatten_pdf

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

/** @typedef {'forms' | 'raster'} FlattenMode */

/**
 * @param {File} file
 * @param {FlattenMode} mode
 * @param {number} scale
 */
async function buildFlattenedPdf(file, mode, scale) {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  if (mode === 'raster') {
    const out = await flattenPdfRasterize(buf, { scale })
    return { bytes: out, formFieldCount: 0 }
  }
  const r = await flattenPdfForms(u8)
  return { bytes: r.bytes, formFieldCount: r.fieldCount }
}

export default function FlattenPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [pdfFile, setPdfFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [hint, setHint] = useState(null)
  /** @type {[FlattenMode, function]} */
  const [mode, setMode] = useState('forms')
  const [scale, setScale] = useState(2)
  const [previewUrl, setPreviewUrl] = useState(null)

  /** Matches successful preview so download can skip recomputation. */
  const cacheRef = useRef(null)
  /** Revoke blob URLs on replace / unmount. */
  const previewUrlRef = useRef(null)

  const fileKey = pdfFile ? `${pdfFile.name}-${pdfFile.size}-${pdfFile.lastModified}` : ''

  const updatePreviewBlob = useCallback((blob) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    const url = URL.createObjectURL(blob)
    previewUrlRef.current = url
    setPreviewUrl(url)
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  /** Invalidate preview when file or options change. */
  useEffect(() => {
    cacheRef.current = null
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [fileKey, mode, scale])

  useToolEngagement(TOOL, Boolean(pdfFile))

  const onPdfSelected = useCallback(
    (files) => {
      const file = files[0]
      if (!file || file.type !== 'application/pdf') return
      if (file.size > CLIENT_PDF_MAX_BYTES) {
        setError(`Choose a PDF under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB for this browser tool.`)
        return
      }
      setError(null)
      setHint(null)
      setPdfFile(file)
      markFunnelUpload(TOOL)
      trackFileUploaded({
        file_type: 'pdf',
        file_size: file.size / 1024,
        tool: TOOL,
      })
    },
    []
  )

  const runPreview = useCallback(async () => {
    if (!pdfFile) return
    setError(null)
    setHint(null)
    setBusy(true)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const { bytes, formFieldCount } = await buildFlattenedPdf(pdfFile, mode, scale)
      cacheRef.current = {
        bytes,
        formFieldCount,
        fileKey,
        mode,
        scale,
      }
      updatePreviewBlob(new Blob([bytes], { type: 'application/pdf' }))
      trackEvent('flatten_pdf_preview', { mode, scale })
      if (mode === 'forms' && formFieldCount === 0) {
        setHint(
          'Preview: no AcroForm fields in this file — output matches the original visually. Use Rasterize for image-only pages, or Fill PDF first.'
        )
      } else {
        setHint('Preview ready — check below, then download when satisfied.')
      }
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(TOOL, elapsed)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'flatten_preview_failed')
      setError(e?.message || 'Could not build preview.')
    } finally {
      setBusy(false)
    }
  }, [pdfFile, mode, scale, fileKey, updatePreviewBlob])

  const runDownload = useCallback(async () => {
    if (!pdfFile) return
    setError(null)
    const base = pdfFile.name.replace(/\.pdf$/i, '') || 'document'
    const suffix = mode === 'raster' ? '-flat-images.pdf' : '-flat-forms.pdf'
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    setBusy(true)
    try {
      await runWithSignInForDownload(
        async () => {
          const c = cacheRef.current
          const cacheOk =
            c &&
            c.fileKey === fileKey &&
            c.mode === mode &&
            c.scale === scale
          let bytes
          let formFieldCount = 0
          if (cacheOk) {
            bytes = c.bytes
            formFieldCount = c.formFieldCount
          } else {
            const r = await buildFlattenedPdf(pdfFile, mode, scale)
            bytes = r.bytes
            formFieldCount = r.formFieldCount
          }
          downloadUint8(bytes, `${base}${suffix}`)
          if (mode === 'forms' && formFieldCount === 0) {
            setHint(
              'This PDF has no fillable AcroForm fields, so it was re-saved with no form changes. For a “flat” image-only file, choose Rasterize all pages above, or add fields in Fill PDF first.'
            )
          } else {
            setHint(MSG.fileReady)
          }
          trackToolCompleted(TOOL, true)
          trackFileDownloaded({
            tool: TOOL,
            file_size: bytes.byteLength / 1024,
            total_pages: undefined,
          })
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(TOOL, elapsed)
          if (mode === 'forms' && formFieldCount === 0) {
            window.setTimeout(() => setHint(null), 12000)
          } else {
            window.setTimeout(() => setHint(null), 6000)
          }
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        setHint('Sign in is required to download. Use “Continue” in the prompt, or sign in from the header and try again.')
        window.setTimeout(() => setHint(null), 8000)
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        console.error(e)
        trackErrorOccurred(TOOL, e?.message || 'flatten_download_failed')
        setError(e?.message || 'Could not download flattened PDF')
      }
    } finally {
      setBusy(false)
    }
  }, [pdfFile, mode, scale, fileKey, runWithSignInForDownload])

  const controlsDisabled = busy || !pdfFile

  return (
    <ToolPageShell
      title="Flatten PDF"
      subtitle="Turn forms into static content, or rasterize every page to images — all in your browser."
    >
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        <strong>Flatten</strong> means “no longer interactive.”{' '}
        <em>Flatten forms</em> only changes PDFs that have fillable AcroForm fields (many scans and “flat”
        PDFs have none — use <em>Rasterize</em> to bake each page to an image). The editor’s “Flatten forms
        on save” is the same idea for files you edit there.
      </p>
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdfSelected}
        label={busy ? MSG.processingFile : pdfFile ? 'Drop another PDF or click to replace' : 'Drop a PDF here or click to browse'}
      />
      {pdfFile ? (
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          Selected: <span className="font-medium">{pdfFile.name}</span>
          <span className="text-zinc-500 dark:text-zinc-500"> · {(pdfFile.size / 1024).toFixed(0)} KB</span>
        </p>
      ) : null}

      <div className="mb-6 mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Flatten mode</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name="flat-mode"
              checked={mode === 'forms'}
              onChange={() => setMode('forms')}
              disabled={controlsDisabled}
            />
            Flatten fillable forms (AcroForm) into non-editable content when possible
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name="flat-mode"
              checked={mode === 'raster'}
              onChange={() => setMode('raster')}
              disabled={controlsDisabled}
            />
            Rasterize all pages (each page becomes an image — largest files, strongest flatten)
          </label>
        </fieldset>
        {mode === 'raster' && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span>Render scale</span>
            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              disabled={controlsDisabled}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </select>
          </label>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Changing mode or scale clears the preview — click <strong>Preview</strong> again.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => void runPreview()}
          className="rounded-xl border border-indigo-600 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800"
        >
          {busy ? MSG.processingFile : 'Preview result'}
        </button>
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => void runDownload()}
          className="rounded-xl border border-zinc-300 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
        >
          {busy ? MSG.processingFile : 'Download flattened PDF'}
        </button>
      </div>

      {previewUrl ? (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Review</p>
          <iframe
            title="Flattened PDF preview"
            src={previewUrl}
            className="min-h-[min(70vh,560px)] w-full rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      ) : null}

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
      <ToolFeatureSeoSection toolId="flatten-pdf" />
      {busy && (
        <div className="mt-6 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
    </ToolPageShell>
  )
}

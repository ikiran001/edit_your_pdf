import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
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
import { applyWatermarkToPdf, resolvePageIndices } from '../../lib/watermarkPdfCore.js'
import { parsePageRangeInput } from '../../lib/pdfMergeSplitCore.js'
import '../../lib/pdfjs.js'
import WatermarkPreview from './WatermarkPreview.jsx'

const TOOL = ANALYTICS_TOOL.watermark_pdf
const LS_KEY = 'pdfpilot_watermark_settings_v1'

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

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return null
    return o
  } catch {
    return null
  }
}

function saveSettings(partial) {
  try {
    const prev = loadSavedSettings() || {}
    localStorage.setItem(LS_KEY, JSON.stringify({ ...prev, ...partial }))
  } catch {
    /* ignore */
  }
}

export default function WatermarkPdfPage() {
  const [pdfFile, setPdfFile] = useState(null)
  /** Master PDF bytes (pdf.js must not consume this buffer — pass `.slice()` into getDocument). */
  const [pdfBytes, setPdfBytes] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('DRAFT')
  const [fontSize, setFontSize] = useState(48)
  const [colorHex, setColorHex] = useState('#64748b')
  const [opacityPct, setOpacityPct] = useState(35)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [imageBytes, setImageBytes] = useState(null)
  const [imageKind, setImageKind] = useState('png')
  const [imageObjectUrl, setImageObjectUrl] = useState(null)
  const [imageScalePreset, setImageScalePreset] = useState('medium')
  const [imageScalePercent, setImageScalePercent] = useState(28)
  const [position, setPosition] = useState('center')
  const [pageScope, setPageScope] = useState('all')
  const [pageRangeInput, setPageRangeInput] = useState('1')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)
  const [successHint, setSuccessHint] = useState(null)
  const [rangeHint, setRangeHint] = useState(null)
  const hydrated = useRef(false)

  useToolEngagement(TOOL, true)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const s = loadSavedSettings()
    if (!s) return
    if (s.mode === 'text' || s.mode === 'image') setMode(s.mode)
    if (typeof s.text === 'string') setText(s.text)
    if (Number.isFinite(s.fontSize)) setFontSize(s.fontSize)
    if (typeof s.colorHex === 'string') setColorHex(s.colorHex)
    if (Number.isFinite(s.opacityPct)) setOpacityPct(s.opacityPct)
    if (Number.isFinite(s.rotationDeg)) setRotationDeg(s.rotationDeg)
    if (s.imageScalePreset) setImageScalePreset(s.imageScalePreset)
    if (Number.isFinite(s.imageScalePercent)) setImageScalePercent(s.imageScalePercent)
    if (s.position) setPosition(s.position)
    if (s.pageScope === 'all' || s.pageScope === 'range') setPageScope(s.pageScope)
    if (typeof s.pageRangeInput === 'string') setPageRangeInput(s.pageRangeInput)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveSettings({
        mode,
        text,
        fontSize,
        colorHex,
        opacityPct,
        rotationDeg,
        imageScalePreset,
        imageScalePercent,
        position,
        pageScope,
        pageRangeInput,
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [
    mode,
    text,
    fontSize,
    colorHex,
    opacityPct,
    rotationDeg,
    imageScalePreset,
    imageScalePercent,
    position,
    pageScope,
    pageRangeInput,
  ])

  useEffect(() => {
    if (!pdfFile) {
      setPdfBytes(null)
      setPdfDoc(null)
      setNumPages(0)
      return undefined
    }
    let cancelled = false
    let doc = null
    ;(async () => {
      try {
        const raw = await pdfFile.arrayBuffer()
        if (cancelled) return
        const master = new Uint8Array(raw)
        setPdfBytes(master)
        /* pdf.js may transfer/neuter buffers; never pass `master` directly */
        const task = getDocument({ data: master.slice() })
        doc = await task.promise
        if (cancelled) {
          doc.destroy()
          return
        }
        setPdfDoc(doc)
        setNumPages(doc.numPages)
        markFunnelUpload(TOOL)
        trackFileUploaded({
          file_type: 'pdf',
          file_size: pdfFile.size / 1024,
          tool: TOOL,
        })
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not open this PDF.')
          trackErrorOccurred(TOOL, e?.message || 'pdf_open')
        }
      }
    })()
    return () => {
      cancelled = true
      if (doc) doc.destroy()
    }
  }, [pdfFile])

  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl)
    }
  }, [imageObjectUrl])

  const validateRange = useMemo(() => {
    if (pageScope !== 'range' || !numPages) return { ok: true, count: numPages }
    try {
      const groups = parsePageRangeInput(pageRangeInput, numPages)
      const idx = resolvePageIndices('range', pageRangeInput, numPages)
      return { ok: true, count: idx.length, groups }
    } catch (e) {
      return { ok: false, message: e?.message || 'Invalid page range' }
    }
  }, [pageScope, pageRangeInput, numPages])

  useEffect(() => {
    if (pageScope === 'range' && numPages && !validateRange.ok) {
      setRangeHint(validateRange.message)
    } else {
      setRangeHint(null)
    }
  }, [pageScope, numPages, validateRange])

  const onPdfFiles = useCallback((files) => {
    const f = files[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      setError('Please choose a PDF file.')
      return
    }
    setError(null)
    setSuccessHint(null)
    setPdfBytes(null)
    setPdfDoc(null)
    setNumPages(0)
    setPdfFile(f)
  }, [])

  const onImageFiles = useCallback(
    async (files) => {
      const f = files[0]
      if (!f) return
      const ok =
        f.type === 'image/png' ||
        f.type === 'image/jpeg' ||
        /\.(png|jpe?g)$/i.test(f.name)
      if (!ok) {
        setError('Use a PNG or JPG image.')
        return
      }
      setError(null)
      try {
        const buf = await f.arrayBuffer()
        const bytes = new Uint8Array(buf)
        const kind = f.type === 'image/png' || /\.png$/i.test(f.name) ? 'png' : 'jpg'
        if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl)
        const url = URL.createObjectURL(f)
        setImageFile(f)
        setImageBytes(bytes)
        setImageKind(kind)
        setImageObjectUrl(url)
      } catch (e) {
        setError(e?.message || 'Could not read the image.')
      }
    },
    [imageObjectUrl]
  )

  const applyConfidentialPreset = () => {
    setMode('text')
    setText('CONFIDENTIAL')
    setFontSize(56)
    setColorHex('#b91c1c')
    setOpacityPct(32)
    setRotationDeg(38)
    setPosition('center')
  }

  const runApply = async () => {
    if (!pdfFile || !pdfBytes?.length) {
      setError('Upload a PDF first.')
      return
    }
    if (mode === 'text' && !(text || '').trim()) {
      setError('Enter watermark text or switch to image watermark.')
      return
    }
    if (mode === 'image' && (!imageBytes || !imageBytes.length)) {
      setError('Upload a PNG or JPG for the image watermark.')
      return
    }
    if (pageScope === 'range' && !validateRange.ok) {
      setError(validateRange.message)
      return
    }

    setBusy(true)
    setError(null)
    setSuccessHint(null)
    setProgress({ done: 0, total: 0 })
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const indices = resolvePageIndices(pageScope, pageRangeInput, numPages)
      setProgress({ done: 0, total: indices.length })
      const u8 = await applyWatermarkToPdf(pdfBytes, {
        mode,
        text: (text || '').trim(),
        fontSize,
        colorHex,
        opacityPct,
        rotationDeg,
        imageBytes: mode === 'image' ? imageBytes : undefined,
        imageKind: mode === 'image' ? imageKind : undefined,
        imageScalePreset,
        imageScalePercent,
        position,
        pageScope,
        pageRangeInput: pageScope === 'range' ? pageRangeInput : '',
        onProgress: (done, total) => setProgress({ done, total }),
      })
      const base = pdfFile.name.replace(/\.pdf$/i, '') || 'document'
      downloadUint8(u8, `${base}-watermarked.pdf`)
      trackToolCompleted(TOOL, true)
      trackFileDownloaded({
        tool: TOOL,
        file_size: u8.byteLength / 1024,
        total_pages: numPages,
      })
      trackProcessingTime(TOOL, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
      setSuccessHint('Watermarked PDF downloaded successfully.')
      window.setTimeout(() => setSuccessHint(null), 6000)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'watermark_failed')
      setError(e?.message || 'Could not apply watermark.')
    } finally {
      setBusy(false)
      setProgress({ done: 0, total: 0 })
    }
  }

  const posOptions = [
    { id: 'center', label: 'Center' },
    { id: 'top-left', label: 'Top left' },
    { id: 'top-right', label: 'Top right' },
    { id: 'bottom-left', label: 'Bottom left' },
    { id: 'bottom-right', label: 'Bottom right' },
    { id: 'tile', label: 'Tile (repeat)' },
  ]

  return (
    <ToolPageShell
      title="Add Watermark"
      subtitle="Add text or image watermarks in your browser. Preview on page 1, then download."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={onPdfFiles}
        label={pdfFile ? pdfFile.name : 'Drop your PDF here or click to browse'}
      />

      {numPages > 0 && (
        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {numPages} page{numPages === 1 ? '' : 's'} loaded
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
        >
          {error}
        </div>
      )}
      {successHint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {successHint}
        </div>
      )}

      <ToolFeatureSeoSection toolId="add-watermark" />

      <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Watermark type</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="wm-mode"
                  checked={mode === 'text'}
                  disabled={busy}
                  onChange={() => setMode('text')}
                  className="text-indigo-600"
                />
                Text
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="wm-mode"
                  checked={mode === 'image'}
                  disabled={busy}
                  onChange={() => setMode('image')}
                  className="text-indigo-600"
                />
                Image
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={applyConfidentialPreset}
              className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
            >
              Preset: CONFIDENTIAL (diagonal)
            </button>
          </section>

          {mode === 'text' ? (
            <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Text settings</h3>
              <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Text
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  placeholder="e.g. DRAFT, © Your Company"
                />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Font size
                  <input
                    type="number"
                    min={6}
                    max={200}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    disabled={busy}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Color
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    disabled={busy}
                    className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-zinc-300 dark:border-zinc-600"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Opacity ({opacityPct}%)
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacityPct}
                    onChange={(e) => setOpacityPct(Number(e.target.value))}
                    disabled={busy}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Rotation ({rotationDeg}°)
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                    disabled={busy}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Image settings</h3>
              <FileDropzone
                accept="image/png,image/jpeg"
                disabled={busy}
                onFiles={onImageFiles}
                label={imageFile ? imageFile.name : 'Drop PNG or JPG here'}
                className="mt-3 py-8"
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Size
                  <select
                    value={imageScalePreset}
                    onChange={(e) => setImageScalePreset(e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="custom">Custom % of page</option>
                  </select>
                </label>
                {imageScalePreset === 'custom' ? (
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    % of shorter page side
                    <input
                      type="number"
                      min={8}
                      max={70}
                      value={imageScalePercent}
                      onChange={(e) => setImageScalePercent(Number(e.target.value))}
                      disabled={busy}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    />
                  </label>
                ) : null}
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Opacity ({opacityPct}%)
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacityPct}
                    onChange={(e) => setOpacityPct(Number(e.target.value))}
                    disabled={busy}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Rotation ({rotationDeg}°)
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                    disabled={busy}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Position</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {posOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setPosition(o.id)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                    position === o.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-cyan-100'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Apply to pages</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="page-scope"
                  checked={pageScope === 'all'}
                  disabled={busy}
                  onChange={() => setPageScope('all')}
                  className="text-indigo-600"
                />
                All pages
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="page-scope"
                  checked={pageScope === 'range'}
                  disabled={busy}
                  onChange={() => setPageScope('range')}
                  className="text-indigo-600"
                />
                Page range
              </label>
            </div>
            {pageScope === 'range' ? (
              <div className="mt-2">
                <input
                  type="text"
                  value={pageRangeInput}
                  onChange={(e) => setPageRangeInput(e.target.value)}
                  disabled={busy || !numPages}
                  placeholder="e.g. 1-3, 5, 8-10"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
                {rangeHint ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{rangeHint}</p>
                ) : numPages ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {validateRange.ok ? `${validateRange.count} page(s) will be watermarked` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <button
            type="button"
            disabled={
              busy ||
              !pdfFile ||
              !pdfBytes?.length ||
              !numPages ||
              (pageScope === 'range' && !validateRange.ok) ||
              (mode === 'text' && !(text || '').trim()) ||
              (mode === 'image' && !imageBytes)
            }
            onClick={runApply}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Applying… {progress.total ? `${progress.done}/${progress.total}` : ''}
              </>
            ) : (
              'Apply & download PDF'
            )}
          </button>
        </div>

        <div>
          <WatermarkPreview
            pdfFile={pdfFile}
            pdfDoc={pdfDoc}
            mode={mode}
            text={text}
            fontSize={fontSize}
            colorHex={colorHex}
            opacityPct={opacityPct}
            rotationDeg={rotationDeg}
            imageObjectUrl={imageObjectUrl}
            imageScalePreset={imageScalePreset}
            imageScalePercent={imageScalePercent}
            position={position}
          />
        </div>
      </div>
    </ToolPageShell>
  )
}

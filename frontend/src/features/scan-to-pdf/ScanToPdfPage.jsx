import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, GripVertical, ImagePlus, Trash2, X } from 'lucide-react'
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
import { imageBlobsToPdfBytes } from '../jpg-to-pdf/jpgToPdfCore.js'
import { processCanvasToJpegBlob, processScannedImageBlob } from './scanImagePipeline.js'

const SCAN_TOOL = ANALYTICS_TOOL.scan_to_pdf

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

function stopStream(stream) {
  if (!stream) return
  for (const t of stream.getTracks()) {
    try {
      t.stop()
    } catch {
      /* ignore */
    }
  }
}

/**
 * @typedef {{ id: string, blob: Blob, url: string }} ScanPage
 */

export default function ScanToPdfPage() {
  const [phase, setPhase] = useState('home')
  /** @type {React.MutableRefObject<MediaStream | null>} */
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const [cameraError, setCameraError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [noCameraApi, setNoCameraApi] = useState(false)
  const [pages, setPages] = useState([])
  const [dragId, setDragId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyCapture, setBusyCapture] = useState(false)
  const [error, setError] = useState(null)
  const [fileReadyHint, setFileReadyHint] = useState(null)
  const [autoCrop, setAutoCrop] = useState(true)
  const [enhance, setEnhance] = useState(true)
  const funnelMarkedRef = useRef(false)
  const retakeIdRef = useRef(null)
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  /** Bumps when a new stream is acquired so `<video>` remounts (fixes stale ref after review → camera). */
  const [cameraMountKey, setCameraMountKey] = useState(0)

  useToolEngagement(SCAN_TOOL, true)

  const revokePageUrls = useCallback((list) => {
    for (const p of list) {
      try {
        URL.revokeObjectURL(p.url)
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(
    () => () => {
      stopStream(streamRef.current)
      streamRef.current = null
      revokePageUrls(pagesRef.current)
    },
    [revokePageUrls]
  )

  /** Bind MediaStream after React mounts `<video>` (rAF right after setState often sees ref=null). */
  useEffect(() => {
    if (phase !== 'camera') return undefined
    const stream = streamRef.current
    if (!stream) return undefined
    const el = videoRef.current
    if (!el) return undefined
    el.srcObject = stream
    const playPromise = el.play()
    if (playPromise?.catch) playPromise.catch(() => {})
    return () => {
      if (el.srcObject === stream) el.srcObject = null
    }
  }, [phase, cameraMountKey])

  const openCamera = useCallback(async () => {
    setCameraError(null)
    setPermissionDenied(false)
    setNoCameraApi(false)
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setNoCameraApi(true)
      setPhase(pagesRef.current.length ? 'review' : 'home')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      stopStream(streamRef.current)
      streamRef.current = stream
      setCameraMountKey((k) => k + 1)
      setPhase('camera')
    } catch (e) {
      stopStream(streamRef.current)
      streamRef.current = null
      const name = e?.name || ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermissionDenied(true)
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No camera was found on this device.')
      } else {
        setCameraError(e?.message || 'Could not open the camera.')
      }
      setPhase(pagesRef.current.length ? 'review' : 'home')
    }
  }, [])

  const closeCamera = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
    retakeIdRef.current = null
    setPhase(pagesRef.current.length ? 'review' : 'home')
  }, [])

  const addProcessedBlob = useCallback(
    (blob) => {
      const url = URL.createObjectURL(blob)
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const page = { id, blob, url }
      setPages((prev) => {
        const rid = retakeIdRef.current
        retakeIdRef.current = null
        if (rid) {
          const i = prev.findIndex((p) => p.id === rid)
          if (i < 0) return [...prev, page]
          const next = [...prev]
          try {
            URL.revokeObjectURL(next[i].url)
          } catch {
            /* ignore */
          }
          next[i] = page
          return next
        }
        return [...prev, page]
      })
      if (!funnelMarkedRef.current) {
        funnelMarkedRef.current = true
        markFunnelUpload(SCAN_TOOL)
      }
      trackFileUploaded({ file_type: 'image', file_size: blob.size / 1024, tool: SCAN_TOOL })
    },
    []
  )

  const captureFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || busyCapture) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (vw < 2 || vh < 2) {
      setError('Camera is still starting — wait a moment and try again.')
      return
    }
    setBusyCapture(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = vw
      canvas.height = vh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Could not capture frame')
      ctx.drawImage(video, 0, 0, vw, vh)
      const blob = await processCanvasToJpegBlob(canvas, {
        autoCrop,
        enhance,
        maxLongEdge: 2200,
      })
      addProcessedBlob(blob)
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not process the photo')
    } finally {
      setBusyCapture(false)
    }
  }, [addProcessedBlob, autoCrop, busyCapture, enhance])

  const onUploadImages = useCallback(
    async (files) => {
      const list = [...files].filter((f) => f.type.startsWith('image/'))
      if (!list.length) return
      setError(null)
      setBusy(true)
      try {
        for (const file of list) {
          const blob = await processScannedImageBlob(file, {
            autoCrop,
            enhance,
            maxLongEdge: 2200,
          })
          addProcessedBlob(blob)
        }
      } catch (e) {
        console.error(e)
        setError(e?.message || 'Could not process an image')
      } finally {
        setBusy(false)
      }
      setPhase('review')
    },
    [addProcessedBlob, autoCrop, enhance]
  )

  const removePage = (id) => {
    setPages((prev) => {
      const p = prev.find((x) => x.id === id)
      if (p) {
        try {
          URL.revokeObjectURL(p.url)
        } catch {
          /* ignore */
        }
      }
      return prev.filter((x) => x.id !== id)
    })
  }

  const startRetake = (id) => {
    retakeIdRef.current = id
    void openCamera()
  }

  const onDragStart = (id) => setDragId(id)
  const onDragOver = (e) => e.preventDefault()
  const onDropOn = (targetId) => {
    if (dragId == null || dragId === targetId) return
    setPages((prev) => {
      const a = prev.findIndex((x) => x.id === dragId)
      const b = prev.findIndex((x) => x.id === targetId)
      if (a < 0 || b < 0) return prev
      const next = [...prev]
      const [m] = next.splice(a, 1)
      next.splice(b, 0, m)
      return next
    })
    setDragId(null)
  }

  const buildPdf = async () => {
    if (!pages.length) return
    setError(null)
    setFileReadyHint(null)
    setBusy(true)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const blobs = pages.map((p) => p.blob)
      const bytes = await imageBlobsToPdfBytes(blobs)
      downloadUint8(bytes, 'scan.pdf')
      trackToolCompleted(SCAN_TOOL, true)
      trackFileDownloaded({
        tool: SCAN_TOOL,
        file_size: bytes.byteLength / 1024,
        total_pages: blobs.length,
      })
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(SCAN_TOOL, elapsed)
      setFileReadyHint(MSG.fileReady)
      window.setTimeout(() => setFileReadyHint(null), 6000)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(SCAN_TOOL, e?.message || 'build_pdf_failed')
      setError(e?.message || 'Could not build PDF')
    } finally {
      setBusy(false)
    }
  }

  const goReview = () => {
    closeCamera()
  }

  const scanAnotherFromReview = () => {
    retakeIdRef.current = null
    void openCamera()
  }

  return (
    <ToolPageShell
      title="Scan to PDF"
      subtitle="Use your camera or upload photos. Pages stay in order for one PDF download."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 text-sm text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-400 text-indigo-600"
              checked={autoCrop}
              onChange={(e) => setAutoCrop(e.target.checked)}
            />
            <span title="Trims mostly-white borders around paper (best on a desk or light background).">
              Auto-trim margins
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-400 text-indigo-600"
              checked={enhance}
              onChange={(e) => setEnhance(e.target.checked)}
            />
            <span title="Stretchs shadows and highlights for easier reading (browser-only).">
              Enhance contrast
            </span>
          </label>
        </div>

        {phase === 'home' && (
          <div className="space-y-4">
            {noCameraApi && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                This browser does not expose a camera API. Use{' '}
                <strong>Upload photos</strong> below to build your PDF from images.
              </div>
            )}
            {permissionDenied && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                Camera access was blocked. Allow the camera for this site in your browser settings,
                or use <strong>Upload photos</strong> instead.
              </div>
            )}
            {cameraError && !permissionDenied && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
                {cameraError}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={busy || noCameraApi}
                onClick={() => void openCamera()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50"
              >
                <Camera className="h-5 w-5" aria-hidden />
                Scan document
              </button>
            </div>
            <div className="relative py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span className="relative z-[1] bg-transparent px-2">or</span>
              <span
                className="absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2 bg-zinc-200 dark:bg-zinc-700"
                aria-hidden
              />
            </div>
            <FileDropzone
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              disabled={busy}
              onFiles={(fs) => void onUploadImages(fs)}
              label="Upload photos (JPEG, PNG, WebP…)"
            />
          </div>
        )}

        {phase === 'camera' && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-lg">
              <video
                key={cameraMountKey}
                ref={videoRef}
                className="mx-auto max-h-[min(70vh,640px)] w-full object-contain"
                playsInline
                muted
                autoPlay
              />
              {busyCapture && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
                  Processing…
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyCapture}
                onClick={() => void captureFrame()}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:flex-none sm:px-8"
              >
                Capture page
              </button>
              <button
                type="button"
                onClick={goReview}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {pages.length ? 'Done — review pages' : 'Close camera'}
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 p-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
                aria-label="Close camera"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              Add several captures for a multi-page PDF. Use <strong>Close camera</strong> if you opened
              it by mistake.
            </p>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || noCameraApi}
                onClick={() => void scanAnotherFromReview()}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/60"
              >
                <Camera className="h-4 w-4" aria-hidden />
                Add pages (camera)
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                <ImagePlus className="h-4 w-4" aria-hidden />
                Add photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const fs = e.target.files
                    if (fs?.length) void onUploadImages(fs)
                    e.target.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  revokePageUrls(pages)
                  setPages([])
                  setPhase('home')
                  setPermissionDenied(false)
                  setCameraError(null)
                }}
                className="rounded-xl px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Start over
              </button>
            </div>

            {fileReadyHint && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
              >
                {fileReadyHint}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
                {error}
              </div>
            )}

            {pages.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Page order</h3>
                <ul className="space-y-2">
                  {pages.map((p, idx) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={() => onDragStart(p.id)}
                      onDragOver={onDragOver}
                      onDrop={() => onDropOn(p.id)}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/90 px-2 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
                    >
                      <GripVertical className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                      <span className="w-7 shrink-0 text-center text-xs font-medium text-zinc-500">
                        {idx + 1}
                      </span>
                      <img
                        src={p.url}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-600"
                      />
                      <div className="min-w-0 flex-1 text-xs text-zinc-500">Page {idx + 1}</div>
                      <button
                        type="button"
                        onClick={() => startRetake(p.id)}
                        disabled={busy || noCameraApi}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                      >
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={() => removePage(p.id)}
                        className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        aria-label={`Remove page ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void buildPdf()}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-10"
                >
                  {busy ? MSG.finalizingPdf : 'Download PDF'}
                </button>
              </>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No pages yet. Use the camera or upload photos to add scans.
              </p>
            )}
          </div>
        )}
      </div>

      <ToolFeatureSeoSection toolId="scan-to-pdf" />
    </ToolPageShell>
  )
}

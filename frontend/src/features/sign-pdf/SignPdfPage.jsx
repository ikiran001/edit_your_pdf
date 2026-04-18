import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ClipboardPaste, CopyPlus, PenLine } from 'lucide-react'
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
  trackSignaturePlaced,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { MSG } from '../../shared/constants/branding.js'
import SignatureCreationModal from './SignatureCreationModal.jsx'
import SignPdfViewer from './SignPdfViewer.jsx'
import {
  clamp,
  defaultPlacementForPng,
  uint8ToDataUrlPng,
  viewportRectToPdfDrawImage,
} from './signPdfGeometry.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

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

const PLACE_OFFSET = 0.02
const SIGN_TOOL = ANALYTICS_TOOL.sign_pdf

export default function SignPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const viewerRef = useRef(null)
  const prevPlacementsLen = useRef(0)
  const placementClipboardRef = useRef(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [signaturePng, setSignaturePng] = useState(null)
  const [placements, setPlacements] = useState([])
  const [focusedPageIndex, setFocusedPageIndex] = useState(0)
  const [selectedPlacementId, setSelectedPlacementId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fileReadyHint, setFileReadyHint] = useState(null)
  /** Bumps when user copies a placement so the Paste button re-renders (ref alone does not). */
  const [clipboardRev, setClipboardRev] = useState(0)

  useToolEngagement(SIGN_TOOL, Boolean(pdfFile))

  useEffect(() => {
    prevPlacementsLen.current = 0
  }, [pdfFile])

  useEffect(() => {
    if (!pdfFile) return
    if (placements.length > prevPlacementsLen.current) {
      const last = placements[placements.length - 1]
      if (last) trackSignaturePlaced(last.pageIndex + 1)
    }
    prevPlacementsLen.current = placements.length
  }, [placements, pdfFile])

  const signaturePreviewUrl = useMemo(
    () => (signaturePng?.length ? uint8ToDataUrlPng(signaturePng) : null),
    [signaturePng]
  )

  const copySelectedPlacement = useCallback(() => {
    if (!selectedPlacementId) return
    const p = placements.find((x) => x.id === selectedPlacementId)
    if (!p) return
    placementClipboardRef.current = { nx: p.nx, ny: p.ny, nw: p.nw, nh: p.nh }
    setClipboardRev((r) => r + 1)
  }, [placements, selectedPlacementId])

  const pasteFromClipboard = useCallback(() => {
    const clip = placementClipboardRef.current
    if (!clip || !signaturePng?.length) return
    const id = crypto.randomUUID()
    const nw = clip.nw
    const nh = clip.nh
    const nx = clamp(clip.nx + PLACE_OFFSET * 0.75, 0, 1 - nw)
    const ny = clamp(clip.ny + PLACE_OFFSET * 0.75, 0, 1 - nh)
    setPlacements((prev) => [...prev, { id, pageIndex: focusedPageIndex, nx, ny, nw, nh }])
    setSelectedPlacementId(id)
  }, [signaturePng, focusedPageIndex])

  const duplicateSelected = useCallback(() => {
    if (!selectedPlacementId) return
    const p = placements.find((x) => x.id === selectedPlacementId)
    if (!p) return
    const id = crypto.randomUUID()
    const nw = p.nw
    const nh = p.nh
    const nx = clamp(p.nx + PLACE_OFFSET, 0, 1 - nw)
    const ny = clamp(p.ny + PLACE_OFFSET, 0, 1 - nh)
    setPlacements((prev) => [...prev, { id, pageIndex: focusedPageIndex, nx, ny, nw, nh }])
    setSelectedPlacementId(id)
  }, [placements, selectedPlacementId, focusedPageIndex])

  useEffect(() => {
    if (!pdfFile) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedPlacementId(null)
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key?.toLowerCase()
      if (key === 'c' && selectedPlacementId) {
        e.preventDefault()
        copySelectedPlacement()
      }
      if (key === 'v' && placementClipboardRef.current && signaturePng?.length) {
        e.preventDefault()
        pasteFromClipboard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pdfFile, selectedPlacementId, signaturePng, copySelectedPlacement, pasteFromClipboard])

  const onSignatureDone = useCallback(
    async (pngBytes) => {
      setSignaturePng(pngBytes)
      const api = viewerRef.current
      const { nx, ny, nw, nh } = await defaultPlacementForPng(
        pngBytes,
        api?.getViewportForPage,
        focusedPageIndex
      )
      const id = crypto.randomUUID()
      setPlacements((prev) => [...prev, { id, pageIndex: focusedPageIndex, nx, ny, nw, nh }])
      setSelectedPlacementId(id)
    },
    [focusedPageIndex]
  )

  const applyAndDownload = useCallback(async () => {
    if (!pdfFile) {
      setError('Upload a PDF first.')
      return
    }
    if (!signaturePng?.length) {
      setError('Add a signature first.')
      return
    }
    if (placements.length === 0) {
      setError('Place at least one signature on the document.')
      return
    }
    const api = viewerRef.current
    if (!api?.getViewportForPage) {
      setError('Preview is still loading. Try again in a moment.')
      return
    }

    setBusy(true)
    setError(null)
    setFileReadyHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      await runWithSignInForDownload(
        async () => {
          const pdfBytes = await pdfFile.arrayBuffer()
          const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
          const sigImage = await doc.embedPng(signaturePng)

          const ordered = [...placements].sort((a, b) => {
            if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
            return a.ny - b.ny
          })
          for (const p of ordered) {
            const pageCount = doc.getPageCount()
            if (p.pageIndex < 0 || p.pageIndex >= pageCount) continue
            const viewport = await api.getViewportForPage(p.pageIndex)
            if (!viewport) continue
            const vx = p.nx * viewport.width
            const vy = p.ny * viewport.height
            const sw = p.nw * viewport.width
            const sh = p.nh * viewport.height
            const { x, y, width, height } = viewportRectToPdfDrawImage(viewport, vx, vy, sw, sh)
            const page = doc.getPage(p.pageIndex)
            page.drawImage(sigImage, { x, y, width, height })
          }

          const out = await doc.save()
          const pageCount = doc.getPageCount()
          downloadUint8(out, pdfFile.name.replace(/\.pdf$/i, '') + '-signed.pdf')
          trackToolCompleted(SIGN_TOOL, true)
          trackFileDownloaded({
            tool: SIGN_TOOL,
            file_size: out.byteLength / 1024,
            total_pages: pageCount,
          })
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(SIGN_TOOL, elapsed)
          setFileReadyHint(MSG.fileReady)
          window.setTimeout(() => setFileReadyHint(null), 6000)
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        /* user closed modal */
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        console.error(e)
        trackErrorOccurred(SIGN_TOOL, e?.message || 'sign_apply_failed')
        setError(e?.message || 'Could not embed signature')
      }
    } finally {
      setBusy(false)
    }
  }, [pdfFile, signaturePng, placements, runWithSignInForDownload])

  const canPaste = Boolean(signaturePng?.length && clipboardRev > 0 && placementClipboardRef.current)

  return (
    <ToolPageShell
      title="Sign PDF"
      subtitle="Place signatures on any page, duplicate or copy/paste, then download a signed PDF."
    >
      <SignatureCreationModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={onSignatureDone} />

      <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">1. PDF</h3>
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => {
          const next = f[0]
          if (next) {
            markFunnelUpload(SIGN_TOOL)
            trackFileUploaded({
              file_type: 'pdf',
              file_size: next.size / 1024,
              tool: SIGN_TOOL,
            })
          }
          setPdfFile(next)
          setFileReadyHint(null)
          setPlacements([])
          setSignaturePng(null)
          setSelectedPlacementId(null)
          placementClipboardRef.current = null
          setClipboardRev(0)
        }}
        label={pdfFile ? pdfFile.name : 'Drop PDF here'}
      />

      {fileReadyHint && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {fileReadyHint}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      <ToolFeatureSeoSection toolId="sign-pdf" />

      {pdfFile ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              Add signature
            </button>
            <button
              type="button"
              disabled={busy || !signaturePng || !selectedPlacementId}
              onClick={duplicateSelected}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <CopyPlus className="h-4 w-4" aria-hidden />
              Duplicate
            </button>
            <button
              type="button"
              disabled={busy || !canPaste}
              onClick={() => pasteFromClipboard()}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden />
              Paste
            </button>
            <button
              type="button"
              disabled={busy || !signaturePng || placements.length === 0}
              onClick={applyAndDownload}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {busy ? MSG.processingFile : 'Apply & download'}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Click a signature to select it (cyan ring). <strong>Duplicate</strong> clones it onto the highlighted page.
            <strong> Ctrl/Cmd+C</strong> copies size/position; <strong>Ctrl/Cmd+V</strong> pastes on the highlighted page.
            Drag and release over another page to move. <strong>Esc</strong> clears selection.
          </p>
          {canPaste ? (
            <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">Copied placement in memory — choose a page and Paste or Ctrl/Cmd+V.</p>
          ) : null}

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/50">
            <SignPdfViewer
              key={`${pdfFile.name}-${pdfFile.size}-${pdfFile.lastModified}`}
              ref={viewerRef}
              file={pdfFile}
              signaturePreviewUrl={signaturePreviewUrl}
              placements={placements}
              setPlacements={setPlacements}
              focusedPageIndex={focusedPageIndex}
              setFocusedPageIndex={setFocusedPageIndex}
              selectedPlacementId={selectedPlacementId}
              onSelectPlacement={setSelectedPlacementId}
            />
          </div>
        </>
      ) : null}
    </ToolPageShell>
  )
}

import { useCallback, useMemo, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { PenLine } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import SignatureCreationModal from './SignatureCreationModal.jsx'
import SignPdfViewer from './SignPdfViewer.jsx'
import {
  defaultPlacementForPng,
  uint8ToDataUrlPng,
  viewportRectToPdfDrawImage,
} from './signPdfGeometry.js'

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

export default function SignPdfPage() {
  const viewerRef = useRef(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [signaturePng, setSignaturePng] = useState(null)
  const [placements, setPlacements] = useState([])
  const [focusedPageIndex, setFocusedPageIndex] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const signaturePreviewUrl = useMemo(
    () => (signaturePng?.length ? uint8ToDataUrlPng(signaturePng) : null),
    [signaturePng]
  )

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
    try {
      const pdfBytes = await pdfFile.arrayBuffer()
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      const sigImage = await doc.embedPng(signaturePng)

      const ordered = [...placements].sort((a, b) => a.pageIndex - b.pageIndex)
      for (const p of ordered) {
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
      downloadUint8(out, pdfFile.name.replace(/\.pdf$/i, '') + '-signed.pdf')
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not embed signature')
    } finally {
      setBusy(false)
    }
  }, [pdfFile, signaturePng, placements])

  return (
    <ToolPageShell
      title="Sign PDF"
      subtitle="Preview your PDF, place a draggable signature, then download a signed copy."
    >
      <SignatureCreationModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={onSignatureDone} />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">1. PDF</h3>
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => {
          setPdfFile(f[0])
          setPlacements([])
          setSignaturePng(null)
        }}
        label={pdfFile ? pdfFile.name : 'Drop PDF here'}
      />

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
              disabled={busy || !signaturePng || placements.length === 0}
              onClick={applyAndDownload}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {busy ? 'Working…' : 'Apply & download'}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            After Done, drag the signature on the page. Resize from the bottom-right corner. Scroll for multi-page
            documents — new signatures use the page most visible in the viewport.
          </p>

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
            />
          </div>
        </>
      ) : null}
    </ToolPageShell>
  )
}

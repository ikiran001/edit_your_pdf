import { useCallback, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'

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
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [tab, setTab] = useState('draw')
  const [imgFile, setImgFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const clearPad = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  const onPadDown = (e) => {
    drawing.current = true
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    const r = c.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }

  const onPadMove = (e) => {
    if (!drawing.current) return
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    const r = c.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const onPadUp = () => {
    drawing.current = false
  }

  const stamp = useCallback(async () => {
    if (!pdfFile) {
      setError('Upload a PDF first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const pdfBytes = await pdfFile.arrayBuffer()
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      const pages = doc.getPages()
      const page = pages[pages.length - 1]
      const { width, height } = page.getSize()

      let sigImage
      if (tab === 'draw') {
        const c = canvasRef.current
        if (!c) throw new Error('Signature pad not ready')
        const dataUrl = c.toDataURL('image/png')
        const res = await fetch(dataUrl)
        const pngBytes = new Uint8Array(await res.arrayBuffer())
        sigImage = await doc.embedPng(pngBytes)
      } else {
        if (!imgFile) throw new Error('Choose a signature image')
        const bytes = await imgFile.arrayBuffer()
        if (imgFile.type.includes('jpeg') || imgFile.type.includes('jpg')) {
          sigImage = await doc.embedJpg(bytes)
        } else {
          sigImage = await doc.embedPng(bytes)
        }
      }
      const maxW = width * 0.35
      const scale = Math.min(maxW / sigImage.width, (height * 0.25) / sigImage.height, 1)
      const w = sigImage.width * scale
      const h = sigImage.height * scale
      const margin = 36
      page.drawImage(sigImage, {
        x: margin,
        y: margin,
        width: w,
        height: h,
      })

      const out = await doc.save()
      downloadUint8(out, pdfFile.name.replace(/\.pdf$/i, '') + '-signed.pdf')
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not sign PDF')
    } finally {
      setBusy(false)
    }
  }, [pdfFile, tab, imgFile])

  return (
    <ToolPageShell title="Sign PDF" subtitle="Draw or upload a signature, then stamp the last page.">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Step 1: PDF to sign. Step 2: Create signature. Step 3: Download signed copy.
      </p>
      <h3 className="mb-2 text-sm font-semibold">1. PDF</h3>
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => setPdfFile(f[0])}
        label={pdfFile ? pdfFile.name : 'Drop PDF here'}
      />
      <h3 className="mb-2 mt-8 text-sm font-semibold">2. Signature</h3>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('draw')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'draw' ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800'}`}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'upload' ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800'}`}
        >
          Upload image
        </button>
      </div>
      {tab === 'draw' ? (
        <div className="mt-3">
          <canvas
            ref={(el) => {
              canvasRef.current = el
              if (el && el.width === 0) {
                el.width = 560
                el.height = 200
                const ctx = el.getContext('2d')
                ctx.fillStyle = '#fff'
                ctx.fillRect(0, 0, el.width, el.height)
              }
            }}
            className="w-full max-w-xl cursor-crosshair rounded-xl border border-zinc-300 bg-white dark:border-zinc-600"
            onMouseDown={onPadDown}
            onMouseMove={onPadMove}
            onMouseUp={onPadUp}
            onMouseLeave={onPadUp}
          />
          <button type="button" onClick={clearPad} className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
            Clear pad
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setImgFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={stamp}
        className="mt-8 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? 'Working…' : '3. Download signed PDF'}
      </button>
    </ToolPageShell>
  )
}

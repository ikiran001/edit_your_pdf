import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { canvasHasInk } from './signPdfGeometry.js'

/**
 * @param {{ open: boolean, onClose: () => void, onDone: (pngBytes: Uint8Array) => void | Promise<void> }} props
 */
export default function SignatureCreationModal({ open, onClose, onDone }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const fileInputRef = useRef(null)
  const [tab, setTab] = useState('draw')
  const [imgFile, setImgFile] = useState(null)
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null)
  const [typeText, setTypeText] = useState('')
  const [error, setError] = useState(null)

  const initDrawPad = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = 560
    c.height = 200
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setImgFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setImgPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setTypeText('')
    setTab('draw')
    requestAnimationFrame(() => initDrawPad())
  }, [open, initDrawPad])

  useEffect(() => {
    setError(null)
  }, [tab])

  useEffect(() => {
    if (!open || tab !== 'draw') return
    const id = requestAnimationFrame(() => initDrawPad())
    return () => cancelAnimationFrame(id)
  }, [open, tab, initDrawPad])

  useEffect(() => {
    if (!imgFile) {
      setImgPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return undefined
    }
    const url = URL.createObjectURL(imgFile)
    setImgPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imgFile])

  useEffect(() => {
    if (open) return undefined
    setImgFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setImgPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    return undefined
  }, [open])

  const clearPad = () => {
    initDrawPad()
    setError(null)
  }

  const padCoords = (clientX, clientY) => {
    const c = canvasRef.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    const sx = c.width / Math.max(r.width, 1)
    const sy = c.height / Math.max(r.height, 1)
    return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy }
  }

  const onPadDown = (e) => {
    drawing.current = true
    setError(null)
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!ctx) return
    const { x, y } = padCoords(e.clientX, e.clientY)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const onPadMove = (e) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = padCoords(e.clientX, e.clientY)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const onPadUp = () => {
    drawing.current = false
  }

  const rasterizeTypeToPng = async () => {
    const text = typeText.trim()
    if (!text) throw new Error('Type your name or signature')
    const c = document.createElement('canvas')
    c.width = 560
    c.height = 160
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    try {
      await document.fonts.load('600 40px "Dancing Script"')
    } catch {
      /* ignore */
    }
    await document.fonts?.ready?.catch?.(() => {})
    ctx.fillStyle = '#0f172a'
    ctx.font = '600 40px "Dancing Script", "Brush Script MT", cursive'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, c.width / 2, c.height / 2)
    const dataUrl = c.toDataURL('image/png')
    const res = await fetch(dataUrl)
    return new Uint8Array(await res.arrayBuffer())
  }

  const handleDone = async () => {
    setError(null)
    try {
      let pngBytes
      if (tab === 'draw') {
        const c = canvasRef.current
        if (!c || !c.width || !c.height) throw new Error('Signature pad is not ready')
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('Signature pad is not ready')
        if (!canvasHasInk(ctx, c.width, c.height)) {
          throw new Error('Draw your signature on the pad')
        }
        const dataUrl = c.toDataURL('image/png')
        const res = await fetch(dataUrl)
        pngBytes = new Uint8Array(await res.arrayBuffer())
      } else if (tab === 'upload') {
        if (!imgFile) throw new Error('Choose a signature image (PNG or JPEG)')
        const bytes = await imgFile.arrayBuffer()
        if (imgFile.type.includes('jpeg') || imgFile.type.includes('jpg')) {
          const bmp = await createImageBitmap(new Blob([bytes], { type: imgFile.type }))
          const c = document.createElement('canvas')
          c.width = bmp.width
          c.height = bmp.height
          const ctx = c.getContext('2d')
          ctx.drawImage(bmp, 0, 0)
          const dataUrl = c.toDataURL('image/png')
          const res = await fetch(dataUrl)
          pngBytes = new Uint8Array(await res.arrayBuffer())
        } else {
          pngBytes = new Uint8Array(bytes)
        }
      } else if (tab === 'type') {
        pngBytes = await rasterizeTypeToPng()
      } else {
        throw new Error('Select a tab')
      }
      await Promise.resolve(onDone(pngBytes))
      onClose()
    } catch (e) {
      setError(e?.message || 'Could not create signature')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sig-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="sig-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add signature
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Draw, upload an image, or type your name.</p>

        <div className="mt-4 flex gap-2">
          {['draw', 'upload', 'type'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              {t === 'type' ? 'Type' : t}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        )}

        <div className="mt-4">
          {tab === 'draw' ? (
            <>
              <canvas
                ref={canvasRef}
                className="w-full max-w-full cursor-crosshair touch-none rounded-xl border border-zinc-300 bg-white dark:border-zinc-600"
                onMouseDown={onPadDown}
                onMouseMove={onPadMove}
                onMouseUp={onPadUp}
                onMouseLeave={onPadUp}
                onTouchStart={(e) => {
                  e.preventDefault()
                  if (!e.touches[0]) return
                  onPadDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })
                }}
                onTouchMove={(e) => {
                  e.preventDefault()
                  if (!e.touches[0]) return
                  onPadMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })
                }}
                onTouchEnd={onPadUp}
              />
              <button
                type="button"
                onClick={clearPad}
                className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400"
              >
                Clear
              </button>
            </>
          ) : null}
          {tab === 'upload' ? (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => setImgFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20"
              >
                <Upload className="h-10 w-10 text-indigo-500" aria-hidden />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Click to upload signature image
                </span>
                <span className="text-xs text-zinc-500">PNG or JPEG</span>
              </button>
              {imgPreviewUrl ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950">
                  <p className="mb-2 text-xs font-medium text-zinc-500">Preview</p>
                  <img
                    src={imgPreviewUrl}
                    alt="Signature preview"
                    className="mx-auto max-h-32 max-w-full object-contain"
                  />
                  <p className="mt-2 truncate text-center text-xs text-zinc-500">{imgFile?.name}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {tab === 'type' ? (
            <input
              type="text"
              value={typeText}
              onChange={(e) => {
                setTypeText(e.target.value)
                setError(null)
              }}
              placeholder="Your name"
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-lg dark:border-zinc-600 dark:bg-zinc-950"
              style={{ fontFamily: '"Dancing Script", cursive' }}
              autoComplete="off"
            />
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

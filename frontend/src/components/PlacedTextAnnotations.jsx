import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { editorFontFamilyWithPdfHint } from '../lib/editorUnicodeFonts'
import { cssDisplayFontFromPdf, mapPdfFontNameToServer } from '../lib/textFormatDefaults'
import {
  LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS,
  PLACED_TEXT_PAD_CSS,
} from '../lib/placedTextConstants.js'
import {
  cssDeltaToViewportDelta,
  placedTextPdfFromViewportTopLeft,
  placedTextViewportTopLeftFromPdf,
  viewportPxToCssOverlay,
} from '../lib/placedTextPdfGeometry.js'
import { sampleBackgroundColorHex } from '../lib/sampleCanvasInkColor'

function placedTextTopLeftBmp(it, viewport, ch, bmpW, bmpH) {
  const fsPt = Math.max(4, Math.min(144, Number(it.fontSize) || 12))
  const legacyN =
    it.placementV2 === true ? 0 : LEGACY_PLACED_TEXT_WIDGET_TOP_OFFSET_CSS / Math.max(ch, 1)
  if (viewport && Number.isFinite(it.pdfX) && Number.isFinite(it.pdfBaselineY)) {
    return placedTextViewportTopLeftFromPdf(viewport, it.pdfX, it.pdfBaselineY, fsPt)
  }
  return { vx: it.x * bmpW, vy: (it.y + legacyN) * bmpH }
}

function placedTextTopLeftCss(it, viewport, cw, ch, bmpW, bmpH) {
  const { vx, vy } = placedTextTopLeftBmp(it, viewport, ch, bmpW, bmpH)
  return viewportPxToCssOverlay(vx, vy, cw, ch, bmpW, bmpH)
}

function measureTextWidthPx(text, fontWeight, fontSizePx, fontFamilyStack) {
  if (typeof document === 'undefined') return 80
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) return 80
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamilyStack}`
  const w = ctx.measureText(text || ' ').width
  return Math.max(24, Math.ceil(w) + 8)
}

/** Width × height for multi-line blocks (matches mask sizing). */
function measurePlacedTextBlockSizePx(text, fontWeight, fontSizePx, fontFamilyStack) {
  if (typeof document === 'undefined') return { w: 80, h: 20 }
  const lines = String(text ?? ' ').split(/\r?\n/)
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) return { w: 80, h: Math.max(14, Math.round(fontSizePx * 1.35)) }
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamilyStack}`
  let w = 24
  for (const line of lines) {
    w = Math.max(w, Math.ceil(ctx.measureText(line || ' ').width) + 8)
  }
  const lineH = Math.max(Math.round(fontSizePx * 1.35), 14)
  const h = Math.max(lineH, lines.length * lineH + 4)
  return { w, h }
}

function AnnEditableText({ text, onPatch, editorStyle, className }) {
  const r = useRef(null)
  useLayoutEffect(() => {
    const el = r.current
    if (!el) return
    if (document.activeElement === el) return
    el.textContent = text ?? ''
  }, [text])

  return (
    <div
      ref={r}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Annotation text"
      className={className}
      style={editorStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        onPatch({ text: (e.currentTarget.innerText ?? '').replace(/\u00a0/g, ' ') })
      }}
    />
  )
}

/**
 * DOM layer for `type: 'text'`.
 * - Unsaved / not yet in PDF: visible DOM text + mask (no duplicate on canvas).
 * - After save (`textBakedInEditorPdf`): idle = invisible hit target over PDF text; selected = dotted frame + editor.
 */
export default function PlacedTextAnnotations({
  items,
  /** @type {import('pdfjs-dist').PageViewport | null} */
  viewport,
  cw,
  ch,
  bmpW,
  bmpH,
  sx,
  pdfCanvasRef,
  selectedId,
  onSelectInfo,
  onPatchItem,
  onDragStartUndo,
  fontRatio,
}) {
  const dragRef = useRef(null)
  const rootRef = useRef(null)
  const [masks, setMasks] = useState({})
  /** Covers PDF glyphs at `placedTextLastBake` while the item is dirty (moved/edited since last save). */
  const [ghostMasks, setGhostMasks] = useState({})
  /** While dragging (incl. baked idle), show DOM text so it moves with the box — not a duplicate of the PDF at rest. */
  const [draggingId, setDraggingId] = useState(null)

  const textItems = useMemo(
    () => (Array.isArray(items) ? items.filter((it) => it && it.type === 'text') : []),
    [items]
  )

  useLayoutEffect(() => {
    const cv = pdfCanvasRef?.current
    if (!cv?.width || !textItems.length || cw < 2 || ch < 2) {
      setMasks((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    const padX = (PLACED_TEXT_PAD_CSS / Math.max(cw, 1)) * bmpW
    const padY = (PLACED_TEXT_PAD_CSS / Math.max(ch, 1)) * bmpH
    const next = {}
    for (const it of textItems) {
      const fs = Math.max(6, Math.min(240, (it.fontSizeCss ?? 14) * sx))
      const fam = editorFontFamilyWithPdfHint(cssDisplayFontFromPdf('', it.fontFamily || 'Helvetica'))
      const wPx = measureTextWidthPx(it.text, it.bold ? 700 : 400, fs, fam)
      const hPx = Math.max(Math.round(fs * 1.35), 14)
      const bodyWBmp = Math.max(4, (wPx / Math.max(cw, 1)) * bmpW)
      const bodyHBmp = Math.max(4, (hPx / Math.max(ch, 1)) * bmpH)
      const { vx: topVx, vy: topVy } = placedTextTopLeftBmp(it, viewport, ch, bmpW, bmpH)
      const leftBmp = Math.max(0, topVx - padX)
      const topBmp = Math.max(0, topVy - padY)
      const wBmp = Math.max(8, bodyWBmp + padX * 2)
      const hBmp = Math.max(8, bodyHBmp + padY * 2)
      try {
        next[it.id] = sampleBackgroundColorHex(cv, leftBmp, topBmp, wBmp, hBmp)
      } catch {
        next[it.id] = '#ffffff'
      }
    }
    setMasks((prev) => {
      const a = JSON.stringify(prev)
      const b = JSON.stringify(next)
      return a === b ? prev : next
    })
  }, [textItems, cw, ch, bmpW, bmpH, sx, pdfCanvasRef, viewport])

  useLayoutEffect(() => {
    const cv = pdfCanvasRef?.current
    if (!cv?.width || !textItems.length || cw < 2 || ch < 2) {
      setGhostMasks((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    const padX = (PLACED_TEXT_PAD_CSS / Math.max(cw, 1)) * bmpW
    const padY = (PLACED_TEXT_PAD_CSS / Math.max(ch, 1)) * bmpH
    const nextGhost = {}
    for (const it of textItems) {
      const b = it.placedTextLastBake
      if (!b || it.textBakedInEditorPdf === true) continue
      const fs = Math.max(6, Math.min(240, (b.fontSizeCss ?? 14) * sx))
      const fam = editorFontFamilyWithPdfHint(cssDisplayFontFromPdf('', b.fontFamily || 'Helvetica'))
      const { w: wPx, h: hPx } = measurePlacedTextBlockSizePx(b.text, b.bold ? 700 : 400, fs, fam)
      const bodyWBmp = Math.max(4, (wPx / Math.max(cw, 1)) * bmpW)
      const bodyHBmp = Math.max(4, (hPx / Math.max(ch, 1)) * bmpH)
      const ghostIt = {
        ...b,
        fontSize: b.fontSize ?? it.fontSize,
        placementV2: b.placementV2,
        pdfX: b.pdfX ?? it.pdfX,
        pdfBaselineY: b.pdfBaselineY ?? it.pdfBaselineY,
        x: b.x,
        y: b.y,
      }
      const { vx: gvx, vy: gvy } = placedTextTopLeftBmp(ghostIt, viewport, ch, bmpW, bmpH)
      const leftBmp = Math.max(0, gvx - padX)
      const topBmp = Math.max(0, gvy - padY)
      const wBmp = Math.max(8, bodyWBmp + padX * 2)
      const hBmp = Math.max(8, bodyHBmp + padY * 2)
      try {
        nextGhost[it.id] = sampleBackgroundColorHex(cv, leftBmp, topBmp, wBmp, hBmp)
      } catch {
        nextGhost[it.id] = '#ffffff'
      }
    }
    setGhostMasks((prev) => {
      const a = JSON.stringify(prev)
      const nextStr = JSON.stringify(nextGhost)
      return a === nextStr ? prev : nextGhost
    })
  }, [textItems, cw, ch, bmpW, bmpH, sx, pdfCanvasRef, viewport])

  useEffect(() => {
    const onIns = (ev) => {
      const t = ev.detail?.text
      if (t == null) return
      const root = rootRef.current
      const ae = document.activeElement
      if (!root || !ae || !root.contains(ae)) return
      if (!selectedId) return
      try {
        document.execCommand('insertText', false, String(t))
      } catch {
        ae.textContent = (ae.textContent ?? '') + t
      }
      const el = root.querySelector('[contenteditable="true"]')
      if (el) {
        onPatchItem(selectedId, { text: el.innerText ?? '' })
      }
    }
    document.addEventListener('pdfpilot-native-insert', onIns)
    return () => document.removeEventListener('pdfpilot-native-insert', onIns)
  }, [selectedId, onPatchItem])

  /** Commit focused placed-text editor before Save/Download so `pagesItems` is not stale (blur may not run). */
  useEffect(() => {
    const onFlush = () => {
      const root = rootRef.current
      if (!root) return
      const ae = document.activeElement
      if (!ae || ae.getAttribute('contenteditable') !== 'true') return
      if (!root.contains(ae)) return
      const host = ae.closest('[data-pdf-placed-text-root]')
      if (!host || !root.contains(host)) return
      const id = host.getAttribute('data-pdf-placed-text-id')
      if (!id) return
      const text = (ae.innerText ?? '').replace(/\u00a0/g, ' ')
      flushSync(() => {
        onPatchItem(id, { text })
      })
    }
    document.addEventListener('pdfpilot-flush-placed-text', onFlush)
    return () => document.removeEventListener('pdfpilot-flush-placed-text', onFlush)
  }, [onPatchItem])

  const beginDrag = useCallback(
    (e, it) => {
      if (!e.isPrimary) return
      e.preventDefault()
      e.stopPropagation()
      if (cw < 2 || ch < 2) return
      onDragStartUndo?.()
      setDraggingId(it.id)
      const fsPt = Math.max(4, Math.min(144, Number(it.fontSize) || 12))
      const usePdf =
        !!viewport &&
        Number.isFinite(it.pdfX) &&
        Number.isFinite(it.pdfBaselineY)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: it.x,
        originY: it.y,
        originPdfX: it.pdfX,
        originPdfBaselineY: it.pdfBaselineY,
        fontSizePt: fsPt,
        usePdf,
        id: it.id,
      }
      const onMove = (ev) => {
        const dr = dragRef.current
        if (!dr || dr.id !== it.id) return
        if (dr.usePdf && viewport) {
          const { dvx, dvy } = cssDeltaToViewportDelta(
            ev.clientX - dr.startX,
            ev.clientY - dr.startY,
            cw,
            ch,
            bmpW,
            bmpH
          )
          const v0 = placedTextViewportTopLeftFromPdf(
            viewport,
            dr.originPdfX,
            dr.originPdfBaselineY,
            dr.fontSizePt
          )
          const vx = Math.max(0, Math.min(viewport.width, v0.vx + dvx))
          const vy = Math.max(0, Math.min(viewport.height, v0.vy + dvy))
          const { pdfX, pdfBaselineY } = placedTextPdfFromViewportTopLeft(
            viewport,
            vx,
            vy,
            dr.fontSizePt
          )
          onPatchItem(
            it.id,
            {
              pdfX,
              pdfBaselineY,
              x: vx / viewport.width,
              y: vy / viewport.height,
            },
            { live: true }
          )
        } else {
          const dx = (ev.clientX - dr.startX) / cw
          const dy = (ev.clientY - dr.startY) / ch
          const nx = Math.min(0.99, Math.max(0, dr.originX + dx))
          const ny = Math.min(0.99, Math.max(0, dr.originY + dy))
          onPatchItem(it.id, { x: nx, y: ny }, { live: true })
        }
      }
      const onUp = () => {
        dragRef.current = null
        setDraggingId(null)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [bmpW, bmpH, cw, ch, viewport, onPatchItem, onDragStartUndo]
  )

  if (!textItems.length || cw < 2 || ch < 2) return null

  const ratio = Number(fontRatio) > 0 ? fontRatio : 1
  const padCss = PLACED_TEXT_PAD_CSS

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute left-0 top-0 z-[34]"
      style={{ width: cw, height: ch }}
    >
      {textItems.map((it) => {
        const fs = Math.max(6, Math.min(240, (it.fontSizeCss ?? 14) * sx))
        const fam = editorFontFamilyWithPdfHint(
          cssDisplayFontFromPdf('', it.fontFamily || mapPdfFontNameToServer('Helvetica'))
        )
        const selected = selectedId === it.id
        const baked = it.textBakedInEditorPdf === true
        const dragging = draggingId === it.id
        const showDomText = !baked || selected || dragging
        const mask = masks[it.id] || '#ffffff'
        const bGhost = it.placedTextLastBake
        const showPdfGhostCover = Boolean(bGhost && !baked)
        const ghostFs =
          bGhost &&
          Math.max(6, Math.min(240, (bGhost.fontSizeCss ?? 14) * sx))
        const ghostFam =
          bGhost &&
          editorFontFamilyWithPdfHint(
            cssDisplayFontFromPdf('', bGhost.fontFamily || mapPdfFontNameToServer('Helvetica'))
          )
        const ghostSize =
          bGhost && ghostFs && ghostFam
            ? measurePlacedTextBlockSizePx(bGhost.text, bGhost.bold ? 700 : 400, ghostFs, ghostFam)
            : { w: 40, h: 14 }
        const ghostW = Math.max(24, ghostSize.w) + padCss * 2
        const ghostH = Math.max(14, ghostSize.h) + padCss * 2
        const ghostBg = ghostMasks[it.id] || '#ffffff'
        const rot = Number(it.rotationDeg) || 0
        const op = Number.isFinite(Number(it.opacity)) ? Math.min(1, Math.max(0.05, it.opacity)) : 1
        const { cssX, cssY } = placedTextTopLeftCss(it, viewport, cw, ch, bmpW, bmpH)
        const ghostPos =
          bGhost &&
          placedTextTopLeftCss(
            {
              ...bGhost,
              fontSize: bGhost.fontSize ?? it.fontSize,
              pdfX: bGhost.pdfX ?? it.pdfX,
              pdfBaselineY: bGhost.pdfBaselineY ?? it.pdfBaselineY,
              placementV2: bGhost.placementV2,
              x: bGhost.x,
              y: bGhost.y,
            },
            viewport,
            cw,
            ch,
            bmpW,
            bmpH
          )
        const editorStyle = {
          fontFamily: fam,
          fontSize: fs,
          fontWeight: it.bold ? 700 : 400,
          fontStyle: it.italic ? 'italic' : 'normal',
          textDecoration: it.underline ? 'underline' : 'none',
          color: it.color || '#111827',
          opacity: op,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: rot ? 'top left' : undefined,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          WebkitTextFillColor: it.color || '#111827',
          textAlign: it.align || 'left',
        }
        const displayStyle =
          showDomText
            ? editorStyle
            : {
                ...editorStyle,
                opacity: 0,
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
              }
        const frameClass =
          selected
            ? 'border-2 border-dotted border-indigo-600 ring-2 ring-indigo-500/35 ring-offset-1 dark:border-indigo-400 dark:ring-indigo-400/25'
            : 'border-0 border-transparent shadow-none ring-0'
        const outerCursor =
          baked && !selected ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        return (
          <Fragment key={it.id}>
            {showPdfGhostCover && bGhost && ghostPos ? (
              <div
                className="pointer-events-none absolute z-0 rounded-sm"
                aria-hidden
                style={{
                  left: ghostPos.cssX - padCss,
                  top: ghostPos.cssY - padCss,
                  width: ghostW,
                  minHeight: ghostH,
                  backgroundColor: ghostBg,
                }}
              />
            ) : null}
            <div
              data-pdf-placed-text-root
              data-pdf-placed-text-id={it.id}
              role={baked && !selected ? 'button' : undefined}
              tabIndex={baked && !selected ? 0 : undefined}
              aria-label={
                baked && !selected ? 'Added text — click to edit or drag from edge to move' : undefined
              }
              className={`pointer-events-auto absolute z-[1] box-border min-w-0 overflow-visible rounded-sm ${outerCursor} ${frameClass}`}
              style={{
                left: cssX - padCss,
                top: cssY - padCss,
                padding: padCss,
                maxWidth: `min(${Math.max(cw - cssX + padCss, 40 + padCss)}px, 90vw)`,
                backgroundColor: showDomText ? mask : 'transparent',
              }}
              onPointerDown={(e) => {
                if (!e.isPrimary) return
                if (e.target.closest('[contenteditable="true"]')) return
                e.stopPropagation()
                beginDrag(e, it)
              }}
            >
              <div
                className="min-w-0"
                onPointerDown={(e) => {
                  if (!e.isPrimary) return
                  e.stopPropagation()
                  onSelectInfo({
                    id: it.id,
                    item: it,
                    fontRatio: ratio,
                  })
                }}
              >
                {selected ? (
                  <AnnEditableText
                    key={`${it.id}-edit`}
                    text={it.text}
                    onPatch={(patch) => onPatchItem(it.id, patch)}
                    editorStyle={editorStyle}
                    className="pdf-placed-text-editor min-h-[1.25em] w-full max-w-full cursor-text rounded-sm px-0.5 py-0 text-left outline-none"
                  />
                ) : (
                  <div
                    className={`min-h-[1.25em] select-none px-0.5 py-0 ${
                      baked ? 'cursor-pointer' : 'cursor-text'
                    }`}
                    style={displayStyle}
                    aria-hidden={!showDomText}
                  >
                    {it.text || '\u00a0'}
                  </div>
                )}
              </div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

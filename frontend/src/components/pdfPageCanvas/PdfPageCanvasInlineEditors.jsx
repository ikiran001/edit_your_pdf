import { useLayoutEffect } from 'react'
import { cssAnnotPreviewFontStack } from '../../lib/textFormatDefaults.js'
import { ANNOT_TEXT_DISPLAY_BG, MAX_ANNOT_TEXT_LENGTH } from './constants.js'

/**
 * contentEditable must not use `{item.text}` as React children: any parent re-render
 * (e.g. Text format syncing font size/color via patchAnnotItem) resets the DOM and
 * wipes in-progress typing or stacks visual state. Seed text once per open instead.
 */

/** iLovePDF-style: red circle X, overlaps top-right of the blue text frame */
export function TextAnnotBoxDeleteBtn({ onDelete }) {
  return (
    <button
      type="button"
      data-pdf-annot-delete-skip-blur
      aria-label="Delete text"
      className="absolute -right-2 -top-2 z-[6] flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-red-500 text-[17px] font-light leading-none text-white shadow-md hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
    >
      ×
    </button>
  )
}

export function AnnotTextContentEditable({
  item,
  fontSizePx,
  color,
  bold,
  italic,
  underline,
  fontFamily,
  align,
  editorRef,
  onCommit,
}) {
  /* Seed DOM once per mount. Omitting item.text from deps avoids resetting when Text format sync patches font/color. */
  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.textContent = item.text ?? ''
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps -- see comment above

  const fontStack = cssAnnotPreviewFontStack(fontFamily || 'Helvetica')

  return (
    <div
      ref={(el) => {
        editorRef.current = el
      }}
      contentEditable
      suppressContentEditableWarning
      data-pdf-annot-editor
      className="pdf-annot-inline-editor inline-block min-h-[1.5rem] w-max max-w-[min(18rem,calc(100vw-2rem))] cursor-text select-text rounded-sm border-0 py-0 pl-0 pr-2 font-sans outline-none"
      style={{
        fontSize: `${fontSizePx}px`,
        /* Keep in sync with ANNOT_UI_LINE_HEIGHT in backend applyEdits.js */
        lineHeight: 1.35,
        color,
        background: 'transparent',
        backgroundColor: ANNOT_TEXT_DISPLAY_BG,
        caretColor: '#2563eb',
        minWidth: '2ch',
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: underline ? 'underline' : 'none',
        textDecorationLine: underline ? 'underline' : 'none',
        fontFamily: fontStack,
        textAlign: align || 'left',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => {
        const el = e.currentTarget
        if ((el.innerText ?? '').length > MAX_ANNOT_TEXT_LENGTH) {
          const sel = window.getSelection()
          const range = sel?.getRangeAt(0)
          el.innerText = (el.innerText ?? '').slice(0, MAX_ANNOT_TEXT_LENGTH)
          if (range) {
            try {
              sel.removeAllRanges()
              range.collapse(false)
              sel.addRange(range)
            } catch {
              /* ignore */
            }
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          const el = editorRef.current
          onCommit(item.id, el?.innerText ?? '')
        }
      }}
    />
  )
}

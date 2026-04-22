import { Link } from 'react-router-dom'

function Row({ keys, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-zinc-200 py-2.5 last:border-b-0 dark:border-zinc-700 sm:flex-row sm:items-start sm:gap-4">
      <div className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">{keys}</div>
      <div className="text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  )
}

export default function EditPdfShortcutsModal({ open, onClose }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-pdf-shortcuts-title"
        className="max-h-[min(90dvh,32rem)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id="edit-pdf-shortcuts-title" className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Edit PDF — tips & shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400">
          Press <kbd className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">?</kbd> anytime (when not typing in a
          field) to open this panel.
        </div>

        <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-200">
          <strong className="font-semibold">File flow:</strong> draft on the canvas, then{' '}
          <strong>Save PDF</strong> (writes to the server), then <strong>Download PDF</strong> (exports a file). Both
          actions live in the Edits panel.
        </div>

        <section>
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Text editing
          </h3>
          <Row keys="Tap / click">Select a line on the page (with Edit text + text boxes on).</Row>
          <Row keys="Ctrl + Enter">Apply your line edit and leave the inline editor.</Row>
          <Row keys="Escape">Cancel inline editing for the current line.</Row>
          <Row keys="Undo / Redo">Toolbar buttons step through markup history (draw, shapes, added text boxes).</Row>
        </section>

        <section className="mt-4">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Placed text &amp; signature
          </h3>
          <Row keys="Arrow keys">
            Nudge the selected text box or signature (not while typing in the inline editor). Hold Shift for a finer
            step. Placement snaps gently to nearby PDF text lines when you release a drag.
          </Row>
          <Row keys="Enter / Ctrl+Enter">
            While placing <strong>Add Text</strong>, press Enter for a new line. Press Ctrl+Enter (or Cmd+Enter on
            Mac) to finish and place the box.
          </Row>
        </section>

        <section className="mt-4">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Related tools
          </h3>
          <p className="mt-2 mb-0 text-sm text-zinc-700 dark:text-zinc-300">
            Export pages as images from{' '}
            <Link to="/tools/pdf-to-jpg" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400" onClick={onClose}>
              PDF to JPG
            </Link>
            .
          </p>
        </section>

        <section className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800/40">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Not in this build
          </h3>
          <p className="mt-1.5 mb-0 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            If nothing highlights when you tap the page, the file may be image-only (a scan) — our editor needs
            selectable text. OCR, version history, shareable links, and in-app page reorder are roadmap items, not
            hidden toggles.
          </p>
        </section>
      </div>
    </div>
  )
}

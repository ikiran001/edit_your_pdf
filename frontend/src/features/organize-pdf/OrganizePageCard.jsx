import { ArrowDown, ArrowUp, GripVertical, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import LazyPdfPageThumbnail from './LazyPdfPageThumbnail.jsx'

export default function OrganizePageCard({
  pdfDoc,
  item,
  displayIndex1Based,
  disabled,
  isDragging,
  isDropTarget,
  selected,
  onToggleSelect,
  multiSelectEnabled,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRotateLeft,
  onRotateRight,
  onDelete,
  canMoveEarlier,
  canMoveLater,
  onMoveEarlier,
  onMoveLater,
}) {
  return (
    <article
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) {
          e.preventDefault()
          return
        }
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', item.id)
        onDragStart(item.id)
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(item.id)
      }}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        const fromId = e.dataTransfer.getData('text/plain')
        onDrop(fromId, item.id)
      }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition-all duration-200 dark:bg-zinc-900/85 ${
        isDragging
          ? 'scale-[0.97] border-indigo-300 opacity-60 ring-2 ring-indigo-400/40 dark:border-indigo-500/50'
          : 'border-zinc-200 dark:border-zinc-700'
      } ${
        isDropTarget && !isDragging
          ? 'z-10 border-2 border-dashed border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-400/30 ring-offset-2 ring-offset-white dark:border-cyan-400 dark:bg-cyan-950/20 dark:ring-cyan-400/25 dark:ring-offset-zinc-950'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-300/90 bg-zinc-100 px-2.5 py-2.5 sm:px-3 dark:border-zinc-600 dark:bg-zinc-800/95">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {multiSelectEnabled ? (
            <input
              type="checkbox"
              checked={selected}
              disabled={disabled}
              onChange={() => onToggleSelect(item.id)}
              className="h-5 w-5 shrink-0 rounded border-2 border-zinc-500 text-indigo-600 focus:ring-2 focus:ring-indigo-500 dark:border-zinc-400"
              aria-label={`Select page ${displayIndex1Based}`}
            />
          ) : null}
          <span
            className="inline-flex shrink-0 cursor-grab touch-none items-center justify-center rounded-lg border-2 border-zinc-700 bg-zinc-500 p-1 shadow-sm active:cursor-grabbing dark:border-zinc-300 dark:bg-zinc-600 dark:shadow-md"
            title="Drag page to reorder"
            aria-hidden
          >
            <GripVertical className="h-8 w-8 text-white dark:text-zinc-50" strokeWidth={3} />
          </span>
          <span className="min-w-0 truncate text-base font-bold tabular-nums tracking-tight text-zinc-950 dark:text-white">
            Page {displayIndex1Based}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            draggable={false}
            disabled={disabled || !canMoveEarlier}
            onClick={() => onMoveEarlier(item.id)}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border-2 border-zinc-400/90 bg-white text-zinc-800 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-500/60 dark:hover:bg-zinc-950 dark:hover:text-cyan-200"
            title="Move earlier (smaller page number)"
            aria-label="Move page earlier in order"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            draggable={false}
            disabled={disabled || !canMoveLater}
            onClick={() => onMoveLater(item.id)}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border-2 border-zinc-400/90 bg-white text-zinc-800 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-500/60 dark:hover:bg-zinc-950 dark:hover:text-cyan-200"
            title="Move later (larger page number)"
            aria-label="Move page later in order"
          >
            <ArrowDown className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="p-1.5 sm:p-2">
        <LazyPdfPageThumbnail
          key={`${item.id}-${item.rotationDelta}`}
          pdfDoc={pdfDoc}
          pageIndex1Based={item.sourceIndex + 1}
          extraRotation={item.rotationDelta}
        />
      </div>

      <div className="mt-auto flex items-center justify-center gap-2 border-t border-zinc-300/90 bg-zinc-100 px-3 py-3 dark:border-zinc-600 dark:bg-zinc-800/95">
        <button
          type="button"
          draggable={false}
          disabled={disabled}
          onClick={() => onRotateLeft(item.id)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-zinc-400/90 bg-white text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 disabled:opacity-40 dark:border-zinc-500 dark:bg-zinc-900 dark:text-cyan-300 dark:hover:border-cyan-500/60 dark:hover:bg-zinc-950 dark:hover:text-cyan-200"
          title="Rotate left"
          aria-label="Rotate page left"
        >
          <RotateCcw className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          draggable={false}
          disabled={disabled}
          onClick={() => onRotateRight(item.id)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-zinc-400/90 bg-white text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 disabled:opacity-40 dark:border-zinc-500 dark:bg-zinc-900 dark:text-cyan-300 dark:hover:border-cyan-500/60 dark:hover:bg-zinc-950 dark:hover:text-cyan-200"
          title="Rotate right"
          aria-label="Rotate page right"
        >
          <RotateCw className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          draggable={false}
          disabled={disabled}
          onClick={() => onDelete(item.id)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-red-300/90 bg-white text-red-700 shadow-sm transition hover:border-red-500 hover:bg-red-50 hover:text-red-800 disabled:opacity-40 dark:border-red-900/80 dark:bg-zinc-900 dark:text-red-400 dark:hover:border-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-300"
          title="Delete page"
          aria-label="Delete page"
        >
          <Trash2 className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>
    </article>
  )
}

const tools = [
  { id: 'text', label: 'Text' },
  { id: 'draw', label: 'Draw' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'rect', label: 'Rectangle' },
]

export default function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDownload,
  downloading,
  applyTextSwap,
  onApplyTextSwapChange,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
      <div className="mr-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">Tools</div>
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onToolChange(t.id === activeTool ? null : t.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            activeTool === t.id
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          {t.label}
        </button>
      ))}
      <span className="mx-2 hidden h-6 w-px bg-zinc-200 sm:inline dark:bg-zinc-600" />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-100"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-100"
      >
        Redo
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <label className="flex max-w-[min(100%,16rem)] cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 md:max-w-none">
          <input
            type="checkbox"
            className="rounded border-zinc-300"
            checked={applyTextSwap}
            onChange={(e) => onApplyTextSwapChange(e.target.checked)}
          />
          <span className="hidden sm:inline">
            Replace embedded “PDF editor” with “PDF love” in the file
          </span>
          <span className="sm:hidden">Text swap</span>
        </label>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
        >
          {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
    </div>
  )
}

import ThemeToggle from '../shared/components/ThemeToggle.jsx'
import BrandLogoLink from '../shared/components/BrandLogoLink.jsx'
import { BRAND_NAME, MSG } from '../shared/constants/branding.js'

const tools = [
  { id: 'editText', label: 'Edit text' },
  { id: 'text', label: 'Text' },
  { id: 'draw', label: 'Draw' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'rect', label: 'Rectangle' },
]

export default function Toolbar({
  activeTool,
  onToolChange,
  editTextMode,
  onEditTextModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onDownload,
  saving,
  downloading,
  applyTextSwap,
  onApplyTextSwapChange,
}) {
  return (
    <div className="fx-glass-header flex flex-wrap items-center gap-2 px-3 py-2">
      <BrandLogoLink className="mr-1 min-w-0 max-w-[10rem] shrink-0 sm:max-w-none" />
      <div className="mr-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">Tools</div>
      {onEditTextModeChange && (
        <button
          type="button"
          onClick={() => onEditTextModeChange(!editTextMode)}
          title="Show or hide detected text boxes and inline editing"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            editTextMode
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          Text edit mode
        </button>
      )}
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
        <ThemeToggle />
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
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || downloading}
              className="rounded-lg border border-emerald-700 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
            >
              {saving ? MSG.finalizingPdf : 'Save PDF'}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={saving || downloading}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {downloading ? MSG.processingFile : 'Download PDF'}
            </button>
          </div>
          <span className="text-center text-[10px] font-medium text-zinc-400 sm:text-right dark:text-zinc-500">
            {BRAND_NAME}
          </span>
        </div>
      </div>
    </div>
  )
}

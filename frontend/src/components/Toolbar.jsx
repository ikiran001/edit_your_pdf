import ThemeToggle from '../shared/components/ThemeToggle.jsx'
import BrandLogoLink from '../shared/components/BrandLogoLink.jsx'
import { BRAND_NAME, MSG } from '../shared/constants/branding.js'

const tools = [
  { id: 'editText', label: 'Edit text' },
  { id: 'text', label: 'Add Text' },
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
  onShortcutsClick,
}) {
  return (
    <div
      className="fx-glass-header flex flex-wrap items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2"
      data-pdf-editor-chrome
    >
      <BrandLogoLink className="mr-0 min-w-0 max-w-[9rem] shrink-0 sm:mr-1 sm:max-w-none" />
      <div className="mr-1 hidden text-sm font-medium text-zinc-600 sm:mr-2 sm:block dark:text-zinc-300">
        Tools
      </div>
      {onEditTextModeChange && (
        <button
          type="button"
          onClick={() => onEditTextModeChange(!editTextMode)}
          title="Show or hide detected text boxes and inline editing"
          className={`rounded-lg px-2 py-1 text-xs font-medium transition sm:px-3 sm:py-1.5 sm:text-sm ${
            editTextMode
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          <span className="sm:hidden">Text boxes</span>
          <span className="max-sm:hidden">Text edit mode</span>
        </button>
      )}
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onToolChange(t.id === activeTool ? null : t.id)}
          className={`rounded-lg px-2 py-1 text-xs font-medium transition sm:px-3 sm:py-1.5 sm:text-sm ${
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
        className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-sm dark:bg-zinc-800 dark:text-zinc-100"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-sm dark:bg-zinc-800 dark:text-zinc-100"
      >
        Redo
      </button>
      {onShortcutsClick && (
        <button
          type="button"
          onClick={onShortcutsClick}
          title="Tips and keyboard shortcuts (?)"
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 sm:px-2.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <span className="sm:hidden">?</span>
          <span className="max-sm:hidden">Tips</span>
        </button>
      )}
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start sm:gap-3">
        <ThemeToggle />
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex flex-wrap justify-end gap-2" data-pdf-session-actions>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || downloading}
              className="rounded-lg border border-emerald-700 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:opacity-50 sm:px-4 sm:py-1.5 sm:text-sm dark:border-emerald-500 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
            >
              {saving ? MSG.finalizingPdf : 'Save PDF'}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={saving || downloading}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 sm:px-4 sm:py-1.5 sm:text-sm"
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

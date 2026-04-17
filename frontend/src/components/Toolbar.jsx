import ThemeToggle from '../shared/components/ThemeToggle.jsx'
import BrandLogoLink from '../shared/components/BrandLogoLink.jsx'
import { BRAND_NAME, MSG } from '../shared/constants/branding.js'

const textTools = [
  { id: 'editText', label: 'Edit text' },
  { id: 'text', label: 'Add Text' },
  { id: 'signature', label: 'Signature' },
]
const markupTools = [
  { id: 'draw', label: 'Draw' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'rect', label: 'Rectangle' },
]

function toolButtonClass(active) {
  const base =
    'fx-focus-ring rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm min-h-9 sm:min-h-0'
  if (active) {
    return `${base} bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-white dark:ring-indigo-300/50 dark:ring-offset-zinc-900`
  }
  return `${base} bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700`
}

function ToolbarDivider() {
  return <span className="mx-1 hidden h-6 w-px shrink-0 bg-zinc-200 sm:inline dark:bg-zinc-600" />
}

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
  zoom = 1.0,
  onZoomIn,
  onZoomOut,
  flattenFormsOnSave = true,
  onFlattenFormsOnSaveChange,
}) {
  const editModeClass = editTextMode
    ? 'fx-focus-ring rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm min-h-9 sm:min-h-0 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-white dark:ring-indigo-300/50 dark:ring-offset-zinc-900'
    : 'fx-focus-ring rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm min-h-9 sm:min-h-0 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'

  return (
    <div className="fx-glass-header flex flex-wrap items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
      <BrandLogoLink className="mr-0 min-w-0 max-w-[9rem] shrink-0 sm:mr-1 sm:max-w-none" />
      <div className="mr-1 hidden text-sm font-medium text-zinc-600 sm:mr-2 sm:block dark:text-zinc-300">
        Tools
      </div>
      {onEditTextModeChange && (
        <button
          type="button"
          onClick={() => onEditTextModeChange(!editTextMode)}
          title="Show or hide detected text boxes and inline editing"
          className={editModeClass}
        >
          <span className="sm:hidden">Text boxes</span>
          <span className="max-sm:hidden">Text edit mode</span>
        </button>
      )}
      <ToolbarDivider />
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-zinc-400 sm:inline dark:text-zinc-500">
        Text
      </span>
      {textTools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onToolChange(t.id === activeTool ? null : t.id)}
          className={toolButtonClass(activeTool === t.id)}
        >
          {t.label}
        </button>
      ))}
      <ToolbarDivider />
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-zinc-400 sm:inline dark:text-zinc-500">
        Markup
      </span>
      {markupTools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onToolChange(t.id === activeTool ? null : t.id)}
          className={toolButtonClass(activeTool === t.id)}
        >
          {t.label}
        </button>
      ))}
      <ToolbarDivider />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="fx-focus-ring rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40 sm:px-3 sm:text-sm min-h-9 dark:bg-zinc-800 dark:text-zinc-100"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="fx-focus-ring rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40 sm:px-3 sm:text-sm min-h-9 dark:bg-zinc-800 dark:text-zinc-100"
      >
        Redo
      </button>
      {(onZoomIn || onZoomOut) && (
        <>
          <ToolbarDivider />
          <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-zinc-400 sm:inline dark:text-zinc-500">
            View
          </span>
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoom <= 0.5}
            title="Zoom out"
            className="fx-focus-ring rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40 sm:px-2.5 sm:text-sm min-h-9 min-w-9 dark:bg-zinc-800 dark:text-zinc-100"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoom >= 2.0}
            title="Zoom in"
            className="fx-focus-ring rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40 sm:px-2.5 sm:text-sm min-h-9 min-w-9 dark:bg-zinc-800 dark:text-zinc-100"
          >
            +
          </button>
        </>
      )}
      {onShortcutsClick && (
        <button
          type="button"
          onClick={onShortcutsClick}
          title="Tips and keyboard shortcuts (?)"
          className="fx-focus-ring rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 min-h-9 min-w-9 sm:px-2.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <span className="sm:hidden">?</span>
          <span className="max-sm:hidden">Tips</span>
        </button>
      )}
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start sm:gap-3">
        <ThemeToggle />
        <ToolbarDivider />
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-zinc-400 sm:block sm:text-right dark:text-zinc-500">
            File
          </span>
          {typeof onFlattenFormsOnSaveChange === 'function' && (
            <label className="flex cursor-pointer select-none items-center justify-end gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border-zinc-400 text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-zinc-500"
                checked={flattenFormsOnSave}
                onChange={(e) => onFlattenFormsOnSaveChange(e.target.checked)}
              />
              <span title="Bakes fillable fields into the page so Chrome/Edge/Acrobat no longer show blue field shading. Fields become static after save.">
                Flatten forms on save
              </span>
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || downloading}
              className="fx-focus-ring rounded-lg border border-emerald-700 bg-white px-2.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:opacity-50 sm:px-4 sm:py-1.5 sm:text-sm min-h-11 dark:border-emerald-500 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
            >
              {saving ? MSG.finalizingPdf : 'Save PDF'}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={saving || downloading}
              className="fx-focus-ring rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 sm:px-4 sm:py-1.5 sm:text-sm min-h-11"
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

import { MSG } from '../constants/branding.js'

/**
 * One-time dismissible hint for the PDF editor (mobile + desktop).
 */
export default function EditorOnboardingBanner({ onDismiss, onOpenShortcuts }) {
  return (
    <div
      role="note"
      className="mb-3 flex flex-col gap-2 rounded-lg border border-indigo-200/80 bg-indigo-50/90 px-3 py-2.5 text-sm text-indigo-950 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-500/25 dark:bg-indigo-950/40 dark:text-indigo-100"
    >
      <p className="m-0 max-w-3xl leading-snug">{MSG.editorOnboardingHint}</p>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-3 sm:justify-end">
        {typeof onOpenShortcuts === 'function' && (
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="rounded-md border border-indigo-300/90 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-white dark:border-indigo-500/40 dark:bg-indigo-900/50 dark:text-indigo-100 dark:hover:bg-indigo-900/80"
          >
            Shortcuts & tips
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

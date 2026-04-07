import { MSG } from '../constants/branding.js'

/**
 * One-time dismissible hint for the PDF editor (mobile + desktop).
 */
export default function EditorOnboardingBanner({ onDismiss }) {
  return (
    <div
      role="note"
      className="mb-3 flex flex-col gap-2 rounded-lg border border-indigo-200/80 bg-indigo-50/90 px-3 py-2.5 text-sm text-indigo-950 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-500/25 dark:bg-indigo-950/40 dark:text-indigo-100"
    >
      <p className="m-0 max-w-3xl leading-snug">{MSG.editorOnboardingHint}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 sm:ml-3"
      >
        Got it
      </button>
    </div>
  )
}

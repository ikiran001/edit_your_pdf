import { MSG } from '../shared/constants/branding.js'

function annotTypeLabel(type) {
  switch (type) {
    case 'text':
      return 'Added text'
    case 'draw':
      return 'Drawing'
    case 'highlight':
      return 'Highlight'
    case 'rect':
      return 'Rectangle'
    case 'signature':
      return 'Signature'
    default:
      return 'Markup'
  }
}

function truncate(s, max = 48) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * Lists session edits (native text replacements + page annotations) with per-item remove
 * and session-level Save / Download / Clear all.
 */
function formatLastSaved(ts) {
  if (ts == null || !Number.isFinite(ts)) return null
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return null
  }
}

export default function EditsSidebar({
  nativeTextEdits = [],
  pagesItems = {},
  numPages = 0,
  onRemoveNative,
  onRemoveAnnot,
  /** Scroll the main canvas to a page (e.g. when clicking an edit row). */
  onJumpToPage,
  onClearAll,
  onSave,
  onDownload,
  saving,
  downloading,
  /** True while Firebase auth state is still resolving — avoids racing Download before we know guest vs signed-in. */
  authLoading = false,
  listSyncing = false,
  /** Set when the server last accepted a full persist (save, autosave, list sync, etc.). */
  lastSavedAt = null,
  /** True when local edits are ahead of the last successful server persist (debounced). */
  unsavedChanges = false,
  /** `idle` | `armed` (timer running) | `saving` (autosave POST in flight). */
  autosaveStatus = 'idle',
  /** When true and signed in, show “Save named copy” (server duplicate + library row). */
  namedCopyEnabled = false,
  userSignedIn = false,
  namedCopyBusy = false,
  onNamedCopy,
}) {
  const entries = []

  for (let p = 0; p < numPages; p++) {
    const nativesOnPage = nativeTextEdits.filter((e) => Number(e.pageIndex) === p)
    for (const nt of nativesOnPage) {
      const sid = nt.slotId
      if (typeof sid !== 'string' || sid.length < 8) continue
      const trimmed = String(nt.text ?? '').replace(/\s+/g, ' ').trim()
      const bid = typeof nt.blockId === 'string' ? nt.blockId : ''
      entries.push({
        key: `native:${sid}`,
        kind: 'native',
        pageIndex: p,
        slotId: sid,
        label: 'Edited text',
        preview: trimmed ? truncate(nt.text, 64) : '',
        blockIdHint: bid.length > 12 ? `${bid.slice(0, 12)}…` : bid,
      })
    }
    const items = pagesItems[p] || []
    for (const it of items) {
      if (!it?.id) continue
      entries.push({
        key: `annot:${it.id}`,
        kind: 'annot',
        pageIndex: p,
        itemId: it.id,
        label: annotTypeLabel(it.type),
        preview: it.type === 'text' ? truncate(it.text, 64) : '',
      })
    }
  }

  const count = entries.length
  const busy = saving || downloading || listSyncing || namedCopyBusy
  const downloadBusy = busy || authLoading
  const savedLabel = formatLastSaved(lastSavedAt)
  const autosaveLabel =
    autosaveStatus === 'saving'
      ? 'Auto-saving…'
      : autosaveStatus === 'armed'
        ? 'Autosave on (~45s after you stop editing)'
        : null

  return (
    <aside
      data-pdf-edits-sidebar
      className="flex max-h-[min(40vh,22rem)] shrink-0 flex-col border-t border-zinc-200 bg-white/95 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] dark:border-zinc-700 dark:bg-zinc-950/95 dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.4)] md:max-h-none md:w-[min(100%,17rem)] md:border-t-0 md:border-l md:shadow-none lg:w-[min(100%,18.5rem)]"
      aria-label="Session edits"
    >
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Edits ({count})
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          Draft on the canvas, then <strong>Save PDF</strong> (writes to the server), then{' '}
          <strong>Download PDF</strong> (exports a file). Remove one change with ✕, or clear
          everything when you need a clean slate. Tap an edit row (except ✕) to jump to that page.
        </p>
        <p className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
          <strong>Autosave</strong> (~45s after you stop editing) also POSTs to the server; use{' '}
          <strong>Save PDF</strong> when you want an immediate sync before download or leaving.
        </p>
        {unsavedChanges ? (
          <p
            className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium leading-snug text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            Unsaved changes — Save PDF to update the server copy.
          </p>
        ) : null}
        {autosaveLabel ? (
          <p className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            {autosaveLabel}
          </p>
        ) : null}
        {savedLabel ? (
          <p className="mt-1 text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
            Last saved to session: <span className="font-medium text-zinc-600 dark:text-zinc-400">{savedLabel}</span>
          </p>
        ) : (
          <p className="mt-1 text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
            Not synced to the server yet — use Save PDF when you want a full write.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2">
        {count === 0 ? (
          <p className="px-1 py-3 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            No edits yet. Change a line with Edit text, or use Add Text / Draw / Highlight /
            Rectangle. When you are happy with the draft, use Save PDF then Download PDF above.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <li
                key={e.key}
                className="flex items-start gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-900/60"
              >
                <button
                  type="button"
                  disabled={busy || typeof onJumpToPage !== 'function'}
                  title={
                    typeof onJumpToPage === 'function'
                      ? 'Go to this page in the editor'
                      : undefined
                  }
                  onClick={() => onJumpToPage?.(e.pageIndex)}
                  className="fx-focus-ring min-w-0 flex-1 rounded-l-lg px-2 py-1.5 text-left transition hover:bg-zinc-100/90 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-zinc-800/80 dark:disabled:hover:bg-transparent"
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Pg {e.pageIndex + 1} · {e.label}
                  </div>
                  {e.preview ? (
                    <div className="mt-0.5 break-words text-xs text-zinc-800 dark:text-zinc-200">
                      {e.preview}
                    </div>
                  ) : e.kind === 'native' ? (
                    <div className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-100/90">
                      <span className="font-medium">(empty text)</span>
                      {e.blockIdHint ? (
                        <span className="ml-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {e.blockIdHint}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">—</div>
                  )}
                </button>
                <button
                  type="button"
                  title="Remove this edit"
                  aria-label={`Remove ${e.label} on page ${e.pageIndex + 1}`}
                  disabled={busy}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => {
                    if (e.kind === 'native') onRemoveNative?.(e.slotId)
                    else onRemoveAnnot?.(e.pageIndex, e.itemId)
                  }}
                  className="mt-0.5 shrink-0 rounded-r-lg p-1.5 text-zinc-500 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-40 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                >
                  <span className="block text-sm leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={onSave}
            disabled={busy}
            className="w-full rounded-lg border border-emerald-700 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
          >
            {saving ? MSG.finalizingPdf : 'Save PDF'}
          </button>
          {namedCopyEnabled && userSignedIn && typeof onNamedCopy === 'function' ? (
            <button
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={onNamedCopy}
              disabled={busy || authLoading}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
            >
              {namedCopyBusy ? 'Creating named copy…' : 'Save named copy…'}
            </button>
          ) : null}
          <button
            type="button"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={onDownload}
            disabled={downloadBusy}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {authLoading ? 'Checking sign-in…' : downloading ? MSG.processingFile : 'Download PDF'}
          </button>
          <button
            type="button"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={onClearAll}
            disabled={busy || count === 0}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Clear all
          </button>
        </div>
      </div>
    </aside>
  )
}

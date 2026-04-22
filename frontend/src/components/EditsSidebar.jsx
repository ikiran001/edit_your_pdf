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
}) {
  const entries = []

  for (let p = 0; p < numPages; p++) {
    const nativesOnPage = nativeTextEdits.filter((e) => Number(e.pageIndex) === p)
    for (const nt of nativesOnPage) {
      const sid = nt.slotId
      if (typeof sid !== 'string' || sid.length < 8) continue
      entries.push({
        key: `native:${sid}`,
        kind: 'native',
        pageIndex: p,
        slotId: sid,
        label: 'Edited text',
        preview: truncate(nt.text, 64),
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
  const busy = saving || downloading || listSyncing
  const downloadBusy = busy || authLoading
  const savedLabel = formatLastSaved(lastSavedAt)

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
          Remove one change with ✕, or clear everything. Use Save PDF then Download PDF when
          you are done.
        </p>
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
          <p className="px-1 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No edits yet. Edit a text line or use Add Text / Draw / Highlight / Rectangle.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <li
                key={e.key}
                className="flex items-start gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Pg {e.pageIndex + 1} · {e.label}
                  </div>
                  {e.preview ? (
                    <div className="mt-0.5 break-words text-xs text-zinc-800 dark:text-zinc-200">
                      {e.preview}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">—</div>
                  )}
                </div>
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
                  className="mt-0.5 shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-40 dark:hover:bg-red-950/50 dark:hover:text-red-300"
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

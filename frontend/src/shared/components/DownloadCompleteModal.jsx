import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, FileText, MessageCircle, Shield } from 'lucide-react'
import { BRAND_NAME } from '../constants/branding.js'
import { getSupportPaymentUrl } from '../../lib/supportPaymentUrl.js'
import { trackFeatureUsed } from '../../lib/analytics.js'

function formatFileSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   fileName: string
 *   fileSizeBytes: number
 * }} props
 */
export default function DownloadCompleteModal({ open, onClose, fileName, fileSizeBytes }) {
  const supportUrl = getSupportPaymentUrl()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onSupportClick = () => {
    trackFeatureUsed('support_payment_link_click')
  }

  return (
    <div
      className="fixed inset-0 z-[310] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-complete-title"
        className="w-full max-w-md rounded-t-2xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100 shadow-2xl sm:rounded-2xl sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 shadow-inner"
              aria-hidden
            >
              <Check className="h-5 w-5 stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id="download-complete-title" className="m-0 text-lg font-bold leading-tight text-white">
                Download complete
              </h2>
              <p className="mt-1 text-sm leading-snug text-zinc-400">
                Your PDF was saved using your browser’s download folder.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-xl border border-zinc-600/60 bg-zinc-800/80 px-3 py-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/90 text-white"
            aria-hidden
          >
            <FileText className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white" title={fileName}>
              {fileName}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {formatFileSize(fileSizeBytes)} · Saved to Downloads
            </p>
          </div>
          <Check className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2.5} aria-hidden />
        </div>

        <p className="mb-4 flex gap-2 text-xs leading-relaxed text-zinc-500">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" strokeWidth={2} aria-hidden />
          <span>
            Editing used a secure session on our servers; the copy you downloaded stays on your device.
          </span>
        </p>

        <div className="my-4 border-t border-zinc-700/80" />
        <Link
          to="/feedback?from=download"
          onClick={onClose}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-zinc-600/80 bg-zinc-800/60 px-3 py-2.5 text-sm font-medium text-cyan-300 transition hover:border-cyan-500/40 hover:bg-zinc-800"
        >
          <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Share quick feedback
        </Link>

        {supportUrl ? (
          <>
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onSupportClick}
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-950/30 px-3 py-3 transition hover:border-amber-500/45 hover:bg-amber-950/45"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-200">Support {BRAND_NAME}</p>
                  <p className="mt-0.5 text-xs leading-snug text-amber-100/75">
                    Help keep this free — if we saved you a few minutes, a small tip is welcome (optional).
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-zinc-400">Say thanks →</span>
            </a>
          </>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100"
        >
          Done
        </button>
      </div>
    </div>
  )
}

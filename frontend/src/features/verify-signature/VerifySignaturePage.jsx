import { useState } from 'react'
import { apiUrl, isApiBaseConfigured } from '../../lib/apiBase'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  markFunnelUpload,
  trackErrorOccurred,
  trackFileUploaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { MSG } from '../../shared/constants/branding.js'

const VERIFY_TOOL = ANALYTICS_TOOL.verify_signature

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString()
}

export default function VerifySignaturePage() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useToolEngagement(VERIFY_TOOL, true)

  const verify = async () => {
    if (!file) {
      setError('Choose a PDF first.')
      return
    }
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setError('Verifying needs the online document service, which is not available from this build.')
      return
    }

    setBusy(true)
    setError(null)
    setResult(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(apiUrl('/verify-signature'), {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })

      const j = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = j?.error || res.statusText || 'Request failed'
        trackErrorOccurred(VERIFY_TOOL, msg || `http_${res.status}`)
        setError(msg)
        return
      }

      setResult(j)
      trackToolCompleted(VERIFY_TOOL, true)
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
      trackProcessingTime(VERIFY_TOOL, elapsed)
    } catch (e) {
      console.error('[verify-signature]', e)
      trackErrorOccurred(VERIFY_TOOL, e?.message === 'Failed to fetch' ? 'fetch_failed' : e?.message || 'verify_failed')
      setError(
        e?.message === 'Failed to fetch'
          ? 'Could not reach the server. Check your connection and try again.'
          : e?.message || 'Could not verify the PDF'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="Verify Signature"
      subtitle="Check a digitally signed PDF — confirms it was not modified since signing and shows who signed it."
    >
      <FileDropzone
        accept="application/pdf"
        disabled={busy}
        onFiles={(f) => {
          const next = f[0]
          if (next) {
            markFunnelUpload(VERIFY_TOOL)
            trackFileUploaded({ file_type: 'pdf', file_size: next.size / 1024, tool: VERIFY_TOOL })
          }
          setFile(next)
          setResult(null)
          setError(null)
        }}
        label={file ? file.name : 'Drop PDF here'}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      {result && !result.signed && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          This PDF is not digitally signed.
        </div>
      )}

      {result?.signed && (
        <div className="mb-4 space-y-4">
          <div
            role="status"
            className={
              result.integrity
                ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
                : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100'
            }
          >
            {result.integrity
              ? '✔ Digitally signed — not modified since signing'
              : '✘ The document was modified after it was signed'}
          </div>

          {result.signatures.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50"
            >
              <div className="font-medium text-zinc-900 dark:text-zinc-50">{s.signer}</div>
              {s.issuedBy && (
                <div className="mt-0.5 text-zinc-600 dark:text-zinc-400">Issued by {s.issuedBy}</div>
              )}
              {(formatDate(s.validFrom) || formatDate(s.validTo)) && (
                <div className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                  Certificate valid {formatDate(s.validFrom)} – {formatDate(s.validTo)}
                </div>
              )}
              {s.reason && <div className="mt-0.5 text-zinc-600 dark:text-zinc-400">Reason: {s.reason}</div>}
              {s.location && <div className="mt-0.5 text-zinc-600 dark:text-zinc-400">Location: {s.location}</div>}
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {s.expired ? 'Certificate expired. ' : ''}
                {s.authenticity ? 'Certificate chain is consistent.' : 'Certificate chain could not be validated.'}
              </div>
            </div>
          ))}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Trust is checked against the signature&apos;s own certificate chain, not an external
            authority list.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={verify}
        className="mt-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? MSG.processingFile : 'Verify signature'}
      </button>

      <ToolFeatureSeoSection toolId="verify-signature" />
    </ToolPageShell>
  )
}

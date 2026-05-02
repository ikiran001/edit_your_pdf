import { useCallback, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { trackErrorOccurred, trackFileDownloaded, trackToolCompleted } from '../../lib/analytics.js'
import { postDocumentFlowFile } from '../../lib/documentFlowClient.js'
import { getResolvedApiBase } from '../../lib/apiBase.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   accept: string,
 *   dropHint: string,
 *   endpoint: string,
 *   outputName: (file: File) => string,
 *   analyticsTool: string,
 *   validateFile?: (file: File) => string | null,
 * }} props
 */
export default function DocumentFlowConvertPage({
  title,
  subtitle,
  accept,
  dropHint,
  endpoint,
  outputName,
  analyticsTool,
  validateFile,
}) {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const prodApiMissing = import.meta.env.PROD && !getResolvedApiBase()

  useToolEngagement(analyticsTool, true)

  const onFiles = useCallback(
    async (files) => {
      const file = files?.[0]
      if (!file) return
      if (validateFile) {
        const v = validateFile(file)
        if (v) {
          setError(v)
          return
        }
      }
      setError(null)
      setBusy(true)
      try {
        await runWithSignInForDownload(
          async () => {
            const blob = await postDocumentFlowFile(endpoint, file)
            if (!(blob instanceof Blob)) throw new Error('Unexpected response')
            downloadBlob(blob, outputName(file))
            trackToolCompleted(analyticsTool, true)
            trackFileDownloaded({
              tool: analyticsTool,
              file_size: blob.size / 1024,
              total_pages: 1,
            })
          },
          { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
        )
      } catch (e) {
        if (e?.code === 'EYP_AUTH_CANCELLED') {
          /* dismissed */
        } else if (e?.code === 'EYP_AUTH_LOADING') {
          setError(e.message || 'Still checking sign-in.')
        } else {
          console.error(e)
          trackErrorOccurred(analyticsTool, e?.message || 'convert_failed')
          setError(e?.message || 'Conversion failed. Is the API running with SOFFICE_PATH set?')
        }
      } finally {
        setBusy(false)
      }
    },
    [analyticsTool, endpoint, outputName, runWithSignInForDownload, validateFile]
  )

  return (
    <ToolPageShell title={title} subtitle={subtitle}>
      {prodApiMissing && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Production builds need <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">VITE_API_BASE_URL</code> (or
          runtime API config) so conversions reach your backend with LibreOffice.
        </div>
      )}
      <FileDropzone
        accept={accept}
        disabled={busy}
        onFiles={onFiles}
        label={busy ? 'Converting…' : dropHint}
      />
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}
      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        Needs LibreOffice <code className="text-[11px]">soffice</code> on the API (standard install paths and PATH are
        tried; override with <code className="text-[11px]">SOFFICE_PATH</code> if needed). Run OCR on scanned PDFs before
        office export when text is missing.
      </p>
    </ToolPageShell>
  )
}

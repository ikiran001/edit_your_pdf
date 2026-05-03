import { useCallback, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { trackErrorOccurred, trackFileDownloaded, trackToolCompleted } from '../../lib/analytics.js'
import { postDocumentFlowFile } from '../../lib/documentFlowClient.js'
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
          setError(e?.message || 'Conversion failed. Try again in a moment.')
        }
      } finally {
        setBusy(false)
      }
    },
    [analyticsTool, endpoint, outputName, runWithSignInForDownload, validateFile]
  )

  return (
    <ToolPageShell title={title} subtitle={subtitle}>
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
        Conversions run on our servers. Run OCR on scanned PDFs first if text is missing.
      </p>
    </ToolPageShell>
  )
}

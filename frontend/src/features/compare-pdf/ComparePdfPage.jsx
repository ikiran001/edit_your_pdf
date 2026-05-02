import { useCallback, useMemo, useState } from 'react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import { trackErrorOccurred, trackToolCompleted } from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { extractPdfPlainText, CLIENT_PDF_MAX_BYTES } from '../pdf-to-word/extractPdfText.js'

const TOOL = ANALYTICS_TOOL.compare_pdf

const MAX_DIFF_LINES = 400

function lineDiffLines(a, b) {
  const la = String(a || '').split(/\r?\n/)
  const lb = String(b || '').split(/\r?\n/)
  const max = Math.max(la.length, lb.length)
  const out = []
  for (let i = 0; i < max && out.length < MAX_DIFF_LINES; i++) {
    const left = la[i] ?? ''
    const right = lb[i] ?? ''
    if (left !== right) out.push({ n: i + 1, left, right })
  }
  return { diffLines: out, totalLinesCompared: max }
}

export default function ComparePdfPage() {
  const [aFile, setAFile] = useState(null)
  const [bFile, setBFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [meta, setMeta] = useState(/** @type {{ pagesA: number, pagesB: number } | null} */ null)

  useToolEngagement(TOOL, true)

  const comparison = useMemo(() => {
    if (!textA && !textB) return null
    return lineDiffLines(textA, textB)
  }, [textA, textB])

  const onPickA = useCallback((files) => {
    const f = files[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      setError('File A must be a PDF.')
      return
    }
    if (f.size > CLIENT_PDF_MAX_BYTES) {
      setError(`Each PDF must be under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB.`)
      return
    }
    setError(null)
    setAFile(f)
    setTextA('')
    setMeta(null)
  }, [])

  const onPickB = useCallback((files) => {
    const f = files[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      setError('File B must be a PDF.')
      return
    }
    if (f.size > CLIENT_PDF_MAX_BYTES) {
      setError(`Each PDF must be under ${Math.round(CLIENT_PDF_MAX_BYTES / (1024 * 1024))} MB.`)
      return
    }
    setError(null)
    setBFile(f)
    setTextB('')
    setMeta(null)
  }, [])

  const runCompare = async () => {
    if (!aFile || !bFile) {
      setError('Choose both PDF A and PDF B.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const [ra, rb] = await Promise.all([
        extractPdfPlainText(await aFile.arrayBuffer()),
        extractPdfPlainText(await bFile.arrayBuffer()),
      ])
      setTextA(ra.text || '')
      setTextB(rb.text || '')
      setMeta({ pagesA: ra.numPages, pagesB: rb.numPages })
      trackToolCompleted(TOOL, true)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'compare_failed')
      setError(e?.message || 'Could not extract text from one or both PDFs.')
    } finally {
      setBusy(false)
    }
  }

  const identical = comparison && comparison.diffLines.length === 0 && textA === textB

  return (
    <ToolPageShell
      title="Compare PDF"
      subtitle="Line-by-line comparison of selectable text (scanned pages need OCR first)."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">PDF A</p>
          <FileDropzone
            accept="application/pdf"
            disabled={busy}
            onFiles={onPickA}
            label={aFile ? aFile.name : 'Drop first PDF'}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">PDF B</p>
          <FileDropzone
            accept="application/pdf"
            disabled={busy}
            onFiles={onPickB}
            label={bFile ? bFile.name : 'Drop second PDF'}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          disabled={busy || !aFile || !bFile}
          onClick={runCompare}
          className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Extracting text…' : 'Compare text'}
        </button>
      </div>

      {meta && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Extracted text layers — A: {meta.pagesA} page{meta.pagesA === 1 ? '' : 's'}, B: {meta.pagesB}{' '}
          page{meta.pagesB === 1 ? '' : 's'}.
        </p>
      )}

      {comparison && !busy && (
        <div className="mt-8 space-y-4">
          {identical ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              Extracted text matches line-for-line (within the text layer). Visual or metadata differences are not compared here.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Showing up to {MAX_DIFF_LINES} differing lines (by line number after joining all pages).{' '}
                {comparison.diffLines.length} differing line{comparison.diffLines.length === 1 ? '' : 's'} found.
              </p>
              <div className="max-h-[min(60vh,28rem)] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900/50">
                {comparison.diffLines.length === 0 ? (
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Same line count and content when split by newlines, but overall strings differ (e.g. whitespace). Check raw
                    text export.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-300 dark:border-zinc-600">
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">A</th>
                        <th className="py-1">B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.diffLines.map((row) => (
                        <tr key={row.n} className="border-b border-zinc-200/80 align-top dark:border-zinc-700/80">
                          <td className="py-1 pr-2 text-zinc-500">{row.n}</td>
                          <td className="py-1 pr-2 text-rose-800 dark:text-rose-200">{row.left || '∅'}</td>
                          <td className="py-1 text-emerald-800 dark:text-emerald-200">{row.right || '∅'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </ToolPageShell>
  )
}

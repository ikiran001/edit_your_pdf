import { useCallback, useState } from 'react'
import { trackUploadCtaClick } from '../lib/analytics.js'
import { BRAND_NAME, MSG } from '../shared/constants/branding.js'

export default function LandingPage({
  onFileSelected,
  loading,
  uploadProgress = 0,
  /** When true, omit page header/background (used inside ToolPageShell). */
  embeddedInToolShell = false,
  /** GA4: e.g. `edit_pdf` — enables `upload_cta_click` on the Upload PDF button. */
  analyticsTool = null,
}) {
  const [dragOver, setDragOver] = useState(false)

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files?.[0]
      if (f && f.type === 'application/pdf') onFileSelected(f)
    },
    [onFileSelected]
  )

  const inner = (
    <>
      {!embeddedInToolShell ? (
        <header className="fx-glass-header px-6 py-4">
          <h1 className="bg-gradient-to-r from-zinc-900 to-indigo-700 bg-clip-text text-xl font-semibold tracking-tight text-transparent dark:from-white dark:to-cyan-200/90">
            {BRAND_NAME}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload a PDF, use <strong>Edit text</strong> to change existing wording (like Word) or other tools to
            annotate, then save or download. No install or account — edit in your browser and download when you&apos;re
            done.
          </p>
        </header>
      ) : (
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Upload a PDF to open the editor. Use <strong>Edit text</strong>, draw, highlight, then save or download.
        </p>
      )}

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div
          role="button"
          tabIndex={0}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              document.getElementById('pdf-file-input')?.click()
            }
          }}
          className={`flex w-full max-w-xl cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition ${
            dragOver
              ? 'border-cyan-500 bg-indigo-50/90 shadow-lg shadow-indigo-500/20 dark:border-cyan-400 dark:bg-indigo-950/50 dark:shadow-[0_0_40px_rgba(34,211,238,0.15)]'
              : 'border-indigo-200/80 bg-white/85 shadow-sm shadow-indigo-500/5 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/10 dark:border-indigo-500/30 dark:bg-zinc-950/60 dark:hover:border-cyan-500/40 dark:hover:shadow-[0_0_32px_rgba(99,102,241,0.12)]'
          }`}
          onClick={() => document.getElementById('pdf-file-input')?.click()}
        >
          <input
            id="pdf-file-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFileSelected(f)
              e.target.value = ''
            }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{MSG.uploading}</p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
                Drop your PDF here
              </p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">or click to browse</p>
              <button
                type="button"
                className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/35 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/45 dark:shadow-[0_0_28px_rgba(99,102,241,0.35)]"
                onClick={(e) => {
                  e.stopPropagation()
                  if (analyticsTool) trackUploadCtaClick(analyticsTool)
                  document.getElementById('pdf-file-input')?.click()
                }}
              >
                Upload PDF
              </button>
            </>
          )}
        </div>
      </main>
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a0a14]/35 p-4 backdrop-blur-[2px] dark:bg-[#120510]/50">
          <div className="w-full max-w-2xl rounded-3xl bg-white px-10 py-9 text-center shadow-2xl dark:bg-zinc-900">
            <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg
                viewBox="0 0 24 24"
                className="h-14 w-14 text-indigo-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 11v6" />
                <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
              </svg>
            </div>
            <p className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Your file is uploading{' '}
              <span className="text-indigo-600">{Math.max(1, uploadProgress)}%</span>
            </p>
            <div className="mt-7 h-4 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-150 ease-out"
                style={{ width: `${Math.max(1, uploadProgress)}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  if (embeddedInToolShell) {
    return <div className="flex flex-col">{inner}</div>
  }

  return (
    <div className="flex min-h-svh flex-col bg-transparent text-zinc-900 dark:text-zinc-100">
      {inner}
    </div>
  )
}

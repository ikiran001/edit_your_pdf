import { useCallback, useState } from 'react'
import { isApiBaseConfigured } from '../lib/apiBase'

export default function LandingPage({ onFileSelected, loading }) {
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

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white/70 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <h1 className="text-xl font-semibold tracking-tight">Edit Your PDF</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {import.meta.env.PROD && !isApiBaseConfigured() ? (
            <>
              This copy is hosted on <strong>GitHub Pages</strong> (static files only). Uploads need a
              deployed API — set the <code className="text-xs">VITE_API_BASE_URL</code> secret and
              redeploy (see README).
            </>
          ) : (
            <>
              Upload a PDF, use <strong>Edit text</strong> to change existing wording (like Word) or
              other tools to annotate, then save or download. Locally, keep the API on port 3001.
            </>
          )}
        </p>
      </header>

      {import.meta.env.PROD && !isApiBaseConfigured() && (
        <div
          role="alert"
          className="mx-4 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p className="m-0 font-medium">Backend URL missing</p>
          <ol className="mt-2 mb-0 list-decimal space-y-1 pl-5">
            <li>Deploy <code className="text-xs">backend/</code> (e.g. free tier on Render.com).</li>
            <li>
              GitHub → <strong>Settings → Secrets and variables → Actions</strong> → create{' '}
              <code className="text-xs">VITE_API_BASE_URL</code> = your API&apos;s{' '}
              <code className="text-xs">https://…</code> URL.
            </li>
            <li>
              <strong>Actions</strong> → run <strong>Deploy frontend to GitHub Pages</strong> again.
            </li>
          </ol>
        </div>
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
              ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40'
              : 'border-zinc-300 bg-white/80 hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-900/50'
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
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Uploading and loading PDF…
              </p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
                Drop your PDF here
              </p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">or click to browse</p>
              <button
                type="button"
                className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
                onClick={(e) => {
                  e.stopPropagation()
                  document.getElementById('pdf-file-input')?.click()
                }}
              >
                Upload PDF
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

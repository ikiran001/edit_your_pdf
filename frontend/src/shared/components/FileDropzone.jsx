import { useCallback, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'

export default function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  /** When true, shows a working state (spinner, stronger border) without the “greyed out” disabled look. */
  busy = false,
  onFiles,
  label = 'Drop files here or click to browse',
  className = '',
  /** Shown under the label instead of the raw `accept` string (friendlier for users). */
  hint,
  /** Hide the automatic second line that echoes MIME `accept` (often noisy). */
  hideAcceptTypes = false,
}) {
  const [dragOver, setDragOver] = useState(false)
  const blocked = disabled || busy

  const handleFiles = useCallback(
    (list) => {
      if (!list?.length || blocked) return
      onFiles(multiple ? [...list] : [list[0]])
    },
    [blocked, multiple, onFiles]
  )

  const showAcceptEcho = Boolean(accept) && !hideAcceptTypes && !hint

  return (
    <label
      aria-busy={busy}
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
        busy
          ? 'cursor-wait border-indigo-400 bg-indigo-50/90 ring-2 ring-indigo-500/15 dark:border-indigo-500/60 dark:bg-indigo-950/45 dark:ring-indigo-400/10'
          : dragOver
            ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40'
            : 'border-zinc-300 bg-white/60 hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-900/40'
      } ${disabled && !busy ? 'pointer-events-none opacity-50' : ''} ${blocked ? 'pointer-events-none' : ''} ${className}`}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={blocked}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {busy ? (
        <Loader2
          className="mb-3 h-10 w-10 shrink-0 text-indigo-600 motion-safe:animate-spin dark:text-cyan-400"
          strokeWidth={1.75}
          aria-hidden
        />
      ) : (
        <Upload className="mb-3 h-10 w-10 shrink-0 text-indigo-500" strokeWidth={1.5} aria-hidden />
      )}
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      {hint ? (
        <span className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</span>
      ) : null}
      {showAcceptEcho ? (
        <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{accept}</span>
      ) : null}
    </label>
  )
}

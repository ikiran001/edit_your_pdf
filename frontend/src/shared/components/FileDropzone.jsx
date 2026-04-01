import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'

export default function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  label = 'Drop files here or click to browse',
  className = '',
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(
    (list) => {
      if (!list?.length || disabled) return
      onFiles(multiple ? [...list] : [list[0]])
    },
    [disabled, multiple, onFiles]
  )

  return (
    <label
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
        dragOver
          ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40'
          : 'border-zinc-300 bg-white/60 hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-900/40'
      } ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`}
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
        disabled={disabled}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Upload className="mb-3 h-10 w-10 text-indigo-500" strokeWidth={1.5} aria-hidden />
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      {accept && (
        <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{accept}</span>
      )}
    </label>
  )
}

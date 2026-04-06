import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
} from '../lib/textFormatDefaults'

const INSERT_SYMBOLS = [
  { label: '₹', ch: '₹', title: 'Indian rupee' },
  { label: '$', ch: '$', title: 'Dollar' },
  { label: '€', ch: '€', title: 'Euro' },
  { label: '©', ch: '©', title: 'Copyright' },
  { label: '™', ch: '™', title: 'Trademark' },
  { label: '®', ch: '®', title: 'Registered' },
  { label: '✓', ch: '✓', title: 'Check mark' },
  { label: '→', ch: '→', title: 'Arrow right' },
  { label: '←', ch: '←', title: 'Arrow left' },
  { label: '±', ch: '±', title: 'Plus-minus' },
  { label: '×', ch: '×', title: 'Multiply' },
  { label: '÷', ch: '÷', title: 'Divide' },
]

function dispatchInsertSymbol(ch) {
  document.dispatchEvent(new CustomEvent('pdfpilot-native-insert', { detail: { text: ch } }))
}

function ToggleBtn({ active, children, onClick, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`min-w-[2rem] rounded-md border px-2 py-1.5 text-sm font-semibold transition ${
        active
          ? 'border-[#b03060] bg-gradient-to-br from-[#c1336e] to-[#9d2958] text-white shadow-sm shadow-[#c1336e]/30'
          : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Right-side panel for native PDF text styling (iLovePDF-style controls).
 */
export default function TextFormatToolbar({ format, onChange, disabled }) {
  const patch = (partial) => onChange({ ...format, ...partial })

  return (
    <aside
      data-text-format-panel
      className="flex w-[min(100%,18rem)] shrink-0 flex-col border-l border-indigo-200/60 bg-white/95 dark:border-indigo-500/15 dark:bg-zinc-950/95"
      aria-label="Text formatting"
    >
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Text format</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Click a highlighted line on the page. Use <kbd className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-700">Enter</kbd> for new lines;{' '}
          <kbd className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-700">Ctrl+Enter</kbd> or click outside to apply.
        </p>
      </div>
      <div
        className={`flex flex-col gap-3 overflow-y-auto p-3 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Font</span>
          <select
            value={format.fontFamily}
            onChange={(e) => patch({ fontFamily: e.target.value })}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Size</span>
          <select
            value={format.fontSizeCss}
            onChange={(e) => patch({ fontSizeCss: Number(e.target.value) })}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {FONT_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}px
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Insert symbol</span>
          <div className="flex flex-wrap gap-1">
            {INSERT_SYMBOLS.map((s) => (
              <button
                key={s.ch + s.label}
                type="button"
                title={s.title}
                onClick={() => dispatchInsertSymbol(s.ch)}
                className="min-h-[2rem] min-w-[2rem] rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Style</span>
          <div className="flex flex-wrap gap-1">
            <ToggleBtn
              title="Bold"
              active={format.bold}
              onClick={() => patch({ bold: !format.bold })}
            >
              B
            </ToggleBtn>
            <ToggleBtn
              title="Italic"
              active={format.italic}
              onClick={() => patch({ italic: !format.italic })}
            >
              I
            </ToggleBtn>
            <ToggleBtn
              title="Underline"
              active={format.underline}
              onClick={() => patch({ underline: !format.underline })}
            >
              U
            </ToggleBtn>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Align</span>
          <div className="flex gap-1">
            {TEXT_ALIGN_OPTIONS.map((a) => (
              <button
                key={a.value}
                type="button"
                title={a.label}
                onClick={() => patch({ align: a.value })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  format.align === a.value
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {a.value === 'left' ? 'Left' : a.value === 'center' ? 'Center' : 'Right'}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={format.color?.match(/^#/) ? format.color.slice(0, 7) : '#000000'}
              onChange={(e) => patch({ color: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-zinc-300 bg-white p-0.5 dark:border-zinc-600"
            />
            <input
              type="text"
              value={format.color || '#000000'}
              onChange={(e) => patch({ color: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="#000000"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Opacity {(format.opacity ?? 1).toFixed(2)}
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={format.opacity ?? 1}
            onChange={(e) => patch({ opacity: Number(e.target.value) })}
            className="w-full"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Rotation {format.rotationDeg ?? 0}°
          </span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={format.rotationDeg ?? 0}
            onChange={(e) => patch({ rotationDeg: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      </div>
    </aside>
  )
}

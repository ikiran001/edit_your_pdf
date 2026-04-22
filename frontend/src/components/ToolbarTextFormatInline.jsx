import { useState } from 'react'
import { FONT_OPTIONS, FONT_SIZE_OPTIONS } from '../lib/textFormatDefaults'

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function StyleToggle({ active, children, onClick, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`fx-focus-ring min-h-10 min-w-10 rounded-lg border px-2.5 text-sm font-bold transition sm:min-h-9 sm:px-3 ${
        active
          ? 'border-indigo-500 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/60 dark:ring-indigo-300/40'
          : 'border-zinc-400 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Text format controls embedded in the main editor toolbar (`data-text-format-panel` for blur/focus).
 */
export default function ToolbarTextFormatInline({ format, onChange, disabled, overlayActions = null }) {
  const patch = (partial) => onChange({ ...format, ...partial })
  const [colorInputRaw, setColorInputRaw] = useState(null)
  const displayColor = colorInputRaw ?? (format.color || '#000000')
  const colorValid = HEX_RE.test(displayColor)
  const selClass =
    'min-h-10 rounded-lg border border-zinc-400 bg-white px-2.5 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 sm:min-h-9'

  return (
    <div
      data-text-format-panel
      className={`flex flex-wrap items-center gap-x-2 gap-y-2 transition-opacity duration-200 sm:gap-x-3 ${
        disabled
          ? 'pointer-events-none cursor-not-allowed select-none opacity-45 saturate-[0.65] dark:opacity-40'
          : ''
      }`}
      aria-label="Text formatting"
      aria-disabled={disabled || undefined}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200 sm:text-xs">
        Text format
      </span>
      {overlayActions && (
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => overlayActions.done?.()}
            className="fx-focus-ring rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => overlayActions.reset?.()}
            className="fx-focus-ring rounded-lg border border-zinc-400 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Reset
          </button>
        </div>
      )}
      <span className="hidden h-7 w-px shrink-0 bg-zinc-300 sm:inline dark:bg-zinc-600" aria-hidden />
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Font</span>
        <select
          value={format.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          className={`${selClass} max-w-[11rem] sm:max-w-[13rem]`}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Size</span>
        <select
          value={format.fontSizeCss}
          onChange={(e) => patch({ fontSizeCss: Number(e.target.value) })}
          className={selClass}
        >
          {FONT_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}px
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Style</span>
        <div className="flex gap-1">
          <StyleToggle title="Bold" active={format.bold} onClick={() => patch({ bold: !format.bold })}>
            B
          </StyleToggle>
          <StyleToggle title="Italic" active={format.italic} onClick={() => patch({ italic: !format.italic })}>
            I
          </StyleToggle>
          <StyleToggle
            title="Underline"
            active={format.underline}
            onClick={() => patch({ underline: !format.underline })}
          >
            U
          </StyleToggle>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Color</span>
        <input
          type="color"
          value={format.color?.match(/^#[0-9a-fA-F]{6}$/) ? format.color : '#000000'}
          onChange={(e) => {
            setColorInputRaw(null)
            patch({ color: e.target.value })
          }}
          className="h-10 w-12 cursor-pointer rounded-lg border-2 border-zinc-400 bg-white p-1 dark:border-zinc-500"
        />
        <input
          type="text"
          value={displayColor}
          onChange={(e) => {
            const v = e.target.value
            setColorInputRaw(v)
            if (HEX_RE.test(v)) {
              setColorInputRaw(null)
              patch({ color: v })
            }
          }}
          onBlur={() => {
            if (!colorValid) setColorInputRaw(null)
          }}
          className={`min-h-10 w-[6.5rem] rounded-lg border-2 px-2 py-2 font-mono text-sm dark:bg-zinc-800 dark:text-zinc-100 sm:w-28 ${
            colorInputRaw && !colorValid
              ? 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/30'
              : 'border-zinc-400 bg-white dark:border-zinc-500'
          }`}
          placeholder="#000000"
          maxLength={7}
        />
      </div>
      <p className="basis-full text-[11px] leading-snug text-zinc-600 dark:text-zinc-300">
        {disabled ? (
          <>
            Tap a line on the page (or use Add Text) — these controls turn on while you are editing so you
            can set colour, font, and size.
          </>
        ) : (
          <>
            Pick any text colour you like — use the swatch or hex box so wording stays clear on your page
            background.
          </>
        )}
      </p>
    </div>
  )
}

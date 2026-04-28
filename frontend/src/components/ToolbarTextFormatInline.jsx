import { useState } from 'react'
import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
} from '../lib/textFormatDefaults'

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Index of the preset in `FONT_SIZE_OPTIONS` closest to the current CSS px value. */
function fontSizePresetIndex(cssPx) {
  const n = Number(cssPx)
  const v = Number.isFinite(n) ? n : 14
  let best = 0
  for (let i = 0; i < FONT_SIZE_OPTIONS.length; i++) {
    if (Math.abs(FONT_SIZE_OPTIONS[i] - v) < Math.abs(FONT_SIZE_OPTIONS[best] - v)) best = i
  }
  return best
}

const sizeStepBtnClass =
  'fx-focus-ring flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border px-2 text-lg font-semibold leading-none transition sm:h-9'

function StyleToggle({ active, children, onClick, title, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`fx-focus-ring min-h-10 min-w-10 rounded-lg border px-2.5 text-sm font-bold transition sm:min-h-9 sm:px-3 ${
        disabled
          ? active
            ? 'cursor-not-allowed border-indigo-300 bg-indigo-100 text-indigo-900 opacity-90 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-indigo-200'
            : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-70 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'
          : active
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
 * When `disabled`, the same controls stay visible but are non-interactive (defaults preview).
 */
export default function ToolbarTextFormatInline({ format, onChange, disabled, overlayActions = null }) {
  const patch = (partial) => {
    if (disabled) return
    onChange({ ...format, ...partial })
  }
  const [colorInputRaw, setColorInputRaw] = useState(null)
  const displayColor = colorInputRaw ?? (format.color || '#000000')
  const colorValid = HEX_RE.test(displayColor)
  const selClass =
    'min-h-10 rounded-lg border border-zinc-400 bg-white px-2.5 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 sm:min-h-9'
  const selDisabledClass = disabled
    ? 'cursor-not-allowed opacity-60 border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-500'
    : ''

  const curSizePx = Number(format.fontSizeCss)
  const sizeIsPreset =
    Number.isFinite(curSizePx) && FONT_SIZE_OPTIONS.some((n) => n === curSizePx)
  const sizeIdx = fontSizePresetIndex(format.fontSizeCss)
  const canDecreaseSize = sizeIdx > 0
  const canIncreaseSize = sizeIdx < FONT_SIZE_OPTIONS.length - 1
  const sizeStepDisabledClass =
    'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-70 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'
  const sizeStepEnabledClass =
    'border-zinc-400 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'

  return (
    <div
      data-text-format-panel
      className="flex flex-wrap items-center gap-x-2 gap-y-2 transition-opacity duration-200 sm:gap-x-3"
      aria-label="Text formatting"
      aria-disabled={disabled ? 'true' : 'false'}
      aria-describedby={disabled ? 'pdf-toolbar-textformat-disabled-hint' : undefined}
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
          disabled={disabled}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          className={`${selClass} max-w-[11rem] sm:max-w-[13rem] ${selDisabledClass}`}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Size</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Decrease font size"
            title="Smaller"
            disabled={disabled || !canDecreaseSize}
            onClick={() => patch({ fontSizeCss: FONT_SIZE_OPTIONS[sizeIdx - 1] })}
            className={`${sizeStepBtnClass} ${
              disabled || !canDecreaseSize ? sizeStepDisabledClass : sizeStepEnabledClass
            }`}
          >
            −
          </button>
          <select
            value={Number.isFinite(curSizePx) ? curSizePx : FONT_SIZE_OPTIONS[0]}
            disabled={disabled}
            onChange={(e) => patch({ fontSizeCss: Number(e.target.value) })}
            className={`${selClass} ${selDisabledClass}`}
          >
            {!sizeIsPreset && Number.isFinite(curSizePx) ? (
              <option value={curSizePx}>{Math.round(curSizePx)}px</option>
            ) : null}
            {FONT_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}px
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Increase font size"
            title="Larger"
            disabled={disabled || !canIncreaseSize}
            onClick={() => patch({ fontSizeCss: FONT_SIZE_OPTIONS[sizeIdx + 1] })}
            className={`${sizeStepBtnClass} ${
              disabled || !canIncreaseSize ? sizeStepDisabledClass : sizeStepEnabledClass
            }`}
          >
            +
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Style</span>
        <div className="flex gap-1">
          <StyleToggle
            title="Bold"
            active={format.bold}
            disabled={disabled}
            onClick={() => patch({ bold: !format.bold })}
          >
            B
          </StyleToggle>
          <StyleToggle
            title="Italic"
            active={format.italic}
            disabled={disabled}
            onClick={() => patch({ italic: !format.italic })}
          >
            I
          </StyleToggle>
          <StyleToggle
            title="Underline"
            active={format.underline}
            disabled={disabled}
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
          disabled={disabled}
          value={format.color?.match(/^#[0-9a-fA-F]{6}$/) ? format.color : '#000000'}
          onChange={(e) => {
            setColorInputRaw(null)
            patch({ color: e.target.value })
          }}
          className={`h-10 w-12 rounded-lg border-2 border-zinc-400 bg-white p-1 dark:border-zinc-500 ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
        />
        <input
          type="text"
          readOnly={disabled}
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
          } ${disabled ? 'cursor-default opacity-60' : ''}`}
          placeholder="#000000"
          maxLength={7}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Align</span>
        <div className="flex gap-1" role="group" aria-label="Text alignment">
          {TEXT_ALIGN_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              title={o.label}
              disabled={disabled}
              aria-pressed={format.align === o.value}
              onClick={() => patch({ align: o.value })}
              className={`fx-focus-ring min-h-10 min-w-10 rounded-lg border px-2.5 text-xs font-bold transition sm:min-h-9 sm:px-3 ${
                disabled
                  ? format.align === o.value
                    ? 'cursor-not-allowed border-indigo-300 bg-indigo-100 text-indigo-900 opacity-90 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-70 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'
                  : format.align === o.value
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/60 dark:ring-indigo-300/40'
                    : 'border-zinc-400 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              {o.value === 'left' ? 'L' : o.value === 'center' ? 'C' : 'R'}
            </button>
          ))}
        </div>
      </div>
      <p
        id="pdf-toolbar-textformat-disabled-hint"
        className="basis-full text-[11px] leading-snug text-zinc-600 dark:text-zinc-300"
      >
        {disabled
          ? 'Choose Edit text, Add Text, or tap a line — then these controls apply.'
          : 'Pick colour with the swatch or hex box. Alignment applies to added text boxes and native line edits.'}
      </p>
    </div>
  )
}

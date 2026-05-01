import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib'

/**
 * @typedef {{ name: string, kind: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown', options?: string[] }} FormFieldDesc
 */

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<FormFieldDesc[]>}
 */
export async function listAcroFormFields(bytes) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  const fields = form.getFields()
  /** @type {FormFieldDesc[]} */
  const out = []
  for (const f of fields) {
    const name = f.getName()
    try {
      if (f instanceof PDFTextField) {
        out.push({ name, kind: 'text' })
        continue
      }
      if (f instanceof PDFCheckBox) {
        out.push({ name, kind: 'checkbox' })
        continue
      }
      if (f instanceof PDFDropdown) {
        const options = typeof f.getOptions === 'function' ? f.getOptions() : []
        out.push({ name, kind: 'dropdown', options })
        continue
      }
      if (f instanceof PDFRadioGroup) {
        const options = typeof f.getOptions === 'function' ? f.getOptions() : []
        out.push({ name, kind: 'radio', options })
        continue
      }
    } catch {
      /* fall through */
    }
    out.push({ name, kind: 'unknown' })
  }
  return out
}

/**
 * @param {Uint8Array} bytes
 * @param {Record<string, string | boolean>} values — field name → text or checkbox checked
 * @returns {Promise<Uint8Array>}
 */
export async function applyAcroFormValues(bytes, values) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  const fields = form.getFields()

  for (const f of fields) {
    const name = f.getName()
    if (!(name in values)) continue
    const val = values[name]

    try {
      if (f instanceof PDFTextField) {
        f.setText(String(val ?? ''))
        continue
      }
      if (f instanceof PDFCheckBox) {
        if (val === true || val === 'true' || val === '1' || val === 'yes') f.check()
        else f.uncheck()
        continue
      }
      if (f instanceof PDFDropdown || f instanceof PDFRadioGroup) {
        const s = String(val ?? '')
        if (s) f.select(s)
        continue
      }
    } catch {
      /* skip unsupported field updates */
    }
  }

  return pdfDoc.save({ useObjectStreams: true })
}

/** Indian GST state / UT codes (2-digit) for dropdowns. */
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
]

export const GST_TEMPLATE_STORAGE_KEY = 'pdfpilot_gst_invoice_template_v1'

export function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function emptyItem() {
  return {
    id: newId(),
    description: '',
    hsn: '',
    qty: 1,
    rate: 0,
    gstPercent: 18,
  }
}

/** PAN segment embedded in GSTIN (characters 3–12). */
export function panFromGstin(gstin) {
  const g = String(gstin || '')
    .replace(/\s/g, '')
    .toUpperCase()
  if (g.length < 12) return ''
  return g.slice(2, 12)
}

function linesAddress(parts) {
  return parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Merge granular address / naming fields into the flat shape expected by {@link buildGstInvoicePdfBytes}.
 * @param {object} form
 */
export function normalizeFormForPdf(form) {
  const sellerAddress =
    linesAddress([
      form.sellerAddr1,
      form.sellerAddr2,
      [form.sellerCity, form.sellerStateName, form.sellerPin].filter((x) => String(x || '').trim()).join(', '),
    ]) || form.sellerAddress

  const buyerAddress =
    linesAddress([
      form.buyerAddr1,
      form.buyerAddr2,
      [form.buyerCity, form.buyerStateName, form.buyerPin].filter((x) => String(x || '').trim()).join(', '),
    ]) || form.buyerAddress

  return {
    ...form,
    sellerName: String(form.sellerLegalName || form.sellerName || '').trim() || String(form.sellerTradeName || '').trim(),
    sellerTradeName: form.sellerTradeName,
    buyerName: String(form.buyerLegalName || form.buyerName || '').trim() || String(form.buyerTradeName || '').trim(),
    buyerTradeName: form.buyerTradeName,
    sellerAddress,
    buyerAddress,
    sellerPan: form.sellerPan || panFromGstin(form.sellerGstin),
    buyerPan: form.buyerPan || panFromGstin(form.buyerGstin),
    bankName: form.bankName,
    bankAccount: form.bankAccount,
    bankIfsc: form.bankIfsc,
    bankUpi: form.bankUpi,
    invoiceType: form.invoiceType,
    notes: form.notes,
    logoDataUrl: form.logoDataUrl,
  }
}

export function emptyForm() {
  const today = new Date().toISOString().slice(0, 10)
  return {
    invoiceType: 'tax_invoice',
    sellerTradeName: '',
    sellerLegalName: '',
    sellerName: '',
    sellerGstin: '',
    sellerPan: '',
    sellerAddr1: '',
    sellerAddr2: '',
    sellerCity: '',
    sellerStateName: '',
    sellerStateCode: '',
    sellerPin: '',
    sellerPhone: '',
    sellerEmail: '',
    sellerWebsite: '',
    sellerAddress: '',
    buyerTradeName: '',
    buyerLegalName: '',
    buyerName: '',
    buyerGstin: '',
    buyerPan: '',
    buyerAddr1: '',
    buyerAddr2: '',
    buyerCity: '',
    buyerStateName: '',
    buyerStateCode: '',
    buyerPin: '',
    buyerPhone: '',
    buyerEmail: '',
    buyerAddress: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    bankUpi: '',
    invoiceNo: '',
    invoiceDate: today,
    placeOfSupply: '',
    reverseCharge: false,
    notes: '',
    logoDataUrl: null,
    items: [emptyItem()],
  }
}

export function demoForm() {
  return {
    ...emptyForm(),
    sellerTradeName: 'DemoSupplier',
    sellerLegalName: 'Demo Supplier Pvt Ltd',
    sellerName: 'Demo Supplier Pvt Ltd',
    sellerGstin: '27AAAAA0000A1Z5',
    sellerPan: panFromGstin('27AAAAA0000A1Z5'),
    sellerAddr1: 'Bandra Kurla Complex',
    sellerCity: 'Mumbai',
    sellerStateName: 'Maharashtra',
    sellerStateCode: '27',
    sellerPin: '400051',
    sellerPhone: '+91 90000 00000',
    sellerEmail: 'accounts@example.com',
    bankName: 'HDFC Bank',
    bankAccount: '50100012345678',
    bankIfsc: 'HDFC0000123',
    buyerTradeName: 'ClientCo',
    buyerLegalName: 'Client Company LLP',
    buyerName: 'Client Company LLP',
    buyerGstin: '06BBBBB1111B1Z1',
    buyerPan: panFromGstin('06BBBBB1111B1Z1'),
    buyerAddr1: 'Sector 44',
    buyerCity: 'Gurugram',
    buyerStateName: 'Haryana',
    buyerStateCode: '06',
    buyerPin: '122018',
    invoiceNo: 'INV-2026-0421',
    placeOfSupply: 'Haryana',
    items: [
      {
        id: newId(),
        description: 'Software consultancy services',
        hsn: '998314',
        qty: 1,
        rate: 10000,
        gstPercent: 18,
      },
    ],
  }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, Plus, Trash2, Upload } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import { docTitleForPath } from '../../shared/constants/branding.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  pageView,
  trackErrorOccurred,
  trackFileDownloaded,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'
import { buildGstInvoicePdfBytes, calculateGstTotals } from './gstInvoicePdf.js'
import {
  GST_TEMPLATE_STORAGE_KEY,
  INDIAN_STATES,
  demoForm,
  emptyForm,
  emptyItem,
  normalizeFormForPdf,
  panFromGstin,
} from './gstInvoiceModel.js'

const TOOL = ANALYTICS_TOOL.gst_invoice
const DOC_TITLE = docTitleForPath('/tools/gst-invoice')

const inp =
  'w-full rounded-lg border border-zinc-700/90 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 shadow-inner placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400/80'

function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

function Label({ children, required }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      {children}
      {required ? <span className="text-amber-400/90"> *</span> : null}
    </span>
  )
}

function Card({ title, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-4 shadow-sm sm:p-5 ${className}`}
    >
      {title ? (
        <h3 className="m-0 border-b border-zinc-800/80 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {title}
        </h3>
      ) : null}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

function gstinLooksValid(g) {
  const s = String(g || '')
    .replace(/\s/g, '')
    .toUpperCase()
  return s.length === 15
}

export default function GstInvoicePage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [form, setForm] = useState(() => demoForm())
  const [tab, setTab] = useState('seller')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [templateHint, setTemplateHint] = useState(null)
  const [headerMode, setHeaderMode] = useState('edit')
  const logoRef = useRef(null)

  useToolEngagement(TOOL, true)

  useEffect(() => {
    document.title = DOC_TITLE
    pageView('/tools/gst-invoice', DOC_TITLE)
  }, [])

  useEffect(() => {
    if (!templateHint) return
    const t = setTimeout(() => setTemplateHint(null), 3200)
    return () => clearTimeout(t)
  }, [templateHint])

  const totals = useMemo(
    () => calculateGstTotals(form.items, form.sellerStateCode, form.buyerStateCode),
    [form.items, form.sellerStateCode, form.buyerStateCode]
  )

  const compliance = useMemo(() => {
    const rows = [
      { id: 'type', label: 'Invoice type', ok: !!form.invoiceType },
      { id: 'no', label: 'Invoice number', ok: form.invoiceNo.trim().length > 0 },
      { id: 'date', label: 'Invoice date', ok: !!form.invoiceDate },
      {
        id: 'supplier',
        label: 'Supplier GSTIN, state & legal name',
        ok:
          gstinLooksValid(form.sellerGstin) &&
          form.sellerStateCode.trim().length === 2 &&
          form.sellerLegalName.trim().length > 0,
      },
      {
        id: 'buyer',
        label: 'Recipient GSTIN & legal name',
        ok: gstinLooksValid(form.buyerGstin) && form.buyerLegalName.trim().length > 0,
      },
      { id: 'pos', label: 'Place of supply', ok: form.placeOfSupply.trim().length > 0 },
      {
        id: 'items',
        label: 'Line items (description, qty, rate)',
        ok: form.items.some(
          (it) =>
            String(it.description || '').trim().length > 0 &&
            Number(it.qty) > 0 &&
            Number(String(it.rate).replace(/,/g, '')) > 0
        ),
      },
      {
        id: 'hsn',
        label: 'HSN / SAC on lines (recommended)',
        ok: form.items.some((it) => String(it.hsn || '').trim().length > 0),
      },
    ]
    const done = rows.filter((r) => r.ok).length
    return { rows, done, total: rows.length }
  }, [form])

  const updateField = useCallback((key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
  }, [])

  const setSellerGstin = useCallback((raw) => {
    const v = String(raw).toUpperCase()
    setForm((f) => {
      const next = { ...f, sellerGstin: v }
      const pan = panFromGstin(v)
      if (pan) next.sellerPan = pan
      const code = v.replace(/\s/g, '').slice(0, 2)
      const st = INDIAN_STATES.find((s) => s.code === code)
      if (st) {
        next.sellerStateCode = st.code
        next.sellerStateName = st.name
      }
      return next
    })
  }, [])

  const setBuyerGstin = useCallback((raw) => {
    const v = String(raw).toUpperCase()
    setForm((f) => {
      const next = { ...f, buyerGstin: v }
      const pan = panFromGstin(v)
      if (pan) next.buyerPan = pan
      const code = v.replace(/\s/g, '').slice(0, 2)
      const st = INDIAN_STATES.find((s) => s.code === code)
      if (st) {
        next.buyerStateCode = st.code
        next.buyerStateName = st.name
      }
      return next
    })
  }, [])

  const updateItem = useCallback((id, key, val) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => (it.id === id ? { ...it, [key]: val } : it)),
    }))
  }, [])

  const addRow = useCallback(() => {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))
  }, [])

  const removeRow = useCallback((id) => {
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((it) => it.id !== id) : f.items }))
  }, [])

  const buildBytes = useCallback(async () => {
    return buildGstInvoicePdfBytes(normalizeFormForPdf(form))
  }, [form])

  const openPreview = useCallback(async () => {
    setErr(null)
    setBusy(true)
    setHeaderMode('preview')
    try {
      await runWithSignInForDownload(
        async () => {
          const bytes = await buildBytes()
          const blob = new Blob([bytes], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank', 'noopener,noreferrer')
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
        },
        { onAuthLoading: () => setErr('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') return
      if (e?.code === 'EYP_AUTH_LOADING') {
        setErr(e.message || 'Still checking sign-in.')
        return
      }
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'gst_preview_failed')
      setErr(e?.message || 'Could not build preview.')
    } finally {
      setBusy(false)
    }
  }, [buildBytes, runWithSignInForDownload])

  const onDownload = useCallback(async () => {
    setErr(null)
    setBusy(true)
    setHeaderMode('edit')
    try {
      await runWithSignInForDownload(
        async () => {
          const bytes = await buildBytes()
          const safe = (form.invoiceNo || 'GST-invoice').replace(/[^\w.-]+/g, '_')
          downloadPdf(bytes, `${safe}.pdf`)
          trackFileDownloaded({
            tool: TOOL,
            file_size: bytes.byteLength / 1024,
            total_pages: 1,
          })
          trackToolCompleted(TOOL, true)
        },
        { onAuthLoading: () => setErr('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') return
      if (e?.code === 'EYP_AUTH_LOADING') {
        setErr(e.message || 'Still checking sign-in.')
        return
      }
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'gst_pdf_failed')
      setErr(e?.message || 'Could not build the PDF. Check your inputs and try again.')
    } finally {
      setBusy(false)
    }
  }, [buildBytes, form.invoiceNo, runWithSignInForDownload])

  const saveTemplate = useCallback(() => {
    try {
      const payload = JSON.stringify(form)
      localStorage.setItem(GST_TEMPLATE_STORAGE_KEY, payload)
      setTemplateHint('Template saved in this browser.')
    } catch {
      setTemplateHint('Could not save (storage full or private mode).')
    }
  }, [form])

  const loadTemplate = useCallback(() => {
    try {
      const raw = localStorage.getItem(GST_TEMPLATE_STORAGE_KEY)
      if (!raw) {
        setTemplateHint('No saved template yet.')
        return
      }
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.items)) {
        setTemplateHint('Saved template is invalid.')
        return
      }
      setForm(parsed)
      setErr(null)
      setTemplateHint('Template loaded.')
    } catch {
      setTemplateHint('Could not load template.')
    }
  }, [])

  const onLogoPick = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      setErr('Logo must be PNG or JPEG.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setForm((f) => ({ ...f, logoDataUrl: typeof reader.result === 'string' ? reader.result : null }))
      setErr(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const clearLogo = useCallback(() => {
    setForm((f) => ({ ...f, logoDataUrl: null }))
  }, [])

  const tabBtn = (id, label) => {
    const on = tab === id
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => setTab(id)}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
          on
            ? 'bg-white text-zinc-950 shadow-sm'
            : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <ToolPageShell title="GST invoice" subtitle={null} contentMaxWidth="wide">
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl shadow-black/40">
        <div className="border-b border-zinc-800/90 px-4 py-5 sm:px-6 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">GST Invoice Generator</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Tax invoice and bill-of-supply layout · CGST / SGST / IGST · HSN / SAC · Built locally in your browser
                (no server upload).
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500">
                When accounts are enabled, sign in or create a free account before <strong className="font-medium text-zinc-400">preview</strong> or{' '}
                <strong className="font-medium text-zinc-400">download</strong> — same flow as our other PDF tools.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={saveTemplate}
                className="rounded-lg border border-zinc-600 bg-transparent px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/60"
              >
                Save template
              </button>
              <button
                type="button"
                onClick={loadTemplate}
                className="rounded-lg border border-zinc-600 bg-transparent px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/60"
              >
                Load template
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void openPreview()}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  headerMode === 'preview'
                    ? 'bg-white text-zinc-950 shadow-md'
                    : 'border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDownload()}
                className="rounded-lg border border-zinc-500 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Download PDF'}
              </button>
            </div>
          </div>
          {templateHint ? (
            <p className="mt-3 text-xs text-cyan-400/90" role="status">
              {templateHint}
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_min(100%,300px)] md:gap-8 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            {err ? (
              <p
                role="alert"
                className="rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-100"
              >
                {err}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Invoice sections">
              {tabBtn('seller', 'Seller')}
              {tabBtn('buyer', 'Buyer')}
              {tabBtn('invoice', 'Invoice')}
              {tabBtn('items', 'Items')}
              {tabBtn('other', 'Other')}
            </div>

            {tab === 'seller' ? (
              <div className="space-y-5" role="tabpanel">
                <Card title="Supplier">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="shrink-0">
                      <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={onLogoPick} />
                      {form.logoDataUrl ? (
                        <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
                          <img src={form.logoDataUrl} alt="" className="h-full w-full object-contain p-2" />
                          <button
                            type="button"
                            onClick={clearLogo}
                            className="absolute right-1 top-1 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-white"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => logoRef.current?.click()}
                          className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-600 bg-zinc-900/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        >
                          <Upload className="h-5 w-5" aria-hidden />
                          <span className="text-[10px] font-medium uppercase tracking-wide">Logo</span>
                        </button>
                      )}
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <Label required>Trade / brand name</Label>
                        <input
                          className={inp}
                          value={form.sellerTradeName}
                          onChange={(e) => updateField('sellerTradeName', e.target.value)}
                          autoComplete="off"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <Label required>Legal name (as per GST)</Label>
                        <input
                          className={inp}
                          value={form.sellerLegalName}
                          onChange={(e) => updateField('sellerLegalName', e.target.value)}
                          autoComplete="organization"
                        />
                      </label>
                      <label className="block">
                        <Label required>GSTIN</Label>
                        <input className={inp} value={form.sellerGstin} onChange={(e) => setSellerGstin(e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>PAN</Label>
                        <input className={inp} value={form.sellerPan} onChange={(e) => updateField('sellerPan', e.target.value)} />
                        <span className="mt-1 block text-[10px] text-zinc-500">Auto-filled from GSTIN (chars 3–12) when possible</span>
                      </label>
                      <label className="block sm:col-span-2">
                        <Label required>Address line 1</Label>
                        <input className={inp} value={form.sellerAddr1} onChange={(e) => updateField('sellerAddr1', e.target.value)} />
                      </label>
                      <label className="block sm:col-span-2">
                        <Label>Address line 2</Label>
                        <input className={inp} value={form.sellerAddr2} onChange={(e) => updateField('sellerAddr2', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label required>City</Label>
                        <input className={inp} value={form.sellerCity} onChange={(e) => updateField('sellerCity', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>State</Label>
                        <select
                          className={inp}
                          value={form.sellerStateCode}
                          onChange={(e) => {
                            const code = e.target.value
                            const st = INDIAN_STATES.find((s) => s.code === code)
                            setForm((f) => ({
                              ...f,
                              sellerStateCode: code,
                              sellerStateName: st?.name ?? '',
                            }))
                          }}
                        >
                          <option value="">Select state</option>
                          {INDIAN_STATES.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <Label>PIN code</Label>
                        <input className={inp} value={form.sellerPin} onChange={(e) => updateField('sellerPin', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>Phone</Label>
                        <input className={inp} value={form.sellerPhone} onChange={(e) => updateField('sellerPhone', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>Email</Label>
                        <input className={inp} type="email" value={form.sellerEmail} onChange={(e) => updateField('sellerEmail', e.target.value)} />
                      </label>
                      <label className="block sm:col-span-2">
                        <Label>Website</Label>
                        <input className={inp} value={form.sellerWebsite} onChange={(e) => updateField('sellerWebsite', e.target.value)} />
                      </label>
                    </div>
                  </div>
                </Card>
                <Card title="Bank details (optional)">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <Label>Bank name</Label>
                      <input className={inp} value={form.bankName} onChange={(e) => updateField('bankName', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label>Account number</Label>
                      <input className={inp} value={form.bankAccount} onChange={(e) => updateField('bankAccount', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label>IFSC</Label>
                      <input className={inp} value={form.bankIfsc} onChange={(e) => updateField('bankIfsc', e.target.value)} />
                    </label>
                    <label className="block sm:col-span-2">
                      <Label>UPI ID</Label>
                      <input className={inp} value={form.bankUpi} onChange={(e) => updateField('bankUpi', e.target.value)} />
                    </label>
                  </div>
                </Card>
              </div>
            ) : null}

            {tab === 'buyer' ? (
              <div className="space-y-5" role="tabpanel">
                <Card title="Recipient">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <Label>Trade / brand name</Label>
                      <input className={inp} value={form.buyerTradeName} onChange={(e) => updateField('buyerTradeName', e.target.value)} />
                    </label>
                    <label className="block sm:col-span-2">
                      <Label required>Legal name</Label>
                      <input className={inp} value={form.buyerLegalName} onChange={(e) => updateField('buyerLegalName', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label required>GSTIN</Label>
                      <input className={inp} value={form.buyerGstin} onChange={(e) => setBuyerGstin(e.target.value)} />
                    </label>
                    <label className="block">
                      <Label>PAN</Label>
                      <input className={inp} value={form.buyerPan} onChange={(e) => updateField('buyerPan', e.target.value)} />
                    </label>
                    <label className="block sm:col-span-2">
                      <Label required>Address line 1</Label>
                      <input className={inp} value={form.buyerAddr1} onChange={(e) => updateField('buyerAddr1', e.target.value)} />
                    </label>
                    <label className="block sm:col-span-2">
                      <Label>Address line 2</Label>
                      <input className={inp} value={form.buyerAddr2} onChange={(e) => updateField('buyerAddr2', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label required>City</Label>
                      <input className={inp} value={form.buyerCity} onChange={(e) => updateField('buyerCity', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label>State</Label>
                      <select
                        className={inp}
                        value={form.buyerStateCode}
                        onChange={(e) => {
                          const code = e.target.value
                          const st = INDIAN_STATES.find((s) => s.code === code)
                          setForm((f) => ({
                            ...f,
                            buyerStateCode: code,
                            buyerStateName: st?.name ?? '',
                          }))
                        }}
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <Label>PIN code</Label>
                      <input className={inp} value={form.buyerPin} onChange={(e) => updateField('buyerPin', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label>Phone</Label>
                      <input className={inp} value={form.buyerPhone} onChange={(e) => updateField('buyerPhone', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label>Email</Label>
                      <input className={inp} type="email" value={form.buyerEmail} onChange={(e) => updateField('buyerEmail', e.target.value)} />
                    </label>
                  </div>
                </Card>
              </div>
            ) : null}

            {tab === 'invoice' ? (
              <div className="space-y-5" role="tabpanel">
                <Card title="Invoice meta">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <Label>Document type</Label>
                      <select
                        className={inp}
                        value={form.invoiceType}
                        onChange={(e) => updateField('invoiceType', e.target.value)}
                      >
                        <option value="tax_invoice">Tax invoice</option>
                        <option value="bill_of_supply">Bill of supply</option>
                      </select>
                    </label>
                    <label className="block">
                      <Label required>Invoice number</Label>
                      <input className={inp} value={form.invoiceNo} onChange={(e) => updateField('invoiceNo', e.target.value)} />
                    </label>
                    <label className="block">
                      <Label required>Invoice date</Label>
                      <input className={inp} type="date" value={form.invoiceDate} onChange={(e) => updateField('invoiceDate', e.target.value)} />
                    </label>
                    <label className="block sm:col-span-2">
                      <Label required>Place of supply</Label>
                      <input className={inp} value={form.placeOfSupply} onChange={(e) => updateField('placeOfSupply', e.target.value)} />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={form.reverseCharge}
                        onChange={(e) => updateField('reverseCharge', e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-white focus:ring-zinc-500"
                      />
                      <span className="text-sm text-zinc-300">Reverse charge applicable</span>
                    </label>
                  </div>
                </Card>
              </div>
            ) : null}

            {tab === 'items' ? (
              <div className="space-y-4" role="tabpanel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs text-zinc-500">
                    Rate is taxable value per unit before GST. Same state codes → CGST+SGST; different → IGST.
                  </p>
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add line
                  </button>
                </div>
                {form.items.map((it, idx) => (
                  <div key={it.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500">Line {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeRow(it.id)}
                        disabled={form.items.length <= 1}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <Label>Description</Label>
                        <input className={inp} value={it.description} onChange={(e) => updateItem(it.id, 'description', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>HSN / SAC</Label>
                        <input className={inp} value={it.hsn} onChange={(e) => updateItem(it.id, 'hsn', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>Qty</Label>
                        <input className={inp} type="number" min="0" step="any" value={it.qty} onChange={(e) => updateItem(it.id, 'qty', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>Rate (excl. GST)</Label>
                        <input className={inp} type="number" min="0" step="any" value={it.rate} onChange={(e) => updateItem(it.id, 'rate', e.target.value)} />
                      </label>
                      <label className="block">
                        <Label>GST %</Label>
                        <input className={inp} type="number" min="0" step="any" value={it.gstPercent} onChange={(e) => updateItem(it.id, 'gstPercent', e.target.value)} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'other' ? (
              <div className="space-y-5" role="tabpanel">
                <Card title="Notes & terms">
                  <label className="block">
                    <Label>Printed on PDF (optional)</Label>
                    <textarea
                      className={`${inp} min-h-[120px] resize-y`}
                      value={form.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      rows={4}
                      placeholder="Payment terms, LUT reference, remarks…"
                    />
                  </label>
                </Card>
                <p className="text-xs leading-relaxed text-zinc-500">
                  pdfpilot does not upload or store your invoice. This tool is a drafting aid — confirm e-invoicing, HSN,
                  and returns with a qualified CA before filing.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
            <Card title="GST checklist">
              <p className="mb-3 text-2xl font-semibold tabular-nums text-white">
                {compliance.done}
                <span className="text-base font-normal text-zinc-500">/{compliance.total}</span>
              </p>
              <ul className="m-0 list-none space-y-2.5 p-0">
                {compliance.rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-2 text-sm">
                    {row.ok ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" strokeWidth={2} aria-hidden />
                    )}
                    <span className={row.ok ? 'text-zinc-200' : 'text-zinc-500'}>{row.label}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Quick summary">
              <dl className="m-0 space-y-2 text-sm">
                <div className="flex justify-between gap-2 text-zinc-400">
                  <dt>Subtotal (taxable)</dt>
                  <dd className="m-0 font-medium tabular-nums text-zinc-100">₹{totals.taxable.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between gap-2 text-zinc-400">
                  <dt>Total tax</dt>
                  <dd className="m-0 font-medium tabular-nums text-zinc-100">
                    ₹{(totals.cgst + totals.sgst + totals.igst).toFixed(2)}
                  </dd>
                </div>
                <div className="mt-3 flex justify-between gap-2 border-t border-zinc-800 pt-3 text-base font-semibold text-white">
                  <dt>Grand total</dt>
                  <dd className="m-0 tabular-nums">₹{totals.grand.toFixed(2)}</dd>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  {totals.intra ? 'Intra-state: CGST + SGST (half of line % each).' : 'Inter-state: IGST (full line %).'}
                </p>
              </dl>
            </Card>

            <Card title="Actions">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void openPreview()}
                  className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
                >
                  Preview invoice
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDownload()}
                  className="w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void openPreview()}
                  className="w-full py-2 text-center text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                >
                  Print (opens PDF tab)
                </button>
                <button
                  type="button"
                  onClick={saveTemplate}
                  className="w-full py-2 text-center text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Save as template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm())
                    setErr(null)
                    setTab('seller')
                  }}
                  className="w-full py-2 text-center text-sm text-red-400/90 hover:text-red-300"
                >
                  Reset invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(demoForm())
                    setErr(null)
                  }}
                  className="w-full py-2 text-center text-sm text-zinc-500 hover:text-zinc-300"
                >
                  Fill sample data
                </button>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <div className="mt-10">
        <ToolFeatureSeoSection toolId="gst-invoice" />
      </div>
    </ToolPageShell>
  )
}

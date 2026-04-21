import { createElement, useMemo, useState } from 'react'
import {
  Building2,
  Check,
  CircleCheck,
  GraduationCap,
  Landmark,
  Lock,
  Scale,
  Shield,
  Stethoscope,
  Zap,
} from 'lucide-react'
import { apiUrl, isApiBaseConfigured } from '../../lib/apiBase'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import ToolFeatureSeoSection from '../../shared/components/ToolFeatureSeoSection.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  markFunnelUpload,
  trackErrorOccurred,
  trackFileDownloaded,
  trackFileUploaded,
  trackProcessingTime,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'
import { MSG } from '../../shared/constants/branding.js'
import { useClientToolDownloadAuth } from '../../auth/ClientToolDownloadAuthContext.jsx'

const ENCRYPT_TOOL = ANALYTICS_TOOL.encrypt_pdf
const MIN_PW = 12

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

/** 0–4 score for meter (length, mixed case, digits, symbols). */
function passwordScore(pw) {
  let s = 0
  if (pw.length >= MIN_PW) s += 1
  if (pw.length >= 16) s += 0.5
  if (/[a-z]/.test(pw)) s += 0.75
  if (/[A-Z]/.test(pw)) s += 0.75
  if (/[0-9]/.test(pw)) s += 0.75
  if (/[^A-Za-z0-9\s]/.test(pw)) s += 0.75
  return Math.min(4, Math.floor(s))
}

const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']

function DarkCard({ icon, title, children }) {
  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/60 p-5 shadow-lg backdrop-blur-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700/80 text-cyan-300">
        {createElement(icon, { className: 'h-4 w-4', strokeWidth: 1.75, 'aria-hidden': true })}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</p>
    </div>
  )
}

export default function EncryptPdfPage() {
  const { runWithSignInForDownload } = useClientToolDownloadAuth()
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fileReadyHint, setFileReadyHint] = useState(null)

  useToolEngagement(ENCRYPT_TOOL, true)

  const score = useMemo(() => passwordScore(password), [password])
  const canSubmit =
    file &&
    password.length >= MIN_PW &&
    password === confirm &&
    score >= 2 &&
    !busy

  const runEncrypt = async () => {
    if (!file) {
      setError('Choose a PDF first.')
      return
    }
    if (password.length < MIN_PW) {
      setError(`Use at least ${MIN_PW} characters in your password.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setError(
        'Encrypt PDF needs the API (qpdf). Set VITE_API_BASE_URL in production, or run the backend on port 3001 locally.'
      )
      return
    }

    setBusy(true)
    setError(null)
    setFileReadyHint(null)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

    try {
      await runWithSignInForDownload(
        async () => {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('password', password)

          const res = await fetch(apiUrl('/encrypt-pdf'), { method: 'POST', body: fd, credentials: 'include' })
          const contentType = res.headers.get('Content-Type') || ''

          if (!res.ok) {
            let msg = res.statusText || 'Request failed'
            if (contentType.includes('application/json')) {
              try {
                const j = await res.json()
                if (j?.error) msg = j.error
              } catch {
                /* ignore */
              }
            }
            trackErrorOccurred(ENCRYPT_TOOL, msg || `http_${res.status}`)
            setError(msg)
            return
          }

          if (!contentType.includes('application/pdf')) {
            const text = await res.text()
            trackErrorOccurred(ENCRYPT_TOOL, 'unexpected_response_type')
            setError(text.slice(0, 200) || 'Server did not return a PDF.')
            return
          }

          const blob = await res.blob()
          const outName = `encrypted_${Date.now()}.pdf`
          downloadBlob(blob, outName)
          setFileReadyHint(MSG.fileReady)
          window.setTimeout(() => setFileReadyHint(null), 6000)
          trackToolCompleted(ENCRYPT_TOOL, true)
          trackFileDownloaded({ tool: ENCRYPT_TOOL, file_size: blob.size / 1024 })
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          trackProcessingTime(ENCRYPT_TOOL, elapsed)
        },
        { onAuthLoading: () => setError('Still checking sign-in… try again in a moment.') }
      )
    } catch (e) {
      if (e?.code === 'EYP_AUTH_CANCELLED') {
        /* dismissed */
      } else if (e?.code === 'EYP_AUTH_LOADING') {
        setError(e.message || 'Still checking sign-in.')
      } else {
        trackErrorOccurred(
          ENCRYPT_TOOL,
          e?.message === 'Failed to fetch' ? 'fetch_failed' : e?.message || 'encrypt_failed'
        )
        setError(
          e?.message === 'Failed to fetch'
            ? 'Could not reach the API. Start the backend (port 3001) or check your network.'
            : e?.message || 'Could not encrypt PDF'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPageShell
      title="Encrypt PDF"
      subtitle="Password-protect your PDF with AES-256. Your file is encrypted on the server with qpdf over HTTPS (not stored after download)."
    >
      <div className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <FileDropzone
          accept="application/pdf"
          disabled={busy}
          onFiles={(f) => {
            const next = f[0]
            if (next) {
              markFunnelUpload(ENCRYPT_TOOL)
              trackFileUploaded({ file_type: 'pdf', file_size: next.size / 1024, tool: ENCRYPT_TOOL })
            }
            setFile(next)
            setFileReadyHint(null)
          }}
          label={file ? file.name : 'Drop PDF here to encrypt'}
        />
        {fileReadyHint && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          >
            {fileReadyHint}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              placeholder={`At least ${MIN_PW} characters`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="Re-enter password"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>Strength</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{strengthLabel[score]}</span>
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < score ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Prefer 12+ characters with upper and lower case, numbers, and symbols. Use a unique password and a
            password manager.
          </p>
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={runEncrypt}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {busy ? MSG.processingFile : 'Encrypt and download'}
        </button>
        {!canSubmit && !busy && file && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/90">
            Match both passwords, meet the minimum length, and raise strength to at least “Fair” before encrypting.
          </p>
        )}
      </div>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] mt-12 w-screen max-w-none bg-zinc-950 px-4 py-16 text-zinc-200 sm:px-6 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-white md:text-3xl">Why encrypt here</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-400">
            Strong protection for contracts, finance, legal, and personal PDFs — with clear steps and honest
            disclosure about how processing works.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DarkCard icon={Lock} title="AES-256 encryption">
              Industry-standard 256-bit encryption applied with qpdf on your pdfpilot API — the same family of tools
              many teams trust for PDF workflows.
            </DarkCard>
            <DarkCard icon={Shield} title="Secure server processing">
              Files are sent over HTTPS, encrypted in an isolated temp directory, then streamed back to you. They are
              not kept on disk after the response (same pattern as Unlock PDF).
            </DarkCard>
            <DarkCard icon={CircleCheck} title="Password strength guidance">
              Built-in meter checks length and character mix so weak passwords are harder to ship by mistake.
            </DarkCard>
            <DarkCard icon={Zap} title="Fast turnaround">
              Typical documents finish in seconds on a healthy API host — download starts as soon as qpdf completes.
            </DarkCard>
          </div>

          <h2 className="mt-20 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            How to encrypt a PDF with a password
          </h2>
          <ol className="mx-auto mt-10 max-w-3xl space-y-6">
            {[
              'Select the PDF file you want to password-protect.',
              'Enter a strong password — use 12+ characters with mixed case, numbers & symbols.',
              'Re-enter your password to prevent typos.',
              'Download your password-protected PDF file instantly.',
            ].map((text, i) => (
              <li key={i} className="flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-sm font-bold text-cyan-300"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className="pt-1.5 text-sm leading-relaxed text-zinc-300">{text}</p>
              </li>
            ))}
          </ol>

          <h2 className="mt-20 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            When to encrypt your PDFs
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Building2, title: 'Business documents', body: 'Contracts, proposals, and board packs shared outside your VPN.' },
              { icon: Landmark, title: 'Financial records', body: 'Tax documents, bank statements, and payroll exports.' },
              { icon: Scale, title: 'Legal files', body: 'Agreements, filings, and matter bundles with sensitive names.' },
              { icon: Stethoscope, title: 'Medical records', body: 'Patient letters and referrals where encryption is expected.' },
              { icon: GraduationCap, title: 'Academic work', body: 'Theses, unreleased research, and exam materials.' },
              { icon: Lock, title: 'Personal documents', body: 'IDs, passports, and anything with account numbers.' },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-5 text-center shadow-md sm:text-left"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 text-white sm:mx-0">
                  {createElement(icon, { className: 'h-6 w-6', strokeWidth: 1.5, 'aria-hidden': true })}
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-20 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            Creating strong passwords
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <ul className="space-y-5 text-sm text-zinc-300">
              {[
                { t: 'Use 12+ characters', b: 'Sixteen or more is even better for high-value files.' },
                { t: 'Avoid common words', b: 'Skip dictionary words, pet names, birthdays, and keyboard walks like “qwerty”.' },
                { t: 'Store passwords safely', b: 'Use a reputable password manager instead of sticky notes or chat threads.' },
              ].map(({ t, b }) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>
                    <span className="font-semibold text-white">{t}</span>
                    <span className="mt-1 block text-zinc-400">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
            <ul className="space-y-5 text-sm text-zinc-300">
              {[
                { t: 'Mix character types', b: 'Combine uppercase, lowercase, numbers, and symbols where policy allows.' },
                { t: 'Use unique passwords', b: 'Do not reuse the same password across unrelated PDFs or websites.' },
              ].map(({ t, b }) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>
                    <span className="font-semibold text-white">{t}</span>
                    <span className="mt-1 block text-zinc-400">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-12">
        <ToolFeatureSeoSection toolId="encrypt-pdf" />
      </div>
    </ToolPageShell>
  )
}

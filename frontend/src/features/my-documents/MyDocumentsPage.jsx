import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, FilePenLine, FileText, Pencil, RefreshCw, Trash2, Download } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { isFirebaseConfigured, isFirebaseAuthReady } from '../../lib/firebase.js'
import { apiUrl, getResolvedApiBase, isApiBaseConfigured } from '../../lib/apiBase.js'
import { persistEditSession } from '../edit-pdf/editSessionStorage.js'
import { fetchEditPdfDownload } from '../edit-pdf/editPdfDownload.js'
import { useSubscription } from '../../subscription/SubscriptionContext.jsx'
import UpgradePlanModal from '../../subscription/UpgradePlanModal.jsx'
import {
  deleteUserSessionOnServer,
  duplicateUserSessionOnServer,
  fetchUserLibraryFromServer,
  libraryToolLabel,
  renameUserSessionOnServer,
  suggestLibraryDuplicateFileName,
} from './userLibrary.js'

function formatWhen(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

export default function MyDocumentsPage() {
  const navigate = useNavigate()
  const { user, loading, getFreshIdToken } = useAuth()
  const [docs, setDocs] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [adminConfigured, setAdminConfigured] = useState(true)
  const [adminSetupMessage, setAdminSetupMessage] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [healthProbe, setHealthProbe] = useState(null)
  const [healthBusy, setHealthBusy] = useState(false)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const { refresh: refreshSubscription } = useSubscription()

  const fbReady = isFirebaseConfigured() && isFirebaseAuthReady()

  const probeApiHealth = useCallback(async () => {
    setHealthBusy(true)
    setHealthProbe(null)
    try {
      const url = apiUrl('/health')
      const res = await fetch(url)
      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = { parseError: 'Response was not JSON', raw: text.slice(0, 200) }
      }
      const absoluteUrl =
        typeof window !== 'undefined' ? new URL(url, window.location.href).href : url
      const looksLikeExpressHealth =
        json &&
        typeof json === 'object' &&
        !json.parseError &&
        (json.unlock != null || json.qpdf != null || json.firebaseAdminReady != null)
      setHealthProbe({
        ok: res.ok,
        status: res.status,
        url,
        absoluteUrl,
        resolvedApiBase: getResolvedApiBase() || null,
        looksLikeExpressHealth,
        json,
      })
    } catch (e) {
      setHealthProbe({
        ok: false,
        error: e?.message || 'Network error',
        url: apiUrl('/health'),
      })
    } finally {
      setHealthBusy(false)
    }
  }, [])

  const loadLibrary = useCallback(async () => {
    if (!user?.uid || !fbReady) return
    setLoadingList(true)
    setLoadError(null)
    try {
      const r = await fetchUserLibraryFromServer({ getFreshIdToken })
      if (!r.ok) {
        setDocs([])
        setAdminConfigured(true)
        setAdminSetupMessage('')
        const hint =
          r.status === 503
            ? `${r.error} The API needs Firebase Admin credentials (same as secure download) so it can write your library to Firestore.`
            : r.error
        setLoadError(hint)
        return
      }
      setDocs(r.documents)
      const ac = r.adminConfigured !== false
      setAdminConfigured(ac)
      setAdminSetupMessage(ac ? '' : (r.serverMessage || '').trim())
      if (ac) setHealthProbe(null)
      else void probeApiHealth()
    } catch (e) {
      setDocs([])
      setAdminConfigured(true)
      setAdminSetupMessage('')
      setLoadError(e?.message || 'Could not load documents.')
    } finally {
      setLoadingList(false)
    }
  }, [user?.uid, fbReady, getFreshIdToken, probeApiHealth])

  useEffect(() => {
    if (!user?.uid || !fbReady) {
      setDocs([])
      setLoadError(null)
      setAdminConfigured(true)
      setAdminSetupMessage('')
      return undefined
    }
    void loadLibrary()
    const id = window.setInterval(() => void loadLibrary(), 25_000)
    return () => window.clearInterval(id)
  }, [user?.uid, fbReady, loadLibrary])

  const openInEditor = useCallback(
    (sessionId, fileName) => {
      persistEditSession({
        sessionId,
        downloadToken: null,
        fileName: fileName || null,
      })
      navigate('/tools/edit-pdf/editor')
    },
    [navigate]
  )

  const renameOne = useCallback(
    async (sessionId, currentName) => {
      const entered = window.prompt('Display name in Saved PDFs', currentName)
      if (entered === null) return
      const next = String(entered).trim()
      if (!next || next === currentName) return
      setBusyId(sessionId)
      setMsg(null)
      try {
        const r = await renameUserSessionOnServer({ getFreshIdToken, sessionId, fileName: next })
        if (!r.ok) {
          const hint =
            r.error === 'admin_unavailable'
              ? 'Renaming needs Firebase Admin on the API (local dev: set FIREBASE_SERVICE_ACCOUNT_JSON).'
              : r.error || 'Rename failed.'
          setMsg(hint)
          return
        }
        setMsg('Name updated.')
        await loadLibrary()
      } catch (e) {
        console.error(e)
        setMsg(e?.message || 'Rename failed.')
      } finally {
        setBusyId(null)
      }
    },
    [getFreshIdToken, loadLibrary]
  )

  const duplicateOne = useCallback(
    async (sessionId, fileName) => {
      const suggestion = suggestLibraryDuplicateFileName(fileName)
      const entered = window.prompt('Name for the duplicate (opens in the editor)', suggestion)
      if (entered === null) return
      const next = String(entered).trim() || suggestion
      setBusyId(sessionId)
      setMsg(null)
      try {
        const r = await duplicateUserSessionOnServer({
          getFreshIdToken,
          sourceSessionId: sessionId,
          fileName: next,
        })
        if (!r.ok) {
          const hint =
            r.error === 'admin_unavailable'
              ? 'Copy needs Firebase Admin on the API (local dev: set FIREBASE_SERVICE_ACCOUNT_JSON).'
              : r.error || 'Could not duplicate.'
          setMsg(hint)
          return
        }
        const idOk = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          r.newSessionId
        )
        if (!idOk) {
          setMsg('Unexpected server response.')
          return
        }
        setMsg('Opening your copy in the editor…')
        openInEditor(r.newSessionId, r.fileName)
        await loadLibrary()
      } catch (e) {
        console.error(e)
        setMsg(e?.message || 'Could not duplicate.')
      } finally {
        setBusyId(null)
      }
    },
    [getFreshIdToken, loadLibrary, openInEditor]
  )

  const downloadOne = useCallback(
    async (sessionId, fileName) => {
      setBusyId(sessionId)
      setMsg(null)
      try {
        const token = await getFreshIdToken()
        const r = await fetchEditPdfDownload({ sessionId, downloadToken: null, idToken: token })
        if (!r.ok) {
          if (r.status === 403 && r.errPayload?.error === 'download_limit_exceeded') {
            setUpgradeModalOpen(true)
            return
          }
          setMsg(
            r.status === 404
              ? 'This file is no longer on the server. It may have expired after seven days without activity.'
              : 'Download failed. Try signing in again or open the document and use Download PDF from the editor.'
          )
          return
        }
        const blob = r.blob
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        const base = (fileName || 'document').replace(/\.pdf$/i, '')
        a.download = `${base}.pdf`
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(href)
      } catch (e) {
        console.error(e)
        setMsg(e?.message || 'Download failed.')
      } finally {
        setBusyId(null)
      }
    },
    [getFreshIdToken]
  )

  const removeOne = useCallback(
    async (sessionId) => {
      if (!window.confirm('Remove this document from your library and delete server files?')) return
      setBusyId(sessionId)
      setMsg(null)
      try {
        const server = await deleteUserSessionOnServer({ getFreshIdToken, sessionId })
        if (!server.ok && server.status !== 404) {
          setMsg(server.error || 'Could not delete files on the server.')
        }
        await loadLibrary()
      } catch (e) {
        console.error(e)
        setMsg(e?.message || 'Could not delete files.')
      } finally {
        setBusyId(null)
      }
    },
    [getFreshIdToken, loadLibrary]
  )

  const gate = useMemo(() => {
    if (loading) return 'loading'
    if (!user) return 'signin'
    if (!fbReady) return 'firebase'
    return 'ok'
  }, [loading, user, fbReady])

  if (gate === 'loading') {
    return (
      <ToolPageShell title="Saved PDFs" subtitle="Loading your library…">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading your account…</p>
      </ToolPageShell>
    )
  }

  if (gate === 'signin') {
    return (
      <ToolPageShell
        title="Saved PDFs"
        subtitle="Sign in to see PDFs you edited or saved while logged in."
      >
        <div className="rounded-xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <p className="m-0 text-sm text-zinc-700 dark:text-zinc-300">
            Your library lists PDFs you worked on while signed in (for example from Edit PDF). Use{' '}
            <strong>Log in · Sign up</strong> in the header, then return here.
          </p>
          <p className="mt-4 mb-0 text-sm">
            <Link
              to="/"
              className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
            >
              Back to tools
            </Link>
          </p>
        </div>
      </ToolPageShell>
    )
  }

  if (gate === 'firebase') {
    return (
      <ToolPageShell title="Saved PDFs" subtitle="Firebase is not configured in this build.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add your Firebase web keys to the frontend environment so sign-in and cloud sync can run.
        </p>
      </ToolPageShell>
    )
  }

  return (
    <ToolPageShell
      title="Saved PDFs"
      subtitle="PDFs you edited or exported from tools while signed in. Open, download, or remove anytime."
    >
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={loadingList}
          onClick={() => void loadLibrary()}
          className="fx-focus-ring inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {msg ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {msg}
        </div>
      ) : null}

      {import.meta.env.PROD && !isApiBaseConfigured() ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-400 bg-rose-950/90 px-4 py-3 text-sm text-rose-50 dark:border-rose-500 dark:bg-rose-950/80"
        >
          <p className="m-0 font-semibold">The site is not pointed at your PDF API</p>
          <p className="mt-2 mb-0 text-xs leading-relaxed text-rose-100/95">
            Requests use this domain only (<strong>no</strong> <code className="rounded bg-black/25 px-1">https://…onrender.com</code> base), so My
            Saved PDFs and /health never reach Render — Firebase Admin on the API is irrelevant until this is fixed.
          </p>
          <ol className="mt-3 mb-0 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-rose-100/95">
            <li>
              GitHub repo → <strong>Settings → Secrets and variables → Actions</strong> → set{' '}
              <code className="rounded bg-black/25 px-1">VITE_API_BASE_URL</code> to your Render API URL (no trailing slash), e.g.{' '}
              <code className="rounded bg-black/25 px-1">https://your-service.onrender.com</code>.
            </li>
            <li>Run workflow <strong>Deploy frontend to GitHub Pages</strong> again (push to main or manual run).</li>
            <li>Hard-refresh this page (Ctrl+Shift+R). Diagnostics should show <code className="rounded bg-black/25 px-1">looksLikeExpressHealth: true</code> and real Firebase fields.</li>
          </ol>
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100"
        >
          <p className="m-0 font-medium">Could not load your document list</p>
          <p className="mt-1 mb-0 text-xs opacity-95">{loadError}</p>
        </div>
      ) : null}

      {!loadError && !adminConfigured ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-50"
        >
          <p className="m-0 font-semibold">Saved PDFs needs Firebase Admin on your API</p>
          <p className="mt-2 mb-0 text-xs leading-relaxed opacity-95">
            {adminSetupMessage ||
              'The server cannot verify your ID token or write to Firestore until you add a service account.'}
          </p>
          <ol className="mt-3 mb-0 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
            <li>
              Firebase Console → Project settings → Service accounts → <strong>Generate new private key</strong>{' '}
              (JSON file).
            </li>
            <li>
              On <strong>Render</strong> (or your host): open the <strong>API</strong> web service → Environment → add{' '}
              <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/70">FIREBASE_SERVICE_ACCOUNT_JSON</code>{' '}
              with the <strong>entire JSON on one line</strong> (Render “secret” / multiline env).
            </li>
            <li>
              In the same Firebase project, enable <strong>Firestore</strong> (Create database, production mode is fine).
            </li>
            <li>Redeploy or restart the API, then click Refresh here.</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber-400/30 pt-3 dark:border-amber-700/40">
            <button
              type="button"
              disabled={healthBusy}
              onClick={() => void probeApiHealth()}
              className="fx-focus-ring rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              {healthBusy ? 'Checking API…' : 'Run API diagnostics'}
            </button>
            <a
              href={apiUrl('/health')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950 dark:text-amber-100 dark:hover:text-white"
            >
              Open /health in new tab
            </a>
            {import.meta.env.PROD && !isApiBaseConfigured() ? (
              <span className="text-xs text-amber-900/90 dark:text-amber-100/90">
                Production build has no <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/70">VITE_API_BASE_URL</code> — diagnostics use this site’s origin; set the API URL at build time so Saved PDFs hits the same host where you added the key.
              </span>
            ) : null}
          </div>
          {healthProbe ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-amber-900/10 p-2 text-[11px] leading-snug text-amber-950 dark:bg-black/25 dark:text-amber-50">
              {JSON.stringify(
                healthProbe.error
                  ? healthProbe
                  : {
                      resolvedApiBase: healthProbe.resolvedApiBase,
                      requestUrl: healthProbe.url,
                      absoluteUrl: healthProbe.absoluteUrl,
                      httpStatus: healthProbe.status,
                      looksLikeExpressHealth: healthProbe.looksLikeExpressHealth,
                      firebaseServiceAccountEnvSet: healthProbe.json?.firebaseServiceAccountEnvSet,
                      firebaseAdminReady: healthProbe.json?.firebaseAdminReady,
                      firebaseAdminHint: healthProbe.json?.firebaseAdminHint,
                      projectOk: healthProbe.json?.ok,
                      parseError: healthProbe.json?.parseError,
                    },
                null,
                2
              )}
            </pre>
          ) : null}
        </div>
      ) : null}

      {docs.length === 0 && !loadError ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
          <FileText className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">No saved documents yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-600 dark:text-zinc-400">
            Stay <strong>signed in</strong>, open <strong>Edit PDF</strong>, upload a PDF, then use <strong>Save PDF</strong> in the
            Edits panel. The API records each session in your library (Firestore). If the list stays empty after saving,
            confirm the API has <strong>Firebase Admin</strong> configured and <strong>Firestore</strong> enabled for the
            same project.
          </p>
          <Link
            to="/tools/edit-pdf"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            Go to Edit PDF
          </Link>
        </div>
      ) : null}

      {docs.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                >
                  <td className="max-w-[14rem] truncate px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100" title={row.fileName}>
                    {row.fileName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {libraryToolLabel(row.tool)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatWhen(row.updatedAt || row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={busyId === row.sessionId}
                        title="Re-open in editor"
                        className="fx-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => openInEditor(row.sessionId, row.fileName)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.sessionId}
                        title="Rename in library"
                        className="fx-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => renameOne(row.sessionId, row.fileName)}
                      >
                        <FilePenLine className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Rename</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.sessionId}
                        title="Save a server copy and open it"
                        className="fx-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => duplicateOne(row.sessionId, row.fileName)}
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Save a copy</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.sessionId}
                        title="Download PDF"
                        className="fx-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => downloadOne(row.sessionId, row.fileName)}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Download</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.sessionId}
                        title="Remove from library"
                        className="fx-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => removeOne(row.sessionId)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Remove</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <UpgradePlanModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onPaid={() => void refreshSubscription()}
      />
    </ToolPageShell>
  )
}

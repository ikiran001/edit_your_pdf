import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, FilePenLine, FileText, Pencil, RefreshCw, Trash2, Download } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { isFirebaseConfigured, isFirebaseAuthReady } from '../../lib/firebase.js'
import { isApiBaseConfigured } from '../../lib/apiBase.js'
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
  const [loadingList, setLoadingList] = useState(false)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const { refresh: refreshSubscription } = useSubscription()

  const fbReady = isFirebaseConfigured() && isFirebaseAuthReady()

  const loadLibrary = useCallback(async () => {
    if (!user?.uid || !fbReady) return
    setLoadingList(true)
    setLoadError(null)
    try {
      const r = await fetchUserLibraryFromServer({ getFreshIdToken })
      if (!r.ok) {
        setDocs([])
        setAdminConfigured(true)
        const hint =
          r.status === 503
            ? `${r.error} The document service is temporarily unavailable — try again later.`
            : r.error
        setLoadError(hint)
        return
      }
      setDocs(r.documents)
      const ac = r.adminConfigured !== false
      setAdminConfigured(ac)
    } catch (e) {
      setDocs([])
      setAdminConfigured(true)
      setLoadError(e?.message || 'Could not load documents.')
    } finally {
      setLoadingList(false)
    }
  }, [user?.uid, fbReady, getFreshIdToken])

  useEffect(() => {
    if (!user?.uid || !fbReady) {
      setDocs([])
      setLoadError(null)
      setAdminConfigured(true)
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
              ? 'Renaming is not available right now. Try again later.'
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
              ? 'Copy is not available right now. Try again later.'
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
          Sign-in is not available in this build. Try the main site or another browser profile.
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
          className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
        >
          <p className="m-0 leading-relaxed">
            Saved PDFs can&apos;t reach the document service from this site. Check your connection and try again later.
          </p>
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
          <p className="m-0 leading-relaxed">
            Cloud library sync isn&apos;t available on this deployment. Try again later or use Download from the editor
            to keep a local copy.
          </p>
        </div>
      ) : null}

      {docs.length === 0 && !loadError ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
          <FileText className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">No saved documents yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-600 dark:text-zinc-400">
            Stay <strong>signed in</strong>, open <strong>Edit PDF</strong>, upload a PDF, then use <strong>Save PDF</strong> in the
            Edits panel. Your saved files will appear here.
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

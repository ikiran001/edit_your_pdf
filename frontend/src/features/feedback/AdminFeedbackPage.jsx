import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { isFeedbackApiReachable } from '../../lib/apiBase.js'
import {
  adminDeleteFeedbackReview,
  adminFetchFeedbackReviews,
  adminSubmitFeedbackReview,
  getStoredFeedbackAdminToken,
  setStoredFeedbackAdminToken,
} from '../../lib/feedbackApi.js'

function formatReviewDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return ''
  }
}

export default function AdminFeedbackPage() {
  useEffect(() => {
    const m = document.createElement('meta')
    m.setAttribute('name', 'robots')
    m.setAttribute('content', 'noindex,nofollow')
    document.head.appendChild(m)
    return () => {
      m.remove()
    }
  }, [])

  const reachable = isFeedbackApiReachable()
  const [token, setToken] = useState(() => getStoredFeedbackAdminToken())
  const [remember, setRemember] = useState(() => Boolean(getStoredFeedbackAdminToken()))

  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [listState, setListState] = useState('idle')
  const [listError, setListError] = useState(null)

  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [source, setSource] = useState('admin')
  const [addState, setAddState] = useState('idle')
  const [addError, setAddError] = useState(null)

  const persistToken = useCallback(
    (nextTok, nextRemember) => {
      if (nextRemember && nextTok.trim()) {
        setStoredFeedbackAdminToken(nextTok.trim())
      } else {
        setStoredFeedbackAdminToken('')
      }
    },
    []
  )

  const loadList = useCallback(async () => {
    const t = token.trim()
    if (!t) {
      setListError('Enter the admin secret first.')
      return
    }
    setListState('loading')
    setListError(null)
    const r = await adminFetchFeedbackReviews(t)
    if (!r.ok) {
      setListState('error')
      setListError(r.error)
      setList([])
      setTotal(0)
      return
    }
    setListState('ok')
    setList(r.reviews)
    setTotal(r.total)
    if (remember) persistToken(t, true)
  }, [token, remember, persistToken])

  const onAdd = async (e) => {
    e.preventDefault()
    const t = token.trim()
    if (!t) {
      setAddError('Enter the admin secret first.')
      return
    }
    setAddState('loading')
    setAddError(null)
    const r = await adminSubmitFeedbackReview(t, {
      name: name.trim() || undefined,
      rating,
      text: text.trim(),
      source: source.trim() || 'admin',
    })
    if (!r.ok) {
      setAddState('error')
      setAddError(r.error)
      return
    }
    setAddState('ok')
    setText('')
    if (remember) persistToken(t, true)
    await loadList()
    setTimeout(() => setAddState('idle'), 1500)
  }

  const onDelete = async (id) => {
    if (!window.confirm('Delete this review permanently?')) return
    const t = token.trim()
    const r = await adminDeleteFeedbackReview(t, id)
    if (!r.ok) {
      setListError(r.error)
      return
    }
    await loadList()
  }

  return (
    <ToolPageShell
      title="Feedback admin"
      subtitle="Unlisted page — set FEEDBACK_ADMIN_SECRET on the API, then use the same value here."
    >
      <div className="space-y-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Public reviews still appear on{' '}
          <Link className="text-indigo-600 underline dark:text-cyan-400" to="/feedback">
            /feedback
          </Link>{' '}
          (newest first, capped). This page lists every stored row and lets you add a curated entry or remove spam.
        </p>

        {!reachable ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Feedback API is not reachable from this build (configure the API base URL for production).
          </p>
        ) : null}

        <section className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/40 md:p-6">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Admin secret</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Same value as server env <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">FEEDBACK_ADMIN_SECRET</code>
            . Never commit it to the frontend repo; paste it here when needed.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Bearer token</span>
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="Paste FEEDBACK_ADMIN_SECRET"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  const next = e.target.checked
                  setRemember(next)
                  if (!next) setStoredFeedbackAdminToken('')
                }}
              />
              Remember for this browser session
            </label>
            <button
              type="button"
              disabled={!reachable || listState === 'loading'}
              onClick={loadList}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50 dark:bg-cyan-700 dark:hover:bg-cyan-600"
            >
              {listState === 'loading' ? 'Loading…' : 'Load all reviews'}
            </button>
          </div>
          {listError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{listError}</p> : null}
          {listState === 'ok' ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {total} total in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">site-feedback.json</code>
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/40 md:p-6">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Add a review (e.g. testimonial)</h2>
          <form onSubmit={onAdd} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Display name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                maxLength={80}
              />
            </label>
            <label className="block text-sm md:col-span-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Source tag (optional)</span>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                maxLength={40}
                placeholder="admin"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Rating (1–5)</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Text</span>
              <textarea
                required
                minLength={4}
                maxLength={2000}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!reachable || addState === 'loading'}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
              >
                {addState === 'loading' ? 'Saving…' : addState === 'ok' ? 'Saved' : 'Post review'}
              </button>
              {addError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{addError}</p> : null}
            </div>
          </form>
        </section>

        {list.length > 0 ? (
          <section className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white/60 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/40">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/80">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">When</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">★</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Src</th>
                  <th className="min-w-[12rem] px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Text</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300"> </th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {formatReviewDate(row.createdAt)}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2 text-zinc-800 dark:text-zinc-200">
                      {row.name || '—'}
                    </td>
                    <td className="px-3 py-2">{row.rating}</td>
                    <td className="max-w-[6rem] truncate px-3 py-2 text-zinc-500">{row.source || '—'}</td>
                    <td className="max-w-xl px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      <span className="line-clamp-3">{row.text}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : listState === 'ok' ? (
          <p className="text-sm text-zinc-500">No reviews stored yet.</p>
        ) : null}
      </div>
    </ToolPageShell>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { BRAND_NAME } from '../../shared/constants/branding.js'
import { fetchFeedbackReviews, submitFeedbackReview } from '../../lib/feedbackApi.js'
import { isApiBaseConfigured, isFeedbackApiReachable } from '../../lib/apiBase.js'
import { consumeFeedbackPrompt } from '../../lib/reviewPromptStorage.js'

function formatReviewDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d)
  } catch {
    return ''
  }
}

function StarRow({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Rating</span>
      <div className="flex gap-1" role="group" aria-label="Star rating, 1 to 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`Set rating to ${n} out of 5`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className="fx-focus-ring rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950/30"
          >
            <Star
              className={`h-7 w-7 ${n <= value ? 'fill-current' : 'fill-none'}`}
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const [searchParams] = useSearchParams()
  const [submitSource, setSubmitSource] = useState(() =>
    searchParams.get('from') === 'download' ? 'post_download' : 'home'
  )

  const [reviews, setReviews] = useState([])
  const [loadState, setLoadState] = useState('idle')
  const [loadError, setLoadError] = useState(null)

  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitOk, setSubmitOk] = useState(false)

  const feedbackReachable = isFeedbackApiReachable()
  const showProdApiHint = import.meta.env.PROD && !isApiBaseConfigured()

  useEffect(() => {
    if (consumeFeedbackPrompt()) {
      queueMicrotask(() => setSubmitSource('post_download'))
    }
  }, [])

  const load = useCallback(async () => {
    if (!feedbackReachable) {
      setLoadState('skipped')
      setReviews([])
      return
    }
    setLoadState('loading')
    setLoadError(null)
    const r = await fetchFeedbackReviews()
    if (!r.ok) {
      setLoadState('error')
      setLoadError(r.error === 'no_api' ? 'no_api' : r.error)
      setReviews([])
      return
    }
    setReviews(r.reviews)
    setLoadState('ready')
  }, [feedbackReachable])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitOk(false)
    if (!feedbackReachable) {
      setSubmitError('Feedback is unavailable until this site is connected to the pdfpilot API.')
      return
    }
    if (rating < 1 || rating > 5) {
      setSubmitError('Please tap a star rating from 1 to 5.')
      return
    }
    const trimmed = text.trim()
    if (trimmed.length < 4) {
      setSubmitError('Please write a few more words (at least 4 characters).')
      return
    }
    setSubmitting(true)
    const r = await submitFeedbackReview({
      name: name.trim() || undefined,
      rating,
      text: trimmed,
      source: submitSource,
    })
    setSubmitting(false)
    if (!r.ok) {
      setSubmitError(r.error || 'Could not send feedback.')
      return
    }
    setSubmitOk(true)
    setName('')
    setRating(0)
    setText('')
    void load()
  }

  return (
    <ToolPageShell
      title="Share your feedback"
      subtitle={`Tell us how ${BRAND_NAME} worked for you — we never invent reviews.`}
    >
        {submitSource === 'post_download' ? (
          <p className="mb-6 rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-4 py-3 text-center text-sm text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100">
            Thanks for downloading — if you have a moment, a quick rating helps us improve.
          </p>
        ) : null}

        {showProdApiHint ? (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Feedback is saved on the pdfpilot API. Add your API URL (for example in GitHub Actions secrets or
            pilot-api-runtime.js) so this production build can reach your backend.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-5">
          <div>
            <label
              htmlFor="feedback-page-name"
              className="mb-1.5 block text-left text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              id="feedback-page-name"
              type="text"
              name="name"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Alex"
              className="fx-focus-ring w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <StarRow value={rating} onChange={setRating} disabled={submitting} />
          </div>

          <div>
            <label
              htmlFor="feedback-page-text"
              className="mb-1.5 block text-left text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Your experience
            </label>
            <textarea
              id="feedback-page-text"
              name="feedback"
              required
              rows={4}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
              placeholder="What went well? What could be better?"
              className="fx-focus-ring w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{text.length}/2000</p>
          </div>

          {submitError ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}
          {submitOk ? (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
              role="status"
            >
              Thanks — your feedback was posted.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !feedbackReachable}
            className="fx-focus-ring w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            {submitting ? 'Sending…' : 'Submit feedback'}
          </button>
        </form>

        <div className="mx-auto mt-12 max-w-xl border-t border-zinc-200 pt-8 dark:border-zinc-700">
          <h2 className="m-0 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            What others said
          </h2>

          {loadState === 'loading' ? (
            <p className="mt-6 text-center text-sm text-zinc-500">Loading…</p>
          ) : loadState === 'error' ? (
            <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Reviews could not be loaded ({loadError}). You can try again later.
            </p>
          ) : reviews.length === 0 ? (
            <p className="mt-6 text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              No reviews yet — be the first to share your experience.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {reviews.map((rev) => (
                <li
                  key={rev.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/90 px-4 py-3 text-left dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {rev.name?.trim() || 'Anonymous'}
                    </p>
                    <time className="text-xs text-zinc-500 dark:text-zinc-400" dateTime={rev.createdAt}>
                      {formatReviewDate(rev.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 flex gap-0.5 text-amber-500" aria-label={`${rev.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < rev.rating ? 'fill-current' : 'fill-none opacity-30'}`}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    ))}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {rev.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-10 text-center text-sm">
          <Link
            to="/"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            ← Back to tools
          </Link>
        </p>
    </ToolPageShell>
  )
}

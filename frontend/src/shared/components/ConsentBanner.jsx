import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getStoredConsent, setConsent } from '../../lib/consent.js'

/**
 * Cookie / personalised-ads consent banner (Google Consent Mode v2).
 *
 * Shows once until the visitor chooses. "Accept" grants ad + analytics storage;
 * "Decline" keeps the denied defaults. The choice is stored in localStorage and
 * pushed to gtag via setConsent(). Mounted once, site-wide.
 */
export default function ConsentBanner() {
  const { t } = useTranslation()
  // Show once until the visitor has made a choice (read synchronously; this is a
  // client-rendered SPA, and the prerenderer runs in a real browser).
  const [visible, setVisible] = useState(() => !getStoredConsent())

  if (!visible) return null

  const choose = (choice) => {
    setConsent(choice)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.title')}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-200 bg-white/95 px-4 py-4 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/95"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {t('consent.message')}{' '}
          <Link
            to="/privacy"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400"
          >
            {t('consent.learnMore')}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('essential')}
            className="fx-focus-ring rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t('consent.decline')}
          </button>
          <button
            type="button"
            onClick={() => choose('all')}
            className="fx-focus-ring rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}

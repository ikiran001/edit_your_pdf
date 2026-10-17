import { useState } from 'react'
import { Check, Link2, MessageCircle, Share2 } from 'lucide-react'
import { trackFeatureUsed } from '../../lib/analytics.js'

const SITE_URL = String(import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

function siteUrl() {
  if (SITE_URL) return SITE_URL
  if (typeof window !== 'undefined' && window.location) return window.location.origin
  return 'https://pdfpilot.pro'
}

const DEFAULT_MESSAGE = 'Free online PDF tools — edit, compress, convert, sign & GST invoices:'

/**
 * Social share row (WhatsApp, X, Facebook, copy link, native share).
 * Purely additive; safe to drop anywhere.
 *
 * @param {{ message?: string, label?: string, className?: string }} props
 */
export default function ShareTools({ message = DEFAULT_MESSAGE, label, className = '' }) {
  const [copied, setCopied] = useState(false)
  const url = siteUrl()
  const text = `${message} ${url}`

  const open = (href, where) => {
    trackFeatureUsed(`share_${where}`)
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const nativeShare = async () => {
    trackFeatureUsed('share_native')
    try {
      await navigator.share({ title: 'pdfpilot', text: message, url })
    } catch {
      /* user cancelled — ignore */
    }
  }

  const copy = async () => {
    trackFeatureUsed('share_copy')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const btn =
    'fx-focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition'
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className={className}>
      {label ? (
        <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => open(`https://wa.me/?text=${encodeURIComponent(text)}`, 'whatsapp')}
          className={`${btn} border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300`}
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() =>
            open(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
              'twitter'
            )
          }
          className={`${btn} border-zinc-400/40 bg-zinc-500/10 text-zinc-700 hover:bg-zinc-500/20 dark:text-zinc-200`}
        >
          <span className="text-sm font-bold leading-none">𝕏</span>
          Post
        </button>
        <button
          type="button"
          onClick={() =>
            open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, 'facebook')
          }
          className={`${btn} border-blue-500/40 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300`}
        >
          <span className="text-sm font-bold leading-none">f</span>
          Facebook
        </button>
        <button
          type="button"
          onClick={copy}
          className={`${btn} border-indigo-500/40 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300`}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        {canNativeShare ? (
          <button
            type="button"
            onClick={nativeShare}
            className={`${btn} border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 hover:bg-fuchsia-500/20 dark:text-fuchsia-300`}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share
          </button>
        ) : null}
      </div>
    </div>
  )
}

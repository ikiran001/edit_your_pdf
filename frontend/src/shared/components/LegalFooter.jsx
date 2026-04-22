import { Link } from 'react-router-dom'
import { BRAND_NAME } from '../constants/branding.js'

/**
 * Site-wide legal links (Terms; Privacy placeholder until a policy page exists).
 */
export default function LegalFooter({ className = '' }) {
  return (
    <footer
      className={`mt-auto border-t border-indigo-200/40 bg-white/40 px-4 py-8 text-center text-xs text-zinc-500 dark:border-indigo-500/15 dark:bg-zinc-950/40 dark:text-zinc-400 ${className}`}
    >
      <p className="m-0 font-medium text-zinc-600 dark:text-zinc-300">© {new Date().getFullYear()} {BRAND_NAME}</p>
      <p className="mt-3 mb-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
        <span className="cursor-default rounded-md px-1.5 py-1 text-zinc-500 dark:text-zinc-400" title="Coming soon">
          Privacy
        </span>
        <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <Link
          to="/feedback"
          className="fx-focus-ring rounded-md px-2 py-1.5 font-medium text-indigo-600 underline-offset-2 hover:bg-indigo-50 hover:underline dark:text-cyan-400 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
        >
          Share feedback
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <Link
          to="/terms"
          className="fx-focus-ring rounded-md px-2 py-1.5 font-medium text-indigo-600 underline-offset-2 hover:bg-indigo-50 hover:underline dark:text-cyan-400 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
        >
          Terms of Service
        </Link>
      </p>
    </footer>
  )
}

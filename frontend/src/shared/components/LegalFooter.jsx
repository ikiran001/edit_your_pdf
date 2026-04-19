import { Link } from 'react-router-dom'
import { BRAND_NAME } from '../constants/branding.js'

/**
 * Site-wide legal links (Terms; Privacy placeholder until a policy page exists).
 */
export default function LegalFooter({ className = '' }) {
  return (
    <footer
      className={`mt-auto border-t border-indigo-200/40 bg-white/40 px-4 py-6 text-center text-xs text-zinc-500 dark:border-indigo-500/15 dark:bg-zinc-950/40 dark:text-zinc-400 ${className}`}
    >
      <p className="m-0 font-medium text-zinc-600 dark:text-zinc-300">© {new Date().getFullYear()} {BRAND_NAME}</p>
      <p className="mt-2 mb-0">
        <span className="cursor-default" title="Coming soon">
          Privacy
        </span>
        {' · '}
        <Link
          to="/terms"
          className="text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          Terms of Service
        </Link>
      </p>
    </footer>
  )
}

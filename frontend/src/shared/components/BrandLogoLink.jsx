import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { BRAND_NAME } from '../constants/branding.js'

/**
 * Navbar brand: [PDF icon] TheBestPDF → home. Compact, no layout shift.
 */
export default function BrandLogoLink({ className = '' }) {
  return (
    <Link
      to="/"
      className={`flex shrink-0 items-center gap-2 rounded-lg outline-none ring-indigo-500/30 transition hover:opacity-90 focus-visible:ring-2 ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-md shadow-indigo-500/30 dark:shadow-[0_0_20px_rgba(99,102,241,0.35)]">
        <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <span className="truncate font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {BRAND_NAME}
      </span>
    </Link>
  )
}

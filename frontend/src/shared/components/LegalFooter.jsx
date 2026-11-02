import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Site-wide legal and trust links (About, Blog, Contact, Privacy, Terms).
 */
export default function LegalFooter({ className = '' }) {
  const { t } = useTranslation()
  const linkCls =
    'fx-focus-ring rounded-md px-2 py-1.5 font-medium text-indigo-600 underline-offset-2 hover:bg-indigo-50 hover:underline dark:text-cyan-400 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300'
  const dot = (
    <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
      ·
    </span>
  )
  return (
    <footer
      className={`mt-auto border-t border-indigo-200/40 bg-white/40 px-4 py-8 text-center text-xs text-zinc-500 dark:border-indigo-500/15 dark:bg-zinc-950/40 dark:text-zinc-400 ${className}`}
    >
      <p className="m-0 font-medium text-zinc-600 dark:text-zinc-300">
        {t('footer.copyright', { year: new Date().getFullYear() })}
      </p>
      <p className="mt-3 mb-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
        <Link to="/about" className={linkCls}>
          {t('footer.about')}
        </Link>
        {dot}
        <Link to="/blog" className={linkCls}>
          {t('footer.blog')}
        </Link>
        {dot}
        <Link to="/contact" className={linkCls}>
          {t('footer.contact')}
        </Link>
        {dot}
        <Link to="/feedback" className={linkCls}>
          {t('footer.shareFeedback')}
        </Link>
        {dot}
        <Link to="/privacy" className={linkCls}>
          {t('footer.privacy')}
        </Link>
        {dot}
        <Link to="/terms" className={linkCls}>
          {t('footer.terms')}
        </Link>
      </p>
    </footer>
  )
}

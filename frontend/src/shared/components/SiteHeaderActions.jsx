import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useAuthModal } from '../../auth/AuthModalContext.jsx'
import AccountMenu from './AccountMenu.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import NineDotMenu from './NineDotMenu.jsx'

/**
 * Toolkit / tool shell header actions: apps menu, auth, theme.
 * Guest: Log in, Sign up, 9-dot menu. Signed-in: Account menu, 9-dot menu.
 */
export default function SiteHeaderActions({ compactAccount = false }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const { openAuth } = useAuthModal()

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <NineDotMenu />
      {user ? (
        <AccountMenu compact={compactAccount} />
      ) : (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => openAuth('signin')}
            className="fx-focus-ring rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white sm:px-3 sm:text-sm"
          >
            {loading ? '…' : t('header.login')}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => openAuth('signup')}
            className="fx-focus-ring rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-50 dark:bg-rose-600 dark:hover:bg-rose-500 sm:px-3 sm:text-sm"
          >
            {t('header.signUp')}
          </button>
        </>
      )}
      <ThemeToggle />
    </div>
  )
}

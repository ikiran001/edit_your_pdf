import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      className="fx-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200/80 bg-white text-zinc-700 shadow-sm shadow-indigo-500/10 transition hover:border-cyan-400/60 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.97] dark:border-indigo-500/30 dark:bg-zinc-900/95 dark:text-cyan-100 dark:shadow-[0_0_20px_rgba(99,102,241,0.2)] dark:hover:border-cyan-400/40"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  )
}

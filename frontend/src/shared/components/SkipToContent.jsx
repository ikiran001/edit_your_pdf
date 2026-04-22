/**
 * First focusable control on every page — jumps past chrome to `#site-main` (keyboard / AT).
 */
export default function SkipToContent() {
  return (
    <a
      href="#site-main"
      className="fx-focus-ring fixed left-4 top-0 z-[10060] -translate-y-full rounded-b-xl border border-t-0 border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-md transition-transform duration-200 focus:translate-y-0 dark:border-indigo-500/40 dark:bg-zinc-900 dark:text-cyan-50"
    >
      Skip to main content
    </a>
  )
}

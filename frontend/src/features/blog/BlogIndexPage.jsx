import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { BLOG_POSTS } from '../../content/blogPosts.js'

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d)
  } catch {
    return iso
  }
}

export default function BlogIndexPage() {
  useEffect(() => {
    document.title = 'PDF Tips & Guides | pdfpilot Blog'
  }, [])

  return (
    <ToolPageShell
      title="Blog"
      subtitle="Practical PDF guides, how-tos, and India-specific tips."
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            PDF tips &amp; guides
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Short, practical walkthroughs for everyday PDF tasks — compressing for government uploads,
            GST invoices, converting to Word, OCR, and more. Every guide links straight to a free tool.
          </p>
        </header>

        <ul className="space-y-4">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                to={`/blog/${post.slug}`}
                className="fx-focus-ring group block rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-indigo-500/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {post.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-zinc-900 group-hover:text-indigo-700 dark:text-zinc-50 dark:group-hover:text-indigo-300">
                  {post.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {formatDate(post.date)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {post.readMins} min read
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-cyan-400">
                    Read
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ToolPageShell>
  )
}

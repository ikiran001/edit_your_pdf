import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Wrench } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { getBlogPost } from '../../content/blogPosts.js'

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d)
  } catch {
    return iso
  }
}

function Block({ block }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-8 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {block.text}
        </h2>
      )
    case 'h3':
      return (
        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-100">{block.text}</h3>
      )
    case 'p':
      return <p className="mt-4 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{block.text}</p>
    case 'ul':
      return (
        <ul className="mt-4 list-disc space-y-2 pl-6 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          {block.items.map((it, i) => (
            <li key={i} className="pl-1">
              {it}
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          {block.items.map((it, i) => (
            <li key={i} className="pl-1">
              {it}
            </li>
          ))}
        </ol>
      )
    case 'note':
      return (
        <p className="mt-5 rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-4 py-3 text-sm leading-relaxed text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100">
          {block.text}
        </p>
      )
    case 'cta':
      return (
        <div className="mt-5">
          <Link
            to={block.path}
            className="fx-focus-ring inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {block.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )
    default:
      return null
  }
}

export default function BlogPostPage() {
  const { slug } = useParams()
  const post = getBlogPost(slug)

  useEffect(() => {
    if (post) document.title = `${post.title} | pdfpilot Blog`
  }, [post])

  if (!post) return <Navigate to="/blog" replace />

  return (
    <ToolPageShell title="Blog" subtitle={post.title}>
      <article className="mx-auto max-w-2xl">
        <Link
          to="/blog"
          className="fx-focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-600 hover:underline dark:text-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All guides
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {post.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          {post.title}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {formatDate(post.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {post.readMins} min read
          </span>
        </div>

        <div className="mt-2">
          {post.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        {post.relatedTools?.length ? (
          <aside className="fx-reveal mt-10 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <Wrench className="h-4 w-4 text-indigo-600 dark:text-cyan-400" aria-hidden />
              Tools used in this guide
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {post.relatedTools.map((tool) => (
                <li key={tool.path}>
                  <Link
                    to={tool.path}
                    className="fx-focus-ring inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-sm font-medium text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
                  >
                    {tool.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </article>
    </ToolPageShell>
  )
}

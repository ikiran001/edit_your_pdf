import { Check } from 'lucide-react'
import { TOOL_SEO_BY_ID } from '../constants/toolSeoContent.js'

/**
 * SEO-friendly intro + how-to + benefits + highlight cards for toolkit pages.
 * Collapsed by default; expands via a native details/summary control (“How to use?”).
 * @param {{ toolId: string }} props — must match `TOOL_REGISTRY` id (e.g. `merge-pdf`)
 */
export default function ToolFeatureSeoSection({ toolId }) {
  const c = TOOL_SEO_BY_ID[toolId]
  if (!c) return null

  const slug = `tool-seo-${toolId}`

  return (
    <article className="mb-8" aria-label={`About ${c.featureName}`}>
      <details className="rounded-2xl border border-zinc-200 bg-white/70 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-indigo-700 outline-none transition hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-indigo-300 dark:hover:bg-zinc-800/50 dark:focus-visible:ring-offset-zinc-950 [&::-webkit-details-marker]:hidden">
          How to use?
        </summary>

        <div className="space-y-8 border-t border-zinc-200 px-5 pb-5 pt-5 dark:border-zinc-700">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <div id={`${slug}-intro`} className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {c.intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {c.steps.map((step, i) => (
                <li key={i} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>

            <h2 className="mt-6 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Why use {c.featureName}?
            </h2>
            <ul className="mt-3 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
              {c.benefits.map((b, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-cyan-950/60 dark:text-cyan-300"
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{b.title}</span>
                    <span className="mt-0.5 block text-zinc-600 dark:text-zinc-400">{b.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Key features</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.highlights.map((h, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
                >
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{h.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{h.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </article>
  )
}

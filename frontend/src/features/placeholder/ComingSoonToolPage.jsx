import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'

export default function ComingSoonToolPage({ title, children }) {
  return (
    <ToolPageShell title={title} subtitle="Planned for a future release">
      <div className="rounded-2xl border border-indigo-200/70 bg-white/90 p-8 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/5 dark:border-indigo-500/20 dark:bg-zinc-950/80 dark:shadow-[0_0_40px_-12px_rgba(99,102,241,0.2)] dark:ring-indigo-400/10">
        <p className="text-zinc-700 dark:text-zinc-300">
          {children ||
            'This conversion usually needs a trusted server (e.g. LibreOffice or a document API). We will add it in a dedicated service module so the rest of the toolkit stays independent.'}
        </p>
        <Link
          to="/tools/edit-pdf"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Use Edit PDF in the meantime →
        </Link>
      </div>
    </ToolPageShell>
  )
}

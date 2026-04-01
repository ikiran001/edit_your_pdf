import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'

export default function ComingSoonToolPage({ title, children }) {
  return (
    <ToolPageShell title={title} subtitle="Planned for a future release">
      <div className="rounded-2xl border border-zinc-200 bg-white/90 p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
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

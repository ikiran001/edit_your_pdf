/**
 * Decorative, always-on animated aurora behind all content.
 *
 * Fixed, pointer-events-none, z-index:-1 (see .fx-anim-bg) so it never
 * intercepts clicks or covers interactive UI — it only shows through the
 * transparent gutters/margins of pages. Purely visual; safe to mount once at
 * the app root. Motion stops under prefers-reduced-motion.
 */
export default function AnimatedBackground() {
  return (
    <div className="fx-anim-bg" aria-hidden>
      <div className="fx-blob fx-blob-a absolute -left-[10%] -top-[10%] h-[48vmax] w-[48vmax] bg-[radial-gradient(circle,rgba(99,102,241,0.9),transparent_65%)]" />
      <div className="fx-blob fx-blob-b absolute -right-[12%] top-[8%] h-[42vmax] w-[42vmax] bg-[radial-gradient(circle,rgba(244,63,94,0.8),transparent_65%)]" />
      <div className="fx-blob fx-blob-c absolute bottom-[-12%] left-[18%] h-[46vmax] w-[46vmax] bg-[radial-gradient(circle,rgba(34,211,238,0.8),transparent_65%)]" />
      <div className="fx-blob fx-blob-a absolute bottom-[-8%] right-[10%] h-[38vmax] w-[38vmax] bg-[radial-gradient(circle,rgba(217,70,239,0.75),transparent_65%)]" />
    </div>
  )
}

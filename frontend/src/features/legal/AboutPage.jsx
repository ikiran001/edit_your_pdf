import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import { BRAND_NAME, LEGAL_CONTACT_EMAIL } from '../../shared/constants/branding.js'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  )
}

export default function AboutPage() {
  const mail = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(`${BRAND_NAME} — Hello`)}`
  const link = 'font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400'

  return (
    <ToolPageShell title={`About ${BRAND_NAME}`} subtitle="A free, privacy-first online PDF toolkit">
      <article className="max-w-3xl">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          <strong>{BRAND_NAME}</strong> is a free online PDF toolkit with more than 40 tools to edit, convert, compress,
          merge, split, sign, protect, and organise PDF files — all from your browser. We built it because the everyday
          job of wrangling a PDF shouldn’t mean installing heavy software, creating an account, or uploading private
          documents to a site you don’t trust.
        </p>

        <Section title="What we do">
          <p>
            From a single toolkit you can shrink a scan to fit a government upload limit, combine certificates into one
            file for a job or visa application, turn a PDF into an editable Word document, run OCR on a scanned document,
            add a signature without printing, generate a GST-ready invoice, and much more. Each tool is purpose-built to
            do one job cleanly rather than bury you in options.
          </p>
        </Section>

        <Section title="Privacy first">
          <p>
            Many of our tools run entirely inside your browser, which means the file never leaves your device. Tools that
            genuinely need server processing work on your file only for as long as the task takes and do not keep it
            afterwards. You keep the original; we keep nothing we don’t need. You can read the full details in our{' '}
            <Link to="/privacy" className={link}>
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <Section title="Built for India (and everyone)">
          <p>
            {BRAND_NAME} is tuned for the paperwork people in India deal with every day — compressing PDFs to the exact
            100KB–500KB limits that UIDAI, SSC, UPSC, and state portals enforce; generating GST invoices with automatic
            CGST/SGST or IGST splits; and running OCR in both English and Hindi. The same tools work just as well for
            anyone, anywhere.
          </p>
        </Section>

        <Section title="Free to use">
          <p>
            The core toolkit is free. A small number of heavier, server-side tools have a generous daily limit for
            signed-out users, and an optional Pro plan removes the cap for people who process documents in bulk — so a
            one-off task never costs you anything.
          </p>
        </Section>

        <Section title="Learn more">
          <p>
            New to a tool? Our{' '}
            <Link to="/blog" className={link}>
              blog
            </Link>{' '}
            has practical, step-by-step guides for common tasks. Have a question or suggestion? We’d love to hear it —
            email{' '}
            <a href={mail} className={link}>
              {LEGAL_CONTACT_EMAIL}
            </a>{' '}
            or visit our{' '}
            <Link to="/contact" className={link}>
              contact page
            </Link>
            .
          </p>
        </Section>

        <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
          <Link to="/" className={link}>
            Back to {BRAND_NAME}
          </Link>
        </p>
      </article>
    </ToolPageShell>
  )
}

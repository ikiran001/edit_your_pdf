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

export default function ContactPage() {
  const mail = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(`${BRAND_NAME} — Enquiry`)}`
  const link = 'font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400'

  return (
    <ToolPageShell title={`Contact ${BRAND_NAME}`} subtitle="We’d love to hear from you">
      <article className="max-w-3xl">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Have a question, a bug to report, a feature idea, or a privacy request? Get in touch — we read everything and
          try to reply promptly.
        </p>

        <Section title="Email us">
          <p>
            The fastest way to reach us is by email:{' '}
            <a href={mail} className={link}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            . Please include enough detail (what you were doing, which tool, and what happened) so we can help without a
            lot of back-and-forth.
          </p>
        </Section>

        <Section title="What to contact us about">
          <ul className="list-disc space-y-2 pl-5">
            <li>Support — a tool isn’t working the way you expected.</li>
            <li>Feedback and feature requests — tell us what would make {BRAND_NAME} better.</li>
            <li>Privacy requests — access, correction, or deletion of your data.</li>
            <li>Business and partnership enquiries.</li>
          </ul>
        </Section>

        <Section title="Share quick feedback">
          <p>
            Prefer a quick note instead of an email? Use our{' '}
            <Link to="/feedback" className={link}>
              feedback page
            </Link>{' '}
            to send a rating and comment in a few seconds.
          </p>
        </Section>

        <Section title="Privacy and terms">
          <p>
            For how we handle your data, see our{' '}
            <Link to="/privacy" className={link}>
              Privacy Policy
            </Link>
            , and for the rules of using the Service, see our{' '}
            <Link to="/terms" className={link}>
              Terms of Service
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

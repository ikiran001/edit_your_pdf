import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import {
  BRAND_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  LEGAL_GOVERNING_COURTS,
  LEGAL_GOVERNING_LAW_PLACE,
  TERMS_LAST_UPDATED,
} from '../../shared/constants/branding.js'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  )
}

export default function TermsOfServicePage() {
  const mail = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(`${BRAND_NAME} — Terms question`)}`

  return (
    <ToolPageShell title="Terms of Service" subtitle={`Last updated ${TERMS_LAST_UPDATED}`}>
      <article className="max-w-3xl">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          These Terms of Service (“Terms”) govern access to and use of the website, applications, and PDF-related tools
          offered under the name <strong>{BRAND_NAME}</strong> (“Service”). By using the Service, you agree to these
          Terms. If you do not agree, do not use the Service.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Laws differ by country and region. These Terms are written so that{' '}
          <strong>mandatory rules where you live</strong> (for example consumer, privacy, or non-waivable liability
          rules) still apply where the law says they must. No website terms can promise compliance with every law
          worldwide; you should review these Terms with a qualified professional if your use is high-risk or regulated.
        </p>

        <Section title="1. Operator & contact">
          <p>
            The Service is operated by <strong>{LEGAL_ENTITY_NAME}</strong>. For questions about these Terms, contact:{' '}
            <a href={mail} className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400">
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Description of the Service">
          <p>
            {BRAND_NAME} provides online tools to view, edit, merge, split, compress, convert, sign, and otherwise work
            with PDF and related files. Features may change over time. Some functions run in your browser; others may
            send files or metadata to our servers or third-party infrastructure so we can complete the task you
            request.
          </p>
        </Section>

        <Section title="3. Eligibility & accounts">
          <p>
            You must be able to form a binding contract where you live. If you use optional sign-in (for example with
            Google or email), you are responsible for your credentials and for activity under your account. You must
            provide accurate information where requested.
          </p>
        </Section>

        <Section title="4. Your files & how we process them">
          <p>
            You retain ownership of your documents. You grant {LEGAL_ENTITY_NAME} a limited, non-exclusive licence to
            host, process, transmit, and display your content only as needed to provide the Service you asked for
            (including security, abuse prevention, and support).
          </p>
          <p>
            You represent that you have the rights needed to upload, unlock, edit, merge, or otherwise process each
            file, and that doing so does not violate law or third-party rights.
          </p>
          <p>
            Server-stored sessions or uploads may be deleted automatically after inactivity or retention windows
            described in product messaging or a separate privacy notice. You are responsible for keeping your own copies
            of important files.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to misuse the Service. For example, you must not:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Violate any applicable law or regulation.</li>
            <li>Infringe intellectual property, privacy, or publicity rights of others.</li>
            <li>Upload malware, exploit kits, or content intended to harm systems or users.</li>
            <li>Attempt to probe, scan, or test the vulnerability of the Service without permission.</li>
            <li>Circumvent access, rate, or technical limits; or overload the Service.</li>
            <li>Use the output of the Service to mislead others in a way that is fraudulent or unlawful.</li>
          </ul>
          <p>
            We may suspend or terminate access if we reasonably believe you have breached these Terms or create risk or
            legal exposure for us or others.
          </p>
        </Section>

        <Section title="6. Signatures & legal effect">
          <p>
            Electronic signatures or markings produced with tools may not satisfy all legal requirements in every
            country or situation. You are solely responsible for whether a document is valid for your intended use
            (court filings, contracts, government forms, etc.).
          </p>
        </Section>

        <Section title="7. Intellectual property">
          <p>
            The Service, its branding, interface, and underlying software are owned by {LEGAL_ENTITY_NAME} or its
            licensors and are protected by intellectual property laws. Except for the limited rights to use the
            Service, these Terms do not grant you any licence to our IP.
          </p>
        </Section>

        <Section title="8. Third-party services">
          <p>
            The Service may rely on third parties (for example hosting, authentication, analytics, or payment links).
            Their use is subject to their respective terms and privacy policies. We are not responsible for third-party
            outages or acts.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The Service is provided on an “as is” and “as available” basis. To the fullest extent permitted by
            applicable law, {LEGAL_ENTITY_NAME} disclaims all warranties, whether express, implied, or statutory,
            including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We
            do not warrant that results will be error-free, lossless, or suitable for any specific regulatory or legal
            purpose.
          </p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>
            To the fullest extent permitted by applicable law, {LEGAL_ENTITY_NAME} and its suppliers will not be
            liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits,
            data, goodwill, or business interruption, arising from or related to your use of the Service.
          </p>
          <p>
            Where the law of your country allows such a cap for your category of user, our aggregate liability for
            claims arising out of the Service is limited to the greater of (a) the amounts you paid us for the Service
            in the twelve months before the claim or (b) fifty US dollars (USD $50). If you are a consumer and mandatory
            law in your country does not allow that cap (or does not allow certain exclusions), those limits apply only
            to the extent permitted.
          </p>
          <p>
            Some jurisdictions do not allow certain limitations; in those cases, the limitations apply only to the
            extent permitted by law.
          </p>
        </Section>

        <Section title="11. Indemnity">
          <p>
            You will defend and indemnify {LEGAL_ENTITY_NAME} and its affiliates, officers, and agents against any
            third-party claims, damages, losses, and expenses (including reasonable legal fees) arising from your
            content, your misuse of the Service, or your breach of these Terms, to the extent permitted by law.
          </p>
        </Section>

        <Section title="12. International use & mandatory local law">
          <p>
            You may use the Service only if you can do so legally in your location. You are responsible for complying
            with applicable laws (including sanctions, export, copyright, privacy, and sector-specific rules). We do not
            represent that the Service is appropriate or lawful in every jurisdiction.
          </p>
          <p>
            <strong>Mandatory rights.</strong> Nothing in these Terms limits any liability or right that cannot legally
            be limited or waived under the laws that apply to you—including, where relevant, statutory consumer rights,
            personal injury caused by negligence, fraud, or gross negligence, and rights under data protection law.
          </p>
          <p>
            If any part of these Terms is held invalid or unenforceable where you live, that part applies only to the
            minimum extent required, and the remainder stays in effect to the fullest extent permitted.
          </p>
        </Section>

        <Section title="13. Consumers in the EEA, UK, Switzerland, and Australia">
          <p>
            If you are a <strong>consumer</strong> habitually resident in the European Economic Area, the United
            Kingdom, or Switzerland, you benefit from any mandatory provisions of the laws of your country of
            residence. Nothing in these Terms affects those statutory rights.
          </p>
          <p>
            If you are an <strong>Australian consumer</strong>, our goods and services come with guarantees that cannot
            be excluded under the Australian Consumer Law. You may have rights for major or other failures; limits in
            these Terms apply only to the extent permitted by that law.
          </p>
        </Section>

        <Section title="14. Governing law & disputes">
          <p>
            Subject to the sections above on mandatory local law and consumers, these Terms and any dispute arising out
            of or relating to the Service or Terms are governed by the{' '}
            <strong>laws of {LEGAL_GOVERNING_LAW_PLACE}</strong>, without regard to conflict-of-law rules that would
            apply another jurisdiction&apos;s substantive law, except where those rules are mandatory for a court
            hearing your claim.
          </p>
          <p>
            Subject to the same carve-outs, you and {LEGAL_ENTITY_NAME} submit to the{' '}
            <strong>non-exclusive jurisdiction</strong> of {LEGAL_GOVERNING_COURTS}. Either party may also bring
            enforcement or urgent proceedings in any court that has jurisdiction under applicable law.
          </p>
        </Section>

        <Section title="15. Changes">
          <p>
            We may update these Terms from time to time. We will post the revised version on this page and update the
            “Last updated” date. Continued use after changes become effective constitutes acceptance of the revised Terms,
            except where applicable law requires additional notice or consent.
          </p>
        </Section>

        <Section title="16. General">
          <p>
            If a provision is unenforceable, the remaining provisions remain in effect. Failure to enforce a provision
            is not a waiver. These Terms are the entire agreement between you and {LEGAL_ENTITY_NAME} regarding the
            Service and supersede prior oral or written understandings on the same subject.
          </p>
        </Section>

        <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
          <Link to="/" className="text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400">
            Back to {BRAND_NAME}
          </Link>
        </p>
      </article>
    </ToolPageShell>
  )
}

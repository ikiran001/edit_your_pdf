import { Link } from 'react-router-dom'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import {
  BRAND_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  PRIVACY_LAST_UPDATED,
} from '../../shared/constants/branding.js'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  const mail = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(`${BRAND_NAME} — Privacy request`)}`
  const link = 'font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-cyan-400'

  return (
    <ToolPageShell title="Privacy Policy" subtitle={`Last updated ${PRIVACY_LAST_UPDATED}`}>
      <article className="max-w-3xl">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          This Privacy Policy explains what information <strong>{BRAND_NAME}</strong> (“we”, “us”) collects when you use
          our website and PDF tools (the “Service”), how we use it, who we share it with, and the choices you have. We
          have tried to keep it plain and honest. If anything is unclear, contact us at{' '}
          <a href={mail} className={link}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>

        <Section title="1. Who we are">
          <p>
            The Service is operated by <strong>{LEGAL_ENTITY_NAME}</strong>. For any privacy question or request —
            including access, correction, or deletion of your data — email{' '}
            <a href={mail} className={link}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. The files you process">
          <p>
            Many of our tools — such as merge, split, images-to-PDF, watermark, organize, and scan — run{' '}
            <strong>entirely in your browser</strong>. For those, your file never leaves your device and is not uploaded
            to us at all.
          </p>
          <p>
            Some tools need server processing to work — for example OCR, repair, compress (higher levels), and
            password encryption. For those, your file is sent to our processing server only to perform the task you
            asked for, and is deleted automatically after the task completes or after a short retention window. We do not
            use the contents of your documents for advertising, and we do not sell them.
          </p>
          <p>Keep your own copy of any important file; we are not a storage or backup service.</p>
        </Section>

        <Section title="3. Account information (optional)">
          <p>
            Most tools work without an account. If you choose to sign in (for example with Google or email) or subscribe
            to a paid plan, we process the information needed to run your account — such as your email address and
            subscription status. Payments, where offered, are handled by third-party payment providers under their own
            privacy policies.
          </p>
        </Section>

        <Section title="4. Usage and device data">
          <p>
            Like most websites, we automatically receive basic technical data when you visit — such as your IP address,
            browser type, device and operating system, pages viewed, and the date and time of your visit. We use this to
            operate the Service, keep it secure, prevent abuse, and understand how it is used.
          </p>
        </Section>

        <Section title="5. Cookies and similar technologies">
          <p>
            We and our partners use cookies, local storage, and similar technologies to remember your preferences, keep
            the Service working, measure usage, and (where applicable) serve advertising. You can control or delete
            cookies through your browser settings; blocking some cookies may affect how parts of the Service work.
          </p>
        </Section>

        <Section title="6. Analytics">
          <p>
            We may use analytics services such as Google Analytics and Microsoft Clarity to understand how visitors use
            the Service so we can improve it. These services may set their own cookies and process usage data under their
            respective privacy policies.
          </p>
        </Section>

        <Section title="7. Advertising (Google AdSense)">
          <p>
            We may display advertising on the Service, including through <strong>Google AdSense</strong>. To support
            this:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Third-party vendors, including Google, use cookies to serve ads based on a user’s prior visits to this and
              other websites.
            </li>
            <li>
              Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to
              this site and/or other sites on the Internet.
            </li>
            <li>
              You may opt out of personalised advertising by visiting{' '}
              <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer nofollow" className={link}>
                Google Ads Settings
              </a>
              . You can also opt out of some third-party vendors’ use of cookies for personalised advertising at{' '}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer nofollow" className={link}>
                aboutads.info/choices
              </a>{' '}
              and{' '}
              <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer nofollow" className={link}>
                youronlinechoices.eu
              </a>
              .
            </li>
          </ul>
          <p>
            For more on how Google uses data from sites that use its services, see{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={link}
            >
              policies.google.com/technologies/partner-sites
            </a>
            .
          </p>
        </Section>

        <Section title="8. Consent for users in the EEA, UK, and Switzerland">
          <p>
            Where required by law, we and our advertising partners rely on your consent to use cookies for personalised
            advertising and certain analytics. Where a consent banner is shown, you can accept or decline, and you can
            change your choice at any time through your browser settings or the controls linked above.
          </p>
        </Section>

        <Section title="9. How we use information">
          <ul className="list-disc space-y-2 pl-5">
            <li>To provide, maintain, and improve the Service and its tools.</li>
            <li>To keep the Service secure and prevent fraud and abuse.</li>
            <li>To measure and understand usage through analytics.</li>
            <li>To display and measure advertising, where applicable.</li>
            <li>To respond to your requests and provide support.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </Section>

        <Section title="10. Sharing">
          <p>
            We do not sell your personal information. We share data only with service providers who help us run the
            Service (such as hosting, analytics, and advertising partners) under appropriate terms, or where required by
            law, or to protect our rights and the safety of users.
          </p>
        </Section>

        <Section title="11. Data retention">
          <p>
            Files processed on our servers are deleted automatically after the task completes or after a short retention
            window. Account and billing data is kept for as long as your account is active and as needed to meet legal
            and accounting obligations. Analytics and advertising data is retained according to the providers’ policies.
          </p>
        </Section>

        <Section title="12. Your rights">
          <p>
            Depending on where you live, you may have rights to access, correct, delete, or restrict the use of your
            personal data, and to object to certain processing — including under the EU/UK GDPR and India’s Digital
            Personal Data Protection Act. To exercise any right, email{' '}
            <a href={mail} className={link}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            . You may also have the right to lodge a complaint with your local data protection authority.
          </p>
        </Section>

        <Section title="13. Children">
          <p>
            The Service is not directed to children under the age required by the law of their country (for example 13,
            or 16 in parts of the EEA), and we do not knowingly collect their personal data. If you believe a child has
            provided us data, contact us and we will delete it.
          </p>
        </Section>

        <Section title="14. Third-party links">
          <p>
            The Service may link to third-party sites and services we do not control. Their privacy practices are
            governed by their own policies, and we are not responsible for them.
          </p>
        </Section>

        <Section title="15. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. We will post the revised version here and update the
            “Last updated” date above. Significant changes will be made clear where required by law.
          </p>
        </Section>

        <Section title="16. Contact">
          <p>
            Questions or requests about this policy? Email{' '}
            <a href={mail} className={link}>
              {LEGAL_CONTACT_EMAIL}
            </a>{' '}
            or use our{' '}
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
          {' · '}
          <Link to="/terms" className={link}>
            Terms of Service
          </Link>
        </p>
      </article>
    </ToolPageShell>
  )
}

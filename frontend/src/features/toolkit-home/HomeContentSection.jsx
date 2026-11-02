import { useTranslation } from 'react-i18next'

/**
 * Evergreen, crawlable content block for the toolkit home page.
 *
 * Gives the homepage real editorial prose (what pdfpilot is, privacy model,
 * India focus, how it works, pricing) instead of only a tool grid — so search
 * engines and reviewers see substantial, unique content. Rendered as semantic
 * HTML and captured by the prerenderer into the static home snapshot.
 *
 * Strings live under `homeContent.*` in the locale files; untranslated locales
 * fall back to English (i18n `fallbackLng: 'en'`).
 */
export default function HomeContentSection({ className = '' }) {
  const { t } = useTranslation()

  const howSteps = [t('homeContent.howStep1'), t('homeContent.howStep2'), t('homeContent.howStep3')]

  return (
    <section
      className={`mx-auto w-full max-w-3xl space-y-10 py-10 text-left ${className}`}
      aria-label={t('homeContent.aboutHeading')}
    >
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t('homeContent.aboutHeading')}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t('homeContent.aboutP1')}</p>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t('homeContent.aboutP2')}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t('homeContent.privacyHeading')}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t('homeContent.privacyP1')}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t('homeContent.indiaHeading')}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t('homeContent.indiaP1')}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t('homeContent.howHeading')}
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {howSteps.map((step, i) => (
            <li key={i} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t('homeContent.freeHeading')}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t('homeContent.freeP1')}</p>
      </div>
    </section>
  )
}

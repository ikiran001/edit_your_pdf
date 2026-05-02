import { useState } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SIGNUP_COUNTRIES, SIGNUP_MONTHS } from './authSignupOptions.js'

/**
 * @typedef {Object} SignUpPayload
 * @property {string} email
 * @property {string} password
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} birthMonth
 * @property {string} birthYear
 * @property {string} country
 */

/**
 * Email/password sign-in and rich email sign-up (name, DOB, country).
 *
 * @param {(msg: string | null) => void} props.onAuthMessage Client validation or clear (`null`).
 * @param {(email: string, password: string) => Promise<void>} props.onEmailSignIn
 * @param {(payload: SignUpPayload) => Promise<void>} props.onEmailSignUp
 * @param {(email: string) => Promise<void>} [props.onSendPasswordReset] Sign-in only; Firebase password-reset email.
 */
export default function AuthEmailForms({
  compact = false,
  controlledEmailMode,
  omitTopBorder = false,
  busy,
  onAuthMessage,
  onEmailSignIn,
  onEmailSignUp,
  onSendPasswordReset,
}) {
  const { t } = useTranslation()
  const [internalEmailMode, setInternalEmailMode] = useState('signin')
  const emailMode = controlledEmailMode ?? internalEmailMode
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

  const maxBirthYear = new Date().getFullYear() - 13
  const inForgotPasswordFlow = emailMode === 'signin' && forgotPasswordOpen

  const gap = compact ? 'gap-2' : 'gap-3'
  const labelCls = compact
    ? 'text-[10px] font-medium text-zinc-600 dark:text-zinc-400'
    : 'text-xs font-medium text-zinc-600 dark:text-zinc-400'
  const inputCls = compact
    ? 'w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500'
    : 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500'
  const selectCls = inputCls

  const submitEmail = async () => {
    const e = email.trim()
    const p = password
    if (!e || !p) {
      onAuthMessage?.(t('auth.errors.emailPasswordRequired'))
      return
    }
    if (p.length < 6) {
      onAuthMessage?.(t('auth.errors.passwordMin'))
      return
    }
    onAuthMessage?.(null)
    await onEmailSignIn(e, p)
  }

  const submitEmailSignup = async () => {
    const fn = firstName.trim()
    const ln = lastName.trim()
    const e = email.trim()
    const p = password
    if (!fn || !ln) {
      onAuthMessage?.(t('auth.errors.firstLastRequired'))
      return
    }
    if (!birthMonth) {
      onAuthMessage?.(t('auth.errors.birthMonthRequired'))
      return
    }
    const y = String(birthYear).trim()
    if (!y || !/^\d{4}$/.test(y)) {
      onAuthMessage?.(t('auth.errors.birthYearInvalid'))
      return
    }
    const yi = Number(y)
    if (yi < 1900 || yi > maxBirthYear) {
      onAuthMessage?.(t('auth.errors.birthYearRange', { max: maxBirthYear }))
      return
    }
    if (!country) {
      onAuthMessage?.(t('auth.errors.countryRequired'))
      return
    }
    if (!e || !p) {
      onAuthMessage?.(t('auth.errors.emailPasswordRequired'))
      return
    }
    if (p.length < 6) {
      onAuthMessage?.(t('auth.errors.passwordMin'))
      return
    }
    onAuthMessage?.(null)
    await onEmailSignUp({
      email: e,
      password: p,
      firstName: fn,
      lastName: ln,
      birthMonth,
      birthYear: y,
      country,
    })
  }

  const emailSubmit = emailMode === 'signin' ? submitEmail : submitEmailSignup

  const submitPasswordReset = async () => {
    if (!onSendPasswordReset) return
    const e = email.trim()
    if (!e) {
      onAuthMessage?.(t('auth.errors.resetEmailRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      onAuthMessage?.(t('auth.errors.emailInvalid'))
      return
    }
    onAuthMessage?.(null)
    await onSendPasswordReset(e)
    setForgotPasswordOpen(false)
    setPassword('')
  }

  const emailSectionTitle =
    controlledEmailMode === 'signup'
      ? t('auth.emailSection.signUpWithEmail')
      : controlledEmailMode === 'signin'
        ? t('auth.emailSection.signInWithEmail')
        : t('auth.emailSection.emailPassword')

  const rootClass = omitTopBorder
    ? `${gap} flex flex-col`
    : `mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700 ${gap} flex flex-col`

  const showSignupFields = emailMode === 'signup'

  return (
    <div className={rootClass}>
      <p className={`font-medium text-zinc-800 dark:text-zinc-200 ${compact ? 'text-xs' : 'text-sm'}`}>
        {emailSectionTitle}
      </p>
      {controlledEmailMode == null ? (
        <>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            <button
              type="button"
              disabled={busy}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                internalEmailMode === 'signin'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
              onClick={() => {
                setInternalEmailMode('signin')
                onAuthMessage?.(null)
              }}
            >
              {t('auth.signInTitle')}
            </button>
            <button
              type="button"
              disabled={busy}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                internalEmailMode === 'signup'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
              onClick={() => {
                setInternalEmailMode('signup')
                onAuthMessage?.(null)
              }}
            >
              {t('auth.createAccountTab')}
            </button>
          </div>
          <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            {t('auth.emailSection.pickTabHint')}
          </p>
        </>
      ) : null}

      {showSignupFields ? (
        <>
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${compact ? '' : ''}`}>
            <label className={labelCls}>
              {t('auth.field.firstName')}
              <input
                className={`${inputCls} mt-0.5`}
                type="text"
                name="eyp-auth-first"
                autoComplete="given-name"
                value={firstName}
                disabled={busy}
                onChange={(ev) => setFirstName(ev.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('auth.field.lastName')}
              <input
                className={`${inputCls} mt-0.5`}
                type="text"
                name="eyp-auth-last"
                autoComplete="family-name"
                value={lastName}
                disabled={busy}
                onChange={(ev) => setLastName(ev.target.value)}
              />
            </label>
          </div>
          <div>
            <span className={`inline-flex items-center gap-1 ${labelCls}`}>
              {t('auth.field.dob')}
              <Info
                className="h-3.5 w-3.5 text-indigo-500 dark:text-cyan-400"
                aria-hidden
                title={t('auth.field.dobInfo')}
              />
            </span>
            <div className="mt-0.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                className={`${selectCls}`}
                value={birthMonth}
                disabled={busy}
                onChange={(ev) => setBirthMonth(ev.target.value)}
                aria-label={t('auth.field.birthMonth')}
              >
                {SIGNUP_MONTHS.map((m) => (
                  <option key={m.value || 'placeholder'} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                className={`${inputCls}`}
                type="text"
                inputMode="numeric"
                name="eyp-auth-birth-year"
                placeholder={t('auth.field.year')}
                autoComplete="bday-year"
                maxLength={4}
                value={birthYear}
                disabled={busy}
                onChange={(ev) => setBirthYear(ev.target.value.replace(/\D/g, '').slice(0, 4))}
                aria-label={t('auth.field.birthYear')}
              />
            </div>
          </div>
          <label className={labelCls}>
            {t('auth.field.country')}
            <select
              className={`${selectCls} mt-0.5`}
              value={country}
              disabled={busy}
              onChange={(ev) => setCountry(ev.target.value)}
            >
              {SIGNUP_COUNTRIES.map((c) => (
                <option key={c.value || 'placeholder'} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <label className={labelCls}>
        {t('auth.field.email')}
        <input
          className={`${inputCls} mt-0.5`}
          type="email"
          name="eyp-auth-email"
          autoComplete="email"
          value={email}
          disabled={busy}
          onChange={(ev) => setEmail(ev.target.value)}
        />
      </label>
      {inForgotPasswordFlow ? (
        <>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t('auth.reset.blurb')}
          </p>
          <button
            type="button"
            disabled={busy}
            className={`w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 ${compact ? '' : 'text-sm'}`}
            onClick={() => void submitPasswordReset()}
          >
            {busy ? t('auth.pleaseWait') : t('auth.reset.sendLink')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-center text-xs font-medium text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-cyan-400"
            onClick={() => {
              setForgotPasswordOpen(false)
              onAuthMessage?.(null)
            }}
          >
            {t('auth.reset.backToSignIn')}
          </button>
        </>
      ) : (
        <>
          <label className={labelCls}>
            {t('auth.field.password')}
            <input
              className={`${inputCls} mt-0.5`}
              type="password"
              name="eyp-auth-password"
              autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              disabled={busy}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </label>
          {emailMode === 'signin' && onSendPasswordReset ? (
            <button
              type="button"
              disabled={busy}
              className="-mt-1 text-left text-xs font-medium text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-cyan-400"
              onClick={() => {
                setForgotPasswordOpen(true)
                onAuthMessage?.(null)
              }}
            >
              {t('auth.forgotPassword')}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className={`w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 ${compact ? '' : 'text-sm'}`}
            onClick={() => void emailSubmit()}
          >
            {busy
              ? t('auth.pleaseWait')
              : controlledEmailMode != null
                ? t('auth.continue')
                : emailMode === 'signin'
                  ? t('auth.signInWithEmailButton')
                  : t('auth.createAccountButton')}
          </button>
        </>
      )}
    </div>
  )
}

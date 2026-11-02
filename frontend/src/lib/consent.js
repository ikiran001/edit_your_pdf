/**
 * Cookie / ads consent (Google Consent Mode v2).
 *
 * index.html sets the Consent Mode *defaults* (denied for EEA/UK/CH, granted
 * elsewhere) before the gtag + AdSense tags load. This module records the user's
 * explicit choice and pushes a consent *update* so personalised ads and
 * analytics storage switch on only after consent — and stay off if declined.
 *
 * Note: a hand-rolled banner is not a Google-certified CMP. For full EEA ad
 * serving, also enable the GDPR consent message under AdSense → Privacy &
 * messaging; it rides on the adsbygoogle.js tag already in index.html.
 */
export const CONSENT_KEY = 'pp-consent-v1'

/** @returns {'all'|'essential'|null} */
export function getStoredConsent() {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'all' || v === 'essential' ? v : null
  } catch {
    return null
  }
}

/** Push the Consent Mode update for a choice (no-op if gtag is absent). */
export function applyConsent(choice) {
  const granted = choice === 'all'
  const state = granted ? 'granted' : 'denied'
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    })
  }
  // Microsoft Clarity respects an explicit consent signal too.
  if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
    try {
      window.clarity('consent', granted)
    } catch {
      /* clarity not ready — ignore */
    }
  }
}

/** Persist + apply a choice. */
export function setConsent(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    /* storage blocked — still apply for this session */
  }
  applyConsent(choice)
}

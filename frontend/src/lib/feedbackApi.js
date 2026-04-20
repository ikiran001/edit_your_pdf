import { apiUrl } from './apiBase.js'

/**
 * @returns {Promise<{ ok: true, reviews: Array<{ id: string, name: string | null, rating: number, text: string, createdAt: string }> } | { ok: false, error: string }>}
 */
export async function fetchFeedbackReviews() {
  try {
    const res = await fetch(apiUrl('/feedback'))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }
    if (!Array.isArray(data.reviews)) {
      return { ok: false, error: 'Unexpected response' }
    }
    return { ok: true, reviews: data.reviews }
  } catch (e) {
    return { ok: false, error: e?.message || 'network_error' }
  }
}

/**
 * @param {{ name?: string, rating: number, text: string, source?: string }} body
 */
const ADMIN_TOKEN_KEY = 'pdfpilot_feedback_admin_token'

export function getStoredFeedbackAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredFeedbackAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function adminHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

/**
 * @param {string} token
 * @returns {Promise<{ ok: true, total: number, reviews: Array<{ id: string, name: string | null, rating: number, text: string, createdAt: string, source: string | null }> } | { ok: false, error: string }>}
 */
export async function adminFetchFeedbackReviews(token) {
  try {
    const res = await fetch(apiUrl('/feedback/admin'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }
    if (!Array.isArray(data.reviews)) {
      return { ok: false, error: 'Unexpected response' }
    }
    return { ok: true, total: Number(data.total) || data.reviews.length, reviews: data.reviews }
  } catch (e) {
    return { ok: false, error: e?.message || 'network_error' }
  }
}

/**
 * @param {string} token
 * @param {{ name?: string, rating: number, text: string, source?: string }} body
 */
export async function adminSubmitFeedbackReview(token, body) {
  try {
    const res = await fetch(apiUrl('/feedback/admin'), {
      method: 'POST',
      headers: adminHeaders(token),
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }
    if (!data.ok || !data.review) {
      return { ok: false, error: data?.error || 'Save failed' }
    }
    return { ok: true, review: data.review }
  } catch (e) {
    return { ok: false, error: e?.message || 'network_error' }
  }
}

/**
 * @param {string} token
 * @param {string} id
 */
export async function adminDeleteFeedbackReview(token, id) {
  try {
    const enc = encodeURIComponent(id)
    const res = await fetch(apiUrl(`/feedback/admin/${enc}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }
    if (!data.ok) {
      return { ok: false, error: data?.error || 'Delete failed' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'network_error' }
  }
}

export async function submitFeedbackReview(body) {
  try {
    const res = await fetch(apiUrl('/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 429) {
      return { ok: false, error: data?.error || 'Too many submissions. Try again later.' }
    }
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }
    if (!data.ok || !data.review) {
      return { ok: false, error: data?.error || 'Save failed' }
    }
    return { ok: true, review: data.review }
  } catch (e) {
    return { ok: false, error: e?.message || 'network_error' }
  }
}

import { apiUrl } from './apiBase.js'

async function bearerHeaders(getFreshIdToken) {
  const token = await getFreshIdToken().catch(() => null)
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

/**
 * @param {() => Promise<string | null>} getFreshIdToken
 */
export async function fetchSubscriptionMe(getFreshIdToken) {
  const headers = { ...(await bearerHeaders(getFreshIdToken)) }
  const res = await fetch(apiUrl('/subscription/me'), { headers, credentials: 'include' })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data }
}

/**
 * @param {() => Promise<string | null>} getFreshIdToken
 * @param {'monthly' | 'yearly'} plan
 */
export async function createRazorpayOrderRequest(getFreshIdToken, plan) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await bearerHeaders(getFreshIdToken)),
  }
  const res = await fetch(apiUrl('/subscription/razorpay/order'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ plan }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data }
}

/**
 * @param {() => Promise<string | null>} getFreshIdToken
 * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string, plan: string }} payload
 */
export async function verifyRazorpayPaymentRequest(getFreshIdToken, payload) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await bearerHeaders(getFreshIdToken)),
  }
  const res = await fetch(apiUrl('/subscription/razorpay/verify'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data }
}

/**
 * @param {() => Promise<string | null>} getFreshIdToken
 */
export async function cancelSubscriptionRequest(getFreshIdToken) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await bearerHeaders(getFreshIdToken)),
  }
  const res = await fetch(apiUrl('/subscription/cancel'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({}),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data }
}

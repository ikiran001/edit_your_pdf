/** Razorpay amounts in paise (INR). */
export const PLAN_AMOUNTS_INR = {
  monthly: 99,
  yearly: 999,
};

export const PLAN_AMOUNTS_PAISE = {
  monthly: 9900,
  yearly: 99900,
};

export const FREE_DAILY_DOWNLOAD_LIMIT = 3;

/** @typedef {'monthly' | 'yearly'} BillingPlanKey */

export function normalizePlanKey(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'monthly' || s === 'month') return 'monthly';
  if (s === 'yearly' || s === 'annual' || s === 'year') return 'yearly';
  return null;
}

export function planToFirestorePlan(planKey) {
  return planKey === 'yearly' ? 'pro_yearly' : 'pro_monthly';
}

export function firestorePlanToLabel(plan) {
  if (plan === 'pro_yearly') return 'Pro — Yearly';
  if (plan === 'pro_monthly') return 'Pro — Monthly';
  return 'Free';
}

export function durationMsForPlan(planKey) {
  if (planKey === 'yearly') return 365 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

export function nextUtcMidnightIso(fromDayKey) {
  const [y, m, d] = fromDayKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const next = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return next.toISOString();
}

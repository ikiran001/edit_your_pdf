/** Razorpay amounts in paise (INR). */
export const PLAN_AMOUNTS_INR = {
  daily: 10,
  monthly: 99,
  yearly: 999,
};

export const PLAN_AMOUNTS_PAISE = {
  daily: 1000,
  monthly: 9900,
  yearly: 99900,
};

export const FREE_DAILY_DOWNLOAD_LIMIT = 3;

/** @typedef {'daily' | 'monthly' | 'yearly'} BillingPlanKey */

export function normalizePlanKey(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'daily' || s === 'day') return 'daily';
  if (s === 'monthly' || s === 'month') return 'monthly';
  if (s === 'yearly' || s === 'annual' || s === 'year') return 'yearly';
  return null;
}

export function planToFirestorePlan(planKey) {
  if (planKey === 'yearly') return 'pro_yearly';
  if (planKey === 'daily') return 'pro_daily';
  return 'pro_monthly';
}

export function firestorePlanToLabel(plan) {
  if (plan === 'pro_yearly') return 'Pro — Yearly';
  if (plan === 'pro_monthly') return 'Pro — Monthly';
  if (plan === 'pro_daily') return 'Pro — Daily';
  return 'Free';
}

/** True for any paid Pro plan (daily/monthly/yearly). */
export function isPaidFirestorePlan(plan) {
  return plan === 'pro_daily' || plan === 'pro_monthly' || plan === 'pro_yearly';
}

export function durationMsForPlan(planKey) {
  if (planKey === 'yearly') return 365 * 24 * 60 * 60 * 1000;
  if (planKey === 'daily') return 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

export function nextUtcMidnightIso(fromDayKey) {
  const [y, m, d] = fromDayKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const next = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return next.toISOString();
}

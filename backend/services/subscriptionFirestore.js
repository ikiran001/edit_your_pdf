import admin from 'firebase-admin';
import { ensureFirebaseAdmin } from './firebaseAdmin.js';
import {
  FREE_DAILY_DOWNLOAD_LIMIT,
  durationMsForPlan,
  firestorePlanToLabel,
  nextUtcMidnightIso,
  planToFirestorePlan,
} from './subscriptionConstants.js';

function dbOrNull() {
  if (!ensureFirebaseAdmin()) return null;
  try {
    return admin.firestore();
  } catch (e) {
    console.warn('[subscription] firestore:', e?.message || e);
    return null;
  }
}

export function getUtcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} orderId
 * @param {string} uid
 * @param {import('./subscriptionConstants.js').BillingPlanKey} planKey
 * @param {number} amountPaise
 */
export async function writePendingOrderLedger(orderId, uid, planKey, amountPaise) {
  const db = dbOrNull();
  if (!db) {
    const e = new Error('firestore_unavailable');
    throw e;
  }
  const FieldValue = admin.firestore.FieldValue;
  await db
    .collection('billingOrderLedger')
    .doc(orderId)
    .set(
      {
        uid,
        planKey,
        amountPaise,
        subscriptionApplied: false,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

function defaultGraceMs() {
  const n = Number(process.env.SUBSCRIPTION_GRACE_MS || 172800000);
  return Number.isFinite(n) && n >= 0 ? n : 172800000;
}

/**
 * @param {FirebaseFirestore.Timestamp | admin.firestore.Timestamp | undefined} ts
 */
function tsToMillis(ts) {
  if (!ts) return 0;
  try {
    if (typeof ts.toMillis === 'function') return ts.toMillis();
  } catch {
    /* ignore */
  }
  return 0;
}

/**
 * @param {string} uid
 * @returns {Promise<{ effectivePlan: string, isPaid: boolean, expiresAtMs: number, cancellationRequested: boolean, renewalMode: string }>}
 */
export async function readSubscriptionSummary(uid) {
  const db = dbOrNull();
  if (!db) {
    return {
      effectivePlan: 'free',
      isPaid: false,
      expiresAtMs: 0,
      cancellationRequested: false,
      renewalMode: 'manual',
    };
  }
  const ref = db.collection('users').doc(uid).collection('billing').doc('subscription');
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const plan = typeof data.plan === 'string' ? data.plan : 'free';
  const expiresAtMs = tsToMillis(data.expiresAt);
  const graceMs = defaultGraceMs();
  const now = Date.now();
  const isPaid =
    (plan === 'pro_monthly' || plan === 'pro_yearly') && expiresAtMs + graceMs > now;
  return {
    effectivePlan: isPaid ? plan : 'free',
    isPaid,
    expiresAtMs,
    cancellationRequested: Boolean(data.cancellationRequested),
    renewalMode: typeof data.renewalMode === 'string' ? data.renewalMode : 'manual',
  };
}

/**
 * Reserves one download for a signed-in user (paid = no counter; free = increment with UTC-day reset).
 * @param {string} uid
 * @returns {Promise<{ kind: 'paid' } | { kind: 'free', used: number, limit: number, utcDay: string }>}
 */
export async function reserveAuthenticatedDownload(uid) {
  const db = dbOrNull();
  if (!db) {
    const e = new Error('firestore_unavailable');
    e.code = 'SUBSCRIPTION_SERVICE_UNAVAILABLE';
    throw e;
  }
  const graceMs = defaultGraceMs();
  const subRef = db.collection('users').doc(uid).collection('billing').doc('subscription');
  const usageRef = db.collection('users').doc(uid).collection('billing').doc('dailyDownloads');

  return db.runTransaction(async (transaction) => {
    const subSnap = await transaction.get(subRef);
    const sub = subSnap.exists ? subSnap.data() || {} : {};
    const plan = typeof sub.plan === 'string' ? sub.plan : 'free';
    const expiresAtMs = tsToMillis(sub.expiresAt);
    const now = Date.now();
    const isPaid =
      (plan === 'pro_monthly' || plan === 'pro_yearly') && expiresAtMs + graceMs > now;
    if (isPaid) {
      return { kind: 'paid' };
    }

    const dayKey = getUtcDayKey(new Date());
    const usageSnap = await transaction.get(usageRef);
    const u = usageSnap.exists ? usageSnap.data() || {} : {};
    let count = Number(u.count) || 0;
    const storedDay = typeof u.utcDay === 'string' ? u.utcDay : '';
    if (storedDay !== dayKey) {
      count = 0;
    }
    if (count >= FREE_DAILY_DOWNLOAD_LIMIT) {
      const err = new Error('download_limit');
      err.code = 'DOWNLOAD_LIMIT_EXCEEDED';
      err.meta = {
        used: count,
        limit: FREE_DAILY_DOWNLOAD_LIMIT,
        utcDay: dayKey,
        resetsAtUtc: nextUtcMidnightIso(dayKey),
      };
      throw err;
    }

    transaction.set(
      usageRef,
      {
        utcDay: dayKey,
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { kind: 'free', used: count + 1, limit: FREE_DAILY_DOWNLOAD_LIMIT, utcDay: dayKey };
  });
}

/**
 * @param {string} uid
 * @param {import('./subscriptionConstants.js').BillingPlanKey} planKey
 * @param {{ paymentId: string, orderId: string, amountPaise: number, currency: string, invoiceUrl?: string | null }} meta
 * @param {FirebaseFirestore.Transaction} [outerTransaction]
 */
export async function applySubscriptionAfterPayment(uid, planKey, meta, outerTransaction) {
  const db = dbOrNull();
  if (!db) throw new Error('firestore_unavailable');
  const FieldValue = admin.firestore.FieldValue;
  const newPlan = planToFirestorePlan(planKey);
  const addMs = durationMsForPlan(planKey);
  const subRef = db.collection('users').doc(uid).collection('billing').doc('subscription');
  const payRef = db
    .collection('users')
    .doc(uid)
    .collection('billingPayments')
    .doc(meta.paymentId);
  const ledgerRef = db.collection('billingOrderLedger').doc(meta.orderId);

  const run = async (transaction) => {
    const subSnap = await transaction.get(subRef);
    const sub = subSnap.exists ? subSnap.data() || {} : {};
    const currentPlan = typeof sub.plan === 'string' ? sub.plan : 'free';
    const currentExp = tsToMillis(sub.expiresAt);
    const now = Date.now();
    const graceMs = defaultGraceMs();
    const paidActive =
      (currentPlan === 'pro_monthly' || currentPlan === 'pro_yearly') &&
      currentExp + graceMs > now;

    let baseStart = now;
    if (paidActive) {
      if (planKey === 'monthly' && currentPlan === 'pro_yearly' && currentExp > now) {
        baseStart = currentExp;
      } else {
        baseStart = Math.max(now, currentExp);
      }
    }
    const newExpires = baseStart + addMs;

    transaction.set(
      subRef,
      {
        plan: newPlan,
        planKey,
        startsAt: FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(newExpires),
        renewalMode: 'manual',
        lastPaymentId: meta.paymentId,
        lastOrderId: meta.orderId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      payRef,
      {
        razorpayPaymentId: meta.paymentId,
        razorpayOrderId: meta.orderId,
        amountPaise: meta.amountPaise,
        currency: meta.currency || 'INR',
        planKey,
        planLabel: firestorePlanToLabel(newPlan),
        invoiceUrl: meta.invoiceUrl || null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      ledgerRef,
      {
        uid,
        planKey,
        subscriptionApplied: true,
        paymentId: meta.paymentId,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  };

  if (outerTransaction) {
    await run(outerTransaction);
  } else {
    await db.runTransaction((t) => run(t));
  }
}

/**
 * Idempotent: if ledger already applied, returns { ok: true, duplicate: true }.
 * @param {string} uid
 * @param {import('./subscriptionConstants.js').BillingPlanKey} planKey
 * @param {{ paymentId: string, orderId: string, amountPaise: number, currency: string, invoiceUrl?: string | null }} meta
 */
export async function applySubscriptionIfNewOrder(uid, planKey, meta) {
  const db = dbOrNull();
  if (!db) throw new Error('firestore_unavailable');
  const ledgerRef = db.collection('billingOrderLedger').doc(meta.orderId);
  let duplicate = false;

  await db.runTransaction(async (transaction) => {
    const led = await transaction.get(ledgerRef);
    if (led.exists && led.data()?.subscriptionApplied) {
      duplicate = true;
      return;
    }
    await applySubscriptionAfterPayment(uid, planKey, meta, transaction);
  });

  return { ok: true, duplicate };
}

/** @param {string} uid */
export async function markSubscriptionCancelled(uid) {
  const db = dbOrNull();
  if (!db) return false;
  const FieldValue = admin.firestore.FieldValue;
  const ref = db.collection('users').doc(uid).collection('billing').doc('subscription');
  await ref.set(
    {
      cancellationRequested: true,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}

/**
 * @param {string} uid
 * @returns {Promise<{ subscription: object, dailyDownloads: object, payments: object[] }>}
 */
export async function getAccountBillingPayload(uid) {
  const db = dbOrNull();
  if (!db) return null;
  const subRef = db.collection('users').doc(uid).collection('billing').doc('subscription');
  const usageRef = db.collection('users').doc(uid).collection('billing').doc('dailyDownloads');
  let paySnap = null;
  try {
    paySnap = await db
      .collection('users')
      .doc(uid)
      .collection('billingPayments')
      .orderBy('createdAt', 'desc')
      .limit(40)
      .get();
  } catch (e) {
    console.warn('[subscription] payments list:', e?.message || e);
  }
  const [subSnap, usageSnap] = await Promise.all([subRef.get(), usageRef.get()]);

  const summary = await readSubscriptionSummary(uid);
  const sub = subSnap.exists ? subSnap.data() || {} : {};
  const usage = usageSnap.exists ? usageSnap.data() || {} : {};
  const dayKey = getUtcDayKey(new Date());
  let usedToday = Number(usage.count) || 0;
  if (usage.utcDay !== dayKey) usedToday = 0;

  const payments = [];
  if (paySnap && !paySnap.empty) {
    paySnap.forEach((d) => {
      const x = d.data() || {};
      payments.push({
        id: d.id,
        razorpayPaymentId: x.razorpayPaymentId || d.id,
        razorpayOrderId: x.razorpayOrderId || null,
        amountPaise: x.amountPaise ?? null,
        currency: x.currency || 'INR',
        planKey: x.planKey || null,
        planLabel: x.planLabel || null,
        invoiceUrl: x.invoiceUrl || null,
        createdAt: tsToMillis(x.createdAt) || null,
      });
    });
  }

  return {
    subscription: {
      plan: summary.effectivePlan,
      planLabel: firestorePlanToLabel(summary.effectivePlan),
      isPaid: summary.isPaid,
      expiresAt: summary.expiresAtMs ? new Date(summary.expiresAtMs).toISOString() : null,
      startsAt:
        sub.startsAt && typeof sub.startsAt.toDate === 'function'
          ? sub.startsAt.toDate().toISOString()
          : null,
      cancellationRequested: summary.cancellationRequested,
      renewalMode: summary.renewalMode,
      /** Manual renewal: user pays again before expiry to extend; no automatic card charge. */
      autoRenew: false,
    },
    dailyDownloads: {
      usedToday,
      limit: FREE_DAILY_DOWNLOAD_LIMIT,
      utcDay: dayKey,
      resetsAtUtc: nextUtcMidnightIso(dayKey),
      unlimited: summary.isPaid,
    },
    payments,
  };
}

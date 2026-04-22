import express from 'express';
import { verifyFirebaseIdToken, isFirebaseAdminReady } from '../services/firebaseAdmin.js';
import {
  PLAN_AMOUNTS_PAISE,
  normalizePlanKey,
} from '../services/subscriptionConstants.js';
import {
  getAccountBillingPayload,
  markSubscriptionCancelled,
  applySubscriptionIfNewOrder,
  writePendingOrderLedger,
} from '../services/subscriptionFirestore.js';
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  isRazorpayConfigured,
  getKeyId,
} from '../services/razorpayClient.js';

function readBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

async function requireUser(req, res) {
  if (!isFirebaseAdminReady()) {
    res.status(503).json({
      error: 'auth_unavailable',
      message: 'Server cannot verify sign-in (Firebase Admin not configured).',
    });
    return null;
  }
  const user = await verifyFirebaseIdToken(readBearerToken(req));
  if (!user) {
    res.status(401).json({ error: 'unauthorized', message: 'Valid sign-in required.' });
    return null;
  }
  return user;
}

const router = express.Router();
router.use(express.json({ limit: '64kb' }));

router.get('/subscription/me', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const payload = await getAccountBillingPayload(user.uid);
    if (!payload) {
      return res.status(503).json({
        error: 'billing_unavailable',
        message: 'Could not load billing (Firestore unavailable).',
      });
    }
    return res.json({
      ...payload,
      checkout: { razorpayKeyId: getKeyId(), configured: isRazorpayConfigured() },
    });
  } catch (e) {
    console.error('[subscription/me]', e);
    return res.status(500).json({ error: 'me_failed', message: e?.message || 'Failed to load subscription.' });
  }
});

router.post('/subscription/razorpay/order', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: 'payments_unavailable',
      message: 'Payments are not configured on this server.',
    });
  }
  const planKey = normalizePlanKey(req.body?.plan);
  if (!planKey) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid plan. Use monthly or yearly.' });
  }
  const amountPaise = PLAN_AMOUNTS_PAISE[planKey];
  const receipt = `u_${user.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Date.now()}`.slice(0, 40);
  try {
    const order = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: { uid: user.uid, planKey },
    });
    await writePendingOrderLedger(order.id, user.uid, planKey, amountPaise);
    return res.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency || 'INR',
      keyId: getKeyId(),
      planKey,
    });
  } catch (e) {
    console.error('[subscription/order]', e);
    const msg = e?.message || 'Could not create order.';
    if (String(msg).includes('firestore')) {
      return res.status(503).json({ error: 'billing_unavailable', message: msg });
    }
    return res.status(500).json({ error: 'order_failed', message: msg });
  }
});

router.post('/subscription/razorpay/verify', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: 'payments_unavailable',
      message: 'Payments are not configured on this server.',
    });
  }
  const orderId = req.body?.razorpay_order_id;
  const paymentId = req.body?.razorpay_payment_id;
  const signature = req.body?.razorpay_signature;
  const plan = req.body?.plan;
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature.' });
  }
  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
    return res.status(400).json({ error: 'invalid_signature', message: 'Payment signature verification failed.' });
  }
  const planKey = normalizePlanKey(plan);
  if (!planKey) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid plan.' });
  }
  try {
    const [order, payment] = await Promise.all([
      fetchRazorpayOrder(orderId),
      fetchRazorpayPayment(paymentId),
    ]);
    if (payment.order_id !== orderId) {
      return res.status(400).json({ error: 'order_mismatch', message: 'Payment does not match order.' });
    }
    if (payment.status !== 'captured') {
      return res.status(400).json({
        error: 'payment_not_captured',
        message: `Payment status is ${payment.status}; expected captured.`,
      });
    }
    const uidFromOrder =
      typeof order.notes?.uid === 'string' ? order.notes.uid : String(order.notes?.uid || '');
    if (!uidFromOrder || uidFromOrder !== user.uid) {
      return res.status(403).json({ error: 'forbidden', message: 'This order belongs to a different account.' });
    }
    const notesPlan = normalizePlanKey(order.notes?.planKey || order.notes?.plan);
    if (notesPlan !== planKey) {
      return res.status(400).json({ error: 'plan_mismatch', message: 'Selected plan does not match the Razorpay order.' });
    }
    const expectedAmount = PLAN_AMOUNTS_PAISE[planKey];
    if (Number(order.amount) !== expectedAmount) {
      return res.status(400).json({ error: 'amount_mismatch', message: 'Order amount does not match the selected plan.' });
    }
    const amountPaise = Number(payment.amount);
    const invoiceUrl =
      payment.invoice_url ||
      (payment.invoice && typeof payment.invoice === 'object' && payment.invoice.short_url) ||
      null;
    const result = await applySubscriptionIfNewOrder(user.uid, planKey, {
      paymentId,
      orderId,
      amountPaise,
      currency: payment.currency || 'INR',
      invoiceUrl: typeof invoiceUrl === 'string' ? invoiceUrl : null,
    });
    const full = await getAccountBillingPayload(user.uid);
    return res.json({
      ok: true,
      duplicate: result.duplicate,
      subscription: full?.subscription || null,
    });
  } catch (e) {
    console.error('[subscription/verify]', e);
    return res.status(500).json({ error: 'verify_failed', message: e?.message || 'Verification failed.' });
  }
});

router.post('/subscription/cancel', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    await markSubscriptionCancelled(user.uid);
    const full = await getAccountBillingPayload(user.uid);
    return res.json({
      ok: true,
      subscription: full?.subscription || null,
      message:
        'Your subscription will not renew automatically (plans are prepaid). Pro benefits stay active until the expiry date.',
    });
  } catch (e) {
    console.error('[subscription/cancel]', e);
    return res.status(500).json({ error: 'cancel_failed', message: e?.message || 'Could not update subscription.' });
  }
});

/**
 * Razorpay webhooks — raw JSON body required for signature verification.
 * @type {import('express').RequestHandler}
 */
export async function handleRazorpayWebhook(req, res) {
  const sig = req.headers['x-razorpay-signature'];
  const raw = req.body;
  if (!Buffer.isBuffer(raw)) {
    return res.status(400).type('text').send('expected raw buffer');
  }
  if (!verifyRazorpayWebhookSignature(raw, sig)) {
    console.warn('[subscription/webhook] invalid signature');
    return res.status(400).type('text').send('invalid signature');
  }
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).type('text').send('invalid json');
  }
  try {
    const event = payload.event;
    if (event === 'payment.captured') {
      const pay = payload.payload?.payment?.entity;
      if (pay && pay.order_id && pay.id) {
        await processWebhookPaymentEntity(pay);
      }
    }
    return res.json({ received: true });
  } catch (e) {
    console.error('[subscription/webhook] process error:', e);
    return res.status(500).json({ error: 'webhook_process_failed' });
  }
}

/**
 * @param {Record<string, unknown>} pay
 */
async function processWebhookPaymentEntity(pay) {
  if (!isRazorpayConfigured()) return;
  const orderId = pay.order_id;
  const paymentId = pay.id;
  if (pay.status !== 'captured') return;
  const order = await fetchRazorpayOrder(orderId);
  const uidRaw = order.notes?.uid;
  const uid = typeof uidRaw === 'string' ? uidRaw : String(uidRaw || '');
  const planKey = normalizePlanKey(order.notes?.planKey || order.notes?.plan);
  if (!uid || !planKey) {
    console.warn('[subscription/webhook] missing uid/plan on order', orderId);
    return;
  }
  const expectedAmount = PLAN_AMOUNTS_PAISE[planKey];
  if (Number(order.amount) !== expectedAmount) {
    console.warn('[subscription/webhook] amount mismatch', orderId);
    return;
  }
  const amountPaise = Number(pay.amount);
  const invoiceUrl =
    pay.invoice_url ||
    (pay.invoice && typeof pay.invoice === 'object' && pay.invoice.short_url) ||
    null;
  await applySubscriptionIfNewOrder(uid, planKey, {
    paymentId,
    orderId,
    amountPaise,
    currency: String(pay.currency || 'INR'),
    invoiceUrl: typeof invoiceUrl === 'string' ? invoiceUrl : null,
  });
}

export default router;

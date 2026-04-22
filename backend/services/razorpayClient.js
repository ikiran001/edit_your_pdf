import crypto from 'crypto';
import Razorpay from 'razorpay';

export function isRazorpayConfigured() {
  return Boolean(
    (process.env.RAZORPAY_KEY_ID || '').trim() && (process.env.RAZORPAY_KEY_SECRET || '').trim()
  );
}

export function getKeyId() {
  return (process.env.RAZORPAY_KEY_ID || '').trim();
}

function instanceOrNull() {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

/**
 * @param {{ amountPaise: number, receipt: string, notes?: Record<string, string> }} p
 */
export async function createRazorpayOrder(p) {
  const inst = instanceOrNull();
  if (!inst) {
    const e = new Error('razorpay_not_configured');
    throw e;
  }
  const receipt = String(p.receipt || 'rct').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const notes = {};
  if (p.notes && typeof p.notes === 'object') {
    for (const [k, v] of Object.entries(p.notes)) {
      notes[String(k).slice(0, 15)] = String(v).slice(0, 500);
    }
  }
  return inst.orders.create({
    amount: p.amountPaise,
    currency: 'INR',
    receipt,
    notes,
  });
}

export async function fetchRazorpayOrder(orderId) {
  const inst = instanceOrNull();
  if (!inst) throw new Error('razorpay_not_configured');
  return inst.orders.fetch(orderId);
}

export async function fetchRazorpayPayment(paymentId) {
  const inst = instanceOrNull();
  if (!inst) throw new Error('razorpay_not_configured');
  return inst.payments.fetch(paymentId);
}

export function verifyRazorpayPaymentSignature(orderId, paymentId, signature) {
  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!secret || !orderId || !paymentId) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const sig = String(signature || '').trim().toLowerCase();
  const exp = expected.toLowerCase();
  if (exp.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(exp, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * @param {Buffer} rawBody
 * @param {string | string[] | undefined} signatureHeader
 */
export function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const sig = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : String(signatureHeader || '').trim();
  const a = expected.toLowerCase();
  const b = sig.toLowerCase();
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

import { ApiError } from './http.js';

const BASE = 'https://api.paymongo.com/v1';
export const PAYMONGO_METHODS = ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph'];
export const METHOD_LABELS = { card: 'Card', gcash: 'GCash', paymaya: 'Maya', grab_pay: 'GrabPay', qrph: 'QR Ph' };
export const MIN_AMOUNT = 20;

async function call(secretKey, method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(502, 'Could not reach PayMongo. Please try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json.errors?.[0]?.detail || `PayMongo error ${res.status}`;
    throw new ApiError(res.status === 401 ? 400 : 502, res.status === 401 ? 'PayMongo rejected the secret key. Check that you copied the full key.' : detail);
  }
  return json.data;
}

export const keyMode = (secretKey) => (/^sk_live_/.test(secretKey) ? 'live' : /^sk_test_/.test(secretKey) ? 'test' : null);

export async function testKey(secretKey) {
  await call(secretKey, 'GET', '/webhooks');
  return true;
}

export function createCheckout(secretKey, { amount, name, description, reference, successUrl, cancelUrl, methods, billing, metadata }) {
  return call(secretKey, 'POST', '/checkout_sessions', {
    data: {
      attributes: {
        line_items: [{ currency: 'PHP', amount: Math.round(Number(amount) * 100), name: String(name).slice(0, 255), quantity: 1, description: description ? String(description).slice(0, 255) : undefined }],
        payment_method_types: methods,
        success_url: successUrl,
        cancel_url: cancelUrl,
        description: description ? String(description).slice(0, 255) : undefined,
        reference_number: reference,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        billing,
        metadata,
      },
    },
  });
}

export const getCheckout = (secretKey, id) => call(secretKey, 'GET', `/checkout_sessions/${encodeURIComponent(id)}`);

export function paidPayment(session) {
  const payments = session?.attributes?.payments || [];
  const paid = payments.find((p) => p.attributes?.status === 'paid');
  if (paid) return { id: paid.id, channel: paid.attributes?.source?.type || session.attributes?.payment_method_used || 'online' };
  const intent = session?.attributes?.payment_intent;
  if (intent?.attributes?.status === 'succeeded') return { id: intent.id, channel: session.attributes?.payment_method_used || 'online' };
  return null;
}

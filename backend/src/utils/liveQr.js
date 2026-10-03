import crypto from 'crypto';
import { env } from '../config/env.js';

export const QR_STEP_SEC = 30;
const PREFIX = 'GQ1';
const stepMs = QR_STEP_SEC * 1000;
const stepOf = (t = Date.now()) => Math.floor(t / stepMs);
const sign = (member, step) => crypto.createHmac('sha256', `${env.jwtSecret}:${member.qrToken}`).update(`${member._id}.${step}`).digest('hex').slice(0, 20);

export function liveQr(member, now = Date.now()) {
  const step = stepOf(now);
  return { code: `${PREFIX}.${member._id}.${step}.${sign(member, step)}`, expiresInMs: (step + 1) * stepMs - now, stepSec: QR_STEP_SEC };
}

export function parseLiveQr(code) {
  const [prefix, id, step, sig, extra] = String(code || '').trim().split('.');
  if (prefix !== PREFIX || extra !== undefined || !/^[a-f0-9]{24}$/.test(id || '') || !/^\d+$/.test(step || '') || !/^[a-f0-9]{20}$/.test(sig || '')) return null;
  return { id, step: Number(step), sig };
}

export function verifyLiveQr(member, parsed, now = Date.now()) {
  const current = stepOf(now);
  if (parsed.step > current || parsed.step < current - 1) return 'expired';
  const expected = Buffer.from(sign(member, parsed.step));
  const given = Buffer.from(parsed.sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? 'ok' : 'invalid';
}

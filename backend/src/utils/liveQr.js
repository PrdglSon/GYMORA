import crypto from 'crypto';
import { env } from '../config/env.js';

export const QR_VALID_SEC = 60;
const PREFIX = 'GQ2';
const sign = (member, issued) => crypto.createHmac('sha256', `${env.jwtSecret}:${member.qrToken}`).update(`${member._id}.${issued}`).digest('hex').slice(0, 20);

export function liveQr(member, now = Date.now()) {
  const issued = Math.floor(now / 1000);
  return { code: `${PREFIX}.${member._id}.${issued}.${sign(member, issued)}`, expiresInMs: QR_VALID_SEC * 1000, validSec: QR_VALID_SEC };
}

export function parseLiveQr(code) {
  const [prefix, id, issued, sig, extra] = String(code || '').trim().split('.');
  if (prefix !== PREFIX || extra !== undefined || !/^[a-f0-9]{24}$/.test(id || '') || !/^\d+$/.test(issued || '') || !/^[a-f0-9]{20}$/.test(sig || '')) return null;
  return { id, issued: Number(issued), sig };
}

export function verifyLiveQr(member, parsed, now = Date.now()) {
  const age = Math.floor(now / 1000) - parsed.issued;
  if (age < -5 || age > QR_VALID_SEC) return 'expired';
  const expected = Buffer.from(sign(member, parsed.issued));
  const given = Buffer.from(parsed.sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? 'ok' : 'invalid';
}

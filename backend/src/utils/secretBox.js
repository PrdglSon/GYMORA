import crypto from 'crypto';
import { env } from '../config/env.js';

const key = () => crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY || env.jwtSecret || 'gymora')).digest();

export function seal(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function open(sealed) {
  if (!sealed) return '';
  try {
    const [iv, tag, data] = String(sealed).split('.').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

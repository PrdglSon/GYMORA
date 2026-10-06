import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { env } from '../config/env.js';

const gmail = env.gmailApi;
export const usingGmailApi = !!(gmail.clientId && gmail.clientSecret && gmail.refreshToken);

const transporter = !usingGmailApi && env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  : null;

if (transporter) transporter.verify().catch((err) => console.error(`[email] SMTP login failed: ${err.message}`));

function parseFrom(from, fallbackEmail) {
  const m = String(from || '').match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'GYMORA', email: m[2].trim() };
  if (String(from || '').includes('@')) return { name: 'GYMORA', email: String(from).trim() };
  return { name: String(from || 'GYMORA').trim() || 'GYMORA', email: fallbackEmail };
}

let cachedToken = { value: '', expires: 0 };

async function gmailAccessToken() {
  if (cachedToken.value && Date.now() < cachedToken.expires) return cachedToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: gmail.clientId, client_secret: gmail.clientSecret, refresh_token: gmail.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail sign-in failed: ${data.error_description || data.error || res.status}`);
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function sendWithGmailApi(message) {
  const raw = await new Promise((resolve, reject) => new MailComposer(message).compile().build((err, out) => (err ? reject(err) : resolve(out))));
  const token = await gmailAccessToken();
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: raw.toString('base64url') }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) cachedToken = { value: '', expires: 0 };
    throw new Error(`Gmail API error ${res.status}: ${data.error?.message || 'unknown'}`);
  }
}

export async function deliver({ to, subject, text, html }) {
  const from = parseFrom(env.smtp.from, env.smtp.user);
  const message = { from: from.email ? `"${from.name}" <${from.email}>` : undefined, to, subject, text, html };
  if (usingGmailApi) return sendWithGmailApi(message);
  if (transporter) return transporter.sendMail(message);
  console.log(`[email] to=${to} subject="${subject}"\n${text || ''}`);
  return null;
}

export async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  const body = html || `<p>${(text || '').replace(/\n/g, '<br>')}</p>`;
  try {
    await deliver({ to, subject, text, html: body });
  } catch (err) {
    console.error(`[email] failed to ${to}: ${err.message}`);
  }
}

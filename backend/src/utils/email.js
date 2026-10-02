import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.smtp.host
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

export async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  const body = html || `<p>${(text || '').replace(/\n/g, '<br>')}</p>`;
  try {
    if (!transporter) {
      console.log(`[email] to=${to} subject="${subject}"\n${text || ''}`);
      return;
    }
    const from = parseFrom(env.smtp.from, env.smtp.user);
    await transporter.sendMail({ from: `"${from.name}" <${from.email}>`, to, subject, text, html: body });
  } catch (err) {
    console.error(`[email] failed to ${to}: ${err.message}`);
  }
}

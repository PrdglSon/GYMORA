import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

if (transporter) {
  transporter.verify().then(() => console.log(`Email ready: sending as ${env.smtp.user}`)).catch((err) => console.error(`[email] SMTP login failed: ${err.message}`));
} else {
  console.log('Email not configured: emails will be printed here instead of sent.');
}

export async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  if (!transporter) {
    console.log(`[email] to=${to} subject="${subject}"\n${text || ''}`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, text, html: html || `<p>${(text || '').replace(/\n/g, '<br>')}</p>` });
  } catch (err) {
    console.error('[email] failed:', err.message);
  }
}

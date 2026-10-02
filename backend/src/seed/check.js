import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { PlatformAdmin } from '../models/index.js';

const ok = (m) => console.log(`  OK    ${m}`);
const bad = (m) => console.log(`  FIX   ${m}`);
const mask = (s = '') => (s.length <= 4 ? '****' : `${s.slice(0, 2)}****${s.slice(-2)}`);

async function main() {
  console.log('\nGYMORA setup check\n');

  console.log('1. backend/.env');
  if (env.platformAdminEmail) ok(`PLATFORM_ADMIN_EMAIL = ${env.platformAdminEmail}`);
  else bad('PLATFORM_ADMIN_EMAIL is missing');
  if (env.platformAdminPassword) ok(`PLATFORM_ADMIN_PASSWORD is set (${mask(env.platformAdminPassword)}, ${env.platformAdminPassword.length} characters)`);
  else bad('PLATFORM_ADMIN_PASSWORD is missing');
  if (env.platformAdminPassword && env.platformAdminPassword !== env.platformAdminPassword.trim()) bad('PLATFORM_ADMIN_PASSWORD has a space at the start or end');
  ok(`CLIENT_URL = ${env.clientUrl}`);

  console.log('\n2. Database');
  try {
    await mongoose.connect(env.mongoUri);
    const name = mongoose.connection.name;
    if (name === 'test') bad('Connected, but to the "test" database. Add /gymora before the ? in MONGODB_URI');
    else ok(`Connected to database "${name}"`);
  } catch (err) {
    bad(`Cannot connect: ${err.message}`);
    return;
  }

  console.log('\n3. Owner account');
  const admins = await PlatformAdmin.find().select('+password');
  if (!admins.length) bad('No owner account exists. Run: npm run seed:owner');
  else admins.forEach((a) => console.log(`  info  Owner account in database: ${a.email} (${a.status})`));
  const email = (env.platformAdminEmail || '').toLowerCase().trim();
  const mine = admins.find((a) => a.email === email);
  if (email && admins.length && !mine) bad(`No owner account for ${email}. Run: npm run seed:owner`);
  if (mine) {
    if (await mine.checkPassword(env.platformAdminPassword || '')) ok(`Password in .env works for ${email}`);
    else bad(`Password in .env does NOT match ${email}. Run: npm run seed:owner (it resets it to the .env password)`);
    if (mine.status !== 'active') bad('Owner account is inactive. Run: npm run seed:owner');
  }

  console.log('\n4. Gmail (password reset emails)');
  if (!env.smtp.host) bad('SMTP_HOST is missing, so emails are only printed in the backend terminal');
  else {
    ok(`SMTP_HOST = ${env.smtp.host}, SMTP_PORT = ${env.smtp.port}`);
    if (!env.smtp.user) bad('SMTP_USER is missing');
    if (!env.smtp.pass) bad('SMTP_PASS is missing');
    else if (/\s/.test(env.smtp.pass)) bad('SMTP_PASS contains spaces. Type the 16-character App Password without spaces');
    else if (env.smtp.pass.length !== 16) bad(`SMTP_PASS is ${env.smtp.pass.length} characters. A Gmail App Password is 16 characters`);
    try {
      const t = nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: { user: env.smtp.user, pass: env.smtp.pass } });
      await t.verify();
      ok(`Gmail accepted the login for ${env.smtp.user}`);
      if (email) {
        await t.sendMail({ from: env.smtp.from, to: email, subject: 'GYMORA test email', text: 'If you can read this, GYMORA can send emails to the owner account.' });
        ok(`Test email sent to ${email}. Check Inbox and Spam`);
      }
    } catch (err) {
      bad(`Gmail refused: ${err.message}`);
    }
  }
  console.log('');
}

main()
  .catch((e) => console.error(e))
  .finally(() => mongoose.disconnect());

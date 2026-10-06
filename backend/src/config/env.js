import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    const dir = path.dirname(ENV_PATH);
    const similar = fs.readdirSync(dir).filter((f) => f.toLowerCase().includes('env'));
    console.error(`No .env file found at ${ENV_PATH}`);
    console.error(`Files in that folder with "env" in the name: ${similar.join(', ') || '(none)'}`);
    return;
  }
  const buf = fs.readFileSync(ENV_PATH);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le');
  else if (buf[0] === 0xfe && buf[1] === 0xff) text = Buffer.from(buf).swap16().toString('utf16le');
  else text = buf.toString('utf8');
  const parsed = dotenv.parse(text.replace(/^﻿/, ''));
  for (const [k, v] of Object.entries(parsed)) if (!process.env[k]) process.env[k] = v;
}
loadEnvFile();

process.env.TZ = process.env.TZ || 'Asia/Manila';

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in ${ENV_PATH}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: clientUrls[0] || 'http://localhost:5173',
  allowedOrigins: [...new Set([...clientUrls, 'http://localhost:5173'])],
  isAllowedOrigin(origin) {
    if (!origin) return true;
    const o = origin.replace(/\/+$/, '');
    return this.allowedOrigins.includes(o) || /^https:\/\/gymora[a-z0-9-]*\.vercel\.app$/i.test(o);
  },
  autoApproveGyms: String(process.env.AUTO_APPROVE_GYMS ?? 'true') === 'true',
  platformAdminEmail: process.env.PLATFORM_ADMIN_EMAIL,
  platformAdminPassword: process.env.PLATFORM_ADMIN_PASSWORD,
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'GYMORA <no-reply@gymora.app>',
  },
  gmailApi: {
    clientId: (process.env.GMAIL_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GMAIL_CLIENT_SECRET || '').trim(),
    refreshToken: (process.env.GMAIL_REFRESH_TOKEN || '').trim(),
  },
  dailyJobCron: process.env.DAILY_JOB_CRON || '0 2 * * *',
};

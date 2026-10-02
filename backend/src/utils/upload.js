import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from './http.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

if (env.cloudinaryUrl) cloudinary.config({ secure: true });

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Upload a JPG, PNG, WEBP, GIF or PDF up to 5 MB.'))),
});

export async function saveFile(file, folder = 'misc') {
  if (!file) return null;
  if (env.cloudinaryUrl) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: `gymora/${folder}`, resource_type: 'auto' }, (err, res) => (err ? reject(err) : resolve(res)));
      stream.end(file.buffer);
    });
    return result.secure_url;
  }
  const ext = path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), file.buffer);
  return `/uploads/${folder}/${name}`;
}

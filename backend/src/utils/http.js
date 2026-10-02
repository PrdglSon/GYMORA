export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj?.[f] === undefined || obj?.[f] === null || String(obj[f]).trim() === '');
  if (missing.length) throw new ApiError(400, `Please fill in: ${missing.join(', ')}`);
}

export function pick(body, keys) {
  const out = {};
  for (const k of keys) if (body?.[k] !== undefined) out[k] = body[k];
  return out;
}

export const notFound = (what = 'Record') => new ApiError(404, `${what} not found`);

export function paging(q, defLimit = 50) {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || defLimit, 1), 200);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, skip: (page - 1) * limit, page };
}

export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

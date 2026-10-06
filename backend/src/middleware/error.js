import { ApiError } from '../utils/http.js';

export function notFoundRoute(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;
  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    const custom = Object.values(err.errors).map((e) => e.message).filter((m) => !m.startsWith('Path `'));
    message = custom.length ? [...new Set(custom)].join(' ') : `Some fields are invalid: ${Object.keys(details).join(', ')}`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {}).filter((k) => k !== 'gym').join(', ');
    message = `That ${field || 'value'} is already in use.`;
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB.' : err.message;
  } else if (!(err instanceof ApiError) && status === 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong on the server.';
  }
  if (res.headersSent) return next(err);
  res.status(status).json({ message, details });
}

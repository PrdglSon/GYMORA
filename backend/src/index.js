import { env } from './config/env.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDB } from './config/db.js';
import { setIO, rooms } from './utils/socket.js';
import { scheduleJobs } from './jobs/daily.js';
import { ACCOUNT_MODELS, roleOf } from './middleware/auth.js';

async function start() {
  await connectDB();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: (origin, cb) => cb(null, env.isAllowedOrigin(origin)), credentials: true } });

  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, env.jwtSecret);
      const Model = ACCOUNT_MODELS[payload.type];
      const account = Model ? await Model.findById(payload.sub) : null;
      if (!account || account.status !== 'active') return next(new Error('unauthorized'));
      socket.data = { type: payload.type, id: String(account._id), gym: account.gym ? String(account.gym) : null, role: roleOf(payload.type, account) };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { type, id, gym, role } = socket.data;
    socket.join(rooms.account(type, id));
    if (gym) {
      socket.join(rooms.gym(gym));
      if (role === 'admin' || role === 'receptionist') socket.join(rooms.staff(gym));
    }
  });

  setIO(io);
  scheduleJobs();
  server.listen(env.port, () => console.log(`GYMORA API running on http://localhost:${env.port}`));
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Gym, StaffAdmin, Member, Coach, PlatformAdmin } from '../models/index.js';
import { ApiError, ah } from '../utils/http.js';

export const ACCOUNT_MODELS = { StaffAdmin, Member, Coach, PlatformAdmin };

export const PORTALS = {
  admin: { model: 'StaffAdmin', role: 'admin', label: 'Administrator' },
  staff: { model: 'StaffAdmin', role: 'receptionist', label: 'Staff' },
  coach: { model: 'Coach', role: 'coach', label: 'Coach' },
  member: { model: 'Member', role: 'member', label: 'Member' },
  platform: { model: 'PlatformAdmin', role: 'platform', label: 'Platform Admin' },
};

export function roleOf(type, account) {
  if (type === 'StaffAdmin') return account.role;
  if (type === 'Coach') return 'coach';
  if (type === 'Member') return 'member';
  return 'platform';
}

export function signToken(type, account) {
  return jwt.sign({ sub: String(account._id), type, gym: account.gym ? String(account.gym) : null }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export const protect = ah(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please log in.');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new ApiError(401, 'Your session expired. Please log in again.');
  }
  const Model = ACCOUNT_MODELS[payload.type];
  const account = Model ? await Model.findById(payload.sub) : null;
  if (!account || account.status !== 'active') throw new ApiError(401, 'This account is not active.');
  req.account = account;
  req.accountType = payload.type;
  req.role = roleOf(payload.type, account);
  if (payload.type !== 'PlatformAdmin') {
    const gym = await Gym.findById(account.gym).lean();
    if (!gym) throw new ApiError(401, 'Gym not found.');
    if (gym.status !== 'active') throw new ApiError(403, gym.status === 'pending' ? 'Your gym is waiting for approval.' : 'This gym account is suspended.');
    req.gym = gym;
    req.gymId = gym._id;
  }
  if (payload.type === 'Member') req.member = account;
  if (payload.type === 'Coach') req.coach = account;
  next();
});

export const allow = (...roles) => (req, res, next) => {
  if (!req.role || !roles.includes(req.role)) return next(new ApiError(403, 'You do not have access to this feature.'));
  next();
};

export const STAFF = ['admin', 'receptionist'];

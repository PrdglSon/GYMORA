import { Gym, StaffAdmin, MembershipPlan } from '../models/index.js';
import { seedNutritionRules } from './rules.js';
import { ApiError } from './http.js';

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 40) || 'gym';
}

export async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await Gym.exists({ slug }); i++) slug = `${base}-${i}`;
  return slug;
}

export const DEFAULT_PLANS = [
  { planName: 'Basic Monthly', price: 1200, duration: 30, description: 'Gym floor access during staffed hours.', sortOrder: 1 },
  { planName: 'Elite Monthly', price: 2499, duration: 30, description: 'Unlimited programs, monthly coach consult, locker.', highlight: true, sortOrder: 2 },
  { planName: 'Student Monthly', price: 899, duration: 30, description: 'Gym floor and 4 programs. Requires a verified school ID.', isStudentPlan: true, sortOrder: 3 },
  { planName: 'Elite Quarterly', price: 6799, duration: 90, description: 'Elite Monthly benefits for 3 months.', sortOrder: 4 },
];

export async function createGymWithOwner({ gym: g, owner, status = 'active', slug }) {
  const gym = await Gym.create({ ...g, slug: slug || (await uniqueSlug(g.name)), status });
  try {
    const admin = await StaffAdmin.create({ ...owner, role: 'admin', gym: gym._id });
    gym.owner = admin._id;
    await gym.save();
    await MembershipPlan.insertMany(DEFAULT_PLANS.map((p) => ({ ...p, gym: gym._id })));
    await seedNutritionRules(gym._id);
    return { gym, admin };
  } catch (err) {
    await Gym.deleteOne({ _id: gym._id });
    if (err.code === 11000) throw new ApiError(409, 'That email is already registered.');
    throw err;
  }
}

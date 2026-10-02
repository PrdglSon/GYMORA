import { Attendance, FitnessProgress, CommunityPost, Enrollment, Achievement, NutritionRule, Coach, CoachSpecialization } from '../models/index.js';
import { notify, toMember } from './notify.js';
import { dayKey, addDays, startOfDay } from './dates.js';

export const BADGES = [
  { key: 'first_checkin', name: 'First Check-in', rule: 'Tap in for the first time', test: (s) => s.visits >= 1 },
  { key: 'visits_10', name: '10 Visits', rule: 'Tap in 10 times', test: (s) => s.visits >= 10 },
  { key: 'visits_25', name: '25 Visits', rule: 'Tap in 25 times', test: (s) => s.visits >= 25 },
  { key: 'visits_50', name: '50 Visits', rule: 'Tap in 50 times', test: (s) => s.visits >= 50 },
  { key: 'streak_3', name: 'On a Roll', rule: 'Visit 3 days in a row', test: (s) => s.streak >= 3 },
  { key: 'streak_7', name: 'Unstoppable', rule: 'Visit 7 days in a row', test: (s) => s.streak >= 7 },
  { key: 'progress_3', name: 'Tracking It', rule: 'Log 3 progress records', test: (s) => s.progressCount >= 3 },
  { key: 'down_2kg', name: 'Down 2 kg', rule: 'Lose 2 kg from your first record', test: (s) => s.weightChange <= -2 },
  { key: 'up_2kg', name: 'Gained 2 kg', rule: 'Gain 2 kg with a muscle gain goal', test: (s) => s.goal === 'Muscle Gain' && s.weightChange >= 2 },
  { key: 'first_program', name: 'Joined a Program', rule: 'Enroll in a fitness program', test: (s) => s.programs >= 1 },
  { key: 'community', name: 'Community Voice', rule: 'Share a Community Hub post', test: (s) => s.posts >= 1 },
];

export async function memberStats(member) {
  const [visits, progress, posts, programs] = await Promise.all([
    Attendance.find({ member: member._id }).select('timeIn').sort({ timeIn: -1 }).lean(),
    FitnessProgress.find({ member: member._id }).sort({ recordDate: 1 }).lean(),
    CommunityPost.countDocuments({ author: member._id, authorType: 'Member' }),
    Enrollment.countDocuments({ member: member._id, status: 'Active' }),
  ]);
  const days = new Set(visits.map((v) => dayKey(v.timeIn)));
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    if (days.has(dayKey(addDays(startOfDay(), -i)))) streak++;
    else if (i > 0) break;
  }
  const w = progress.filter((p) => p.weight);
  const weightChange = w.length > 1 ? w[w.length - 1].weight - w[0].weight : 0;
  return { visits: visits.length, streak, progressCount: progress.length, weightChange, posts, programs, goal: member.fitnessGoal };
}

export async function evaluateBadges(member) {
  const stats = await memberStats(member);
  const owned = new Set((await Achievement.find({ member: member._id }).lean()).map((a) => a.badgeKey));
  const fresh = BADGES.filter((b) => !owned.has(b.key) && b.test(stats));
  if (fresh.length) {
    await Achievement.insertMany(fresh.map((b) => ({ gym: member.gym, member: member._id, badgeKey: b.key })), { ordered: false }).catch(() => {});
    await notify(toMember(member._id), { gym: member.gym, type: 'Achievement', title: 'New badge unlocked', message: fresh.map((b) => b.name).join(', '), link: '/member/progress' });
  }
  const all = await Achievement.find({ member: member._id }).lean();
  const at = Object.fromEntries(all.map((a) => [a.badgeKey, a.earnedAt]));
  return { stats, badges: BADGES.map(({ test, ...b }) => ({ ...b, earned: !!at[b.key], earnedAt: at[b.key] || null })) };
}

export const GOAL_SPECIALIZATIONS = {
  'Weight Loss': ['Weight Loss', 'HIIT', 'Zumba', 'Functional Fitness'],
  'Muscle Gain': ['Bodybuilding', 'Strength Training', 'Personal Coaching'],
  Strength: ['Strength Training', 'Bodybuilding', 'Functional Fitness'],
  'General Fitness': ['Functional Fitness', 'HIIT', 'Strength Training', 'Zumba'],
  Endurance: ['HIIT', 'Muay Thai', 'Functional Fitness'],
  Flexibility: ['Yoga', 'Pilates', 'Mobility'],
};

export async function specializationsByCoach(gym) {
  const rows = await CoachSpecialization.find({ gym }).lean();
  const map = {};
  rows.forEach((r) => (map[String(r.coach)] = [...(map[String(r.coach)] || []), r.specializationName]));
  return map;
}

export async function matchCoaches(gym, goal, { limit = 5 } = {}) {
  const wanted = GOAL_SPECIALIZATIONS[goal] || [];
  const [coaches, specs] = await Promise.all([Coach.find({ gym, status: 'active', activeStatus: 'Active' }).lean(), specializationsByCoach(gym)]);
  return coaches
    .map((c) => {
      const list = specs[String(c._id)] || [];
      const matched = list.filter((s) => wanted.includes(s));
      const score = matched.length * 30 + (c.availabilityStatus === 'Available' ? 15 : c.availabilityStatus === 'In Session' ? 5 : 0) + Math.min(c.experience || 0, 10);
      return { coach: c, specializations: list, matched, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function bmi(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weight / (m * m)) * 10) / 10;
}
export function bmiBand(v) {
  if (v == null) return null;
  if (v < 18.5) return 'Underweight';
  if (v < 25) return 'Normal';
  if (v < 30) return 'Overweight';
  return 'Obese';
}

export const DEFAULT_NUTRITION_RULES = [
  { goal: 'Weight Loss', title: 'Lose fat steadily', tips: ['Aim for a 300–500 kcal daily deficit.', 'Fill half your plate with vegetables.', 'Eat protein at every meal: eggs, fish, chicken, tofu.', 'Swap sugary drinks for water.'] },
  { goal: 'Muscle Gain', title: 'Build muscle', tips: ['Eat about 1.6–2.2 g protein per kg body weight daily.', 'Add a 250–400 kcal surplus on training days.', 'Have a carb and protein meal within 2 hours after lifting.'] },
  { goal: 'Strength', title: 'Fuel heavy sessions', tips: ['Get about 1.6 g protein per kg daily.', 'Eat carbs 1–2 hours before heavy sessions.', 'Sleep 7–9 hours to recover.'] },
  { goal: 'Endurance', title: 'Fuel long sessions', tips: ['Carbs fuel long sessions: rice, oats, sweet potato.', 'Replace electrolytes after heavy sweating.', 'Spread protein across 4 meals.'] },
  { goal: 'Flexibility', title: 'Support recovery', tips: ['Stay hydrated through the day.', 'Omega-3 sources like sardines and bangus support joints.', 'Build balanced plates: protein, carbs, vegetables.'] },
  { goal: 'General Fitness', title: 'Eat balanced', tips: ['Build meals around lean protein, whole grains and vegetables.', 'Choose fruit as your default snack.', 'Limit fried and ultra-processed food.'] },
  { goal: 'Any', bmiMin: 0, bmiMax: 18.5, title: 'BMI below 18.5', tips: ['Add calorie-dense whole foods like nuts, rice and peanut butter.', 'Eat 4–5 smaller meals if big meals are hard.'] },
  { goal: 'Any', bmiMin: 25, bmiMax: 100, title: 'BMI 25 and above', tips: ['Watch portion sizes, especially rice and late-night snacks.', 'Walk 7,000+ steps on rest days.'] },
];

export async function seedNutritionRules(gym) {
  if (!(await NutritionRule.countDocuments({ gym }))) await NutritionRule.insertMany(DEFAULT_NUTRITION_RULES.map((r) => ({ gym, bmiMin: 0, bmiMax: 100, ...r })));
}

export async function nutritionFor(member) {
  const latest = await FitnessProgress.findOne({ member: member._id, weight: { $ne: null } }).sort({ recordDate: -1 }).lean();
  const value = latest ? bmi(latest.weight, member.heightCm) : null;
  const rules = await NutritionRule.find({ gym: member.gym, status: 'Active', goal: { $in: [member.fitnessGoal, 'Any'] } }).lean();
  const applicable = rules.filter((r) => (r.goal !== 'Any' && (value == null || (value >= r.bmiMin && value < r.bmiMax))) || (r.goal === 'Any' && value != null && value >= r.bmiMin && value < r.bmiMax));
  return {
    goal: member.fitnessGoal,
    bmi: value,
    band: bmiBand(value),
    rules: applicable.map((r) => ({ title: r.title, tips: r.tips })),
    disclaimer: 'General fitness guidance from preset rules. Not a substitute for professional medical or dietary advice.',
  };
}

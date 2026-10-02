import { Router } from 'express';
import { NutritionRule } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, requireFields, pick, notFound } from '../utils/http.js';
import { evaluateBadges, nutritionFor, BADGES } from '../utils/rules.js';
import { audit } from '../utils/audit.js';

const r = Router();
r.use(protect);
const FIELDS = ['goal', 'bmiMin', 'bmiMax', 'title', 'tips', 'status'];

r.get('/badges', (req, res) => res.json(BADGES.map(({ test, ...b }) => b)));
r.get('/badges/me', allow('member'), ah(async (req, res) => res.json(await evaluateBadges(req.member))));
r.get('/nutrition/me', allow('member'), ah(async (req, res) => res.json(await nutritionFor(req.member))));

r.get('/nutrition-rules', allow('admin'), ah(async (req, res) => res.json(await NutritionRule.find({ gym: req.gymId }).sort({ goal: 1, bmiMin: 1 }))));
r.post('/nutrition-rules', allow('admin'), ah(async (req, res) => {
  requireFields(req.body, ['goal', 'title']);
  const rule = await NutritionRule.create({ gym: req.gymId, ...pick(req.body, FIELDS) });
  audit(req, 'Nutrition Recommendations', `Added rule "${rule.title}"`);
  res.status(201).json(rule);
}));
r.patch('/nutrition-rules/:id', allow('admin'), ah(async (req, res) => {
  const rule = await NutritionRule.findOne({ _id: req.params.id, gym: req.gymId });
  if (!rule) throw notFound('Rule');
  Object.assign(rule, pick(req.body, FIELDS));
  await rule.save();
  audit(req, 'Nutrition Recommendations', `Edited rule "${rule.title}"`);
  res.json(rule);
}));
r.delete('/nutrition-rules/:id', allow('admin'), ah(async (req, res) => {
  await NutritionRule.deleteOne({ _id: req.params.id, gym: req.gymId });
  audit(req, 'Nutrition Recommendations', 'Deleted a rule');
  res.json({ ok: true });
}));

export default r;

import { Router } from 'express';
import { protect, allow } from '../middleware/auth.js';
import { ah } from '../utils/http.js';
import { evaluateBadges, BADGES } from '../utils/rules.js';

const r = Router();
r.use(protect);

r.get('/badges', (req, res) => res.json(BADGES.map(({ test, ...b }) => b)));
r.get('/badges/me', allow('member'), ah(async (req, res) => res.json(await evaluateBadges(req.member))));

export default r;

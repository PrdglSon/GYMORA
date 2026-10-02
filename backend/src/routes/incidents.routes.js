import { Router } from 'express';
import { IncidentReport, Equipment, nextCode, INCIDENT_CATEGORIES } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick, notFound, paging } from '../utils/http.js';
import { notify, notifyStaff } from '../utils/notify.js';
import { audit } from '../utils/audit.js';

const r = Router();
r.use(protect);

r.post('/', allow('member', 'coach'), ah(async (req, res) => {
  requireFields(req.body, ['category', 'subject', 'description']);
  if (!INCIDENT_CATEGORIES.includes(req.body.category)) throw new ApiError(400, 'Choose a category.');
  const name = `${req.account.firstName} ${req.account.lastName}`;
  const report = await IncidentReport.create({
    gym: req.gymId, reportNo: await nextCode(req.gymId, 'incident'), reporterType: req.accountType, reporter: req.account._id, member: req.member?._id, reporterName: name,
    ...pick(req.body, ['category', 'subject', 'description', 'priority']), equipment: req.body.equipmentId || undefined, history: [{ byName: name, status: 'Open', note: 'Submitted' }],
  });
  if (report.equipment) await Equipment.updateOne({ _id: report.equipment, gym: req.gymId, status: 'Operational' }, { status: 'Needs Maintenance', $push: { maintenanceLog: { action: `Reported in ${report.reportNo}`, byName: name } } });
  await notifyStaff(req.gymId, { type: 'Incident', title: `New ${report.category.toLowerCase()} report`, message: `${name}: ${report.subject}`, link: '/admin/incidents' });
  res.status(201).json(report);
}));

r.get('/mine', ah(async (req, res) => {
  res.json(await IncidentReport.find({ gym: req.gymId, reporter: req.account._id }).sort({ dateReported: -1 }).lean());
}));

r.get('/', allow(...STAFF), ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 100);
  const filter = { gym: req.gymId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;
  const [items, total, counts] = await Promise.all([
    IncidentReport.find(filter).sort({ dateReported: -1 }).skip(skip).limit(limit).populate('equipment', 'equipmentName code').lean(),
    IncidentReport.countDocuments(filter),
    IncidentReport.aggregate([{ $match: { gym: req.gymId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ items, total, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
}));

r.patch('/:id', allow(...STAFF), ah(async (req, res) => {
  const report = await IncidentReport.findOne({ _id: req.params.id, gym: req.gymId });
  if (!report) throw notFound('Report');
  const before = report.status;
  Object.assign(report, pick(req.body, ['status', 'resolution', 'priority', 'category']));
  if (['Resolved', 'Closed'].includes(report.status) && !report.resolvedAt) report.resolvedAt = new Date();
  report.history.push({ byName: `${req.account.firstName} ${req.account.lastName}`, status: report.status, note: req.body.resolution ? 'Responded' : before !== report.status ? `Status ${before} → ${report.status}` : 'Updated' });
  await report.save();
  await notify({ type: report.reporterType, id: report.reporter }, { gym: req.gymId, type: 'Incident', title: `${report.reportNo}: ${report.status}`, message: report.resolution || 'Your report was updated.', link: report.reporterType === 'Member' ? '/member/help' : '/coach/help' });
  audit(req, 'Incident and Concern Management', `${report.reportNo} → ${report.status}`);
  res.json(report);
}));

export default r;

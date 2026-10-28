import { Router } from 'express';
import { Payment, PosTransaction, PosItem, Attendance, Member, FitnessProgram, ProgramSchedule, Enrollment, Product, IncidentReport, Inquiry, Equipment, Coach, MembershipPlan, Expense } from '../models/index.js';
import { monthRange } from '../utils/month.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah } from '../utils/http.js';
import { startOfDay, addDays, dayKey, atTime, startOfWeek, hhmmToMinutes } from '../utils/dates.js';
import { fullName } from '../utils/format.js';
import { clientIdsOf } from './coaches.routes.js';

const r = Router();
r.use(protect);

function seriesByDay(docs, field, days, valueFn = () => 1) {
  const start = addDays(startOfDay(), -(days - 1));
  const keys = Array.from({ length: days }, (_, i) => dayKey(addDays(start, i)));
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  docs.forEach((d) => {
    const k = dayKey(d[field]);
    if (k in map) map[k] += valueFn(d);
  });
  return keys.map((k) => ({ date: k, value: Math.round(map[k] * 100) / 100 }));
}

function sessionState(s) {
  if (s.status === 'Cancelled') return 'Cancelled';
  const now = new Date();
  if (now > atTime(s.scheduleDate, s.endTime)) return 'Completed';
  if (now >= atTime(s.scheduleDate, s.startTime)) return 'In Progress';
  return 'Upcoming';
}

async function enrolledMap(gym) {
  const rows = await Enrollment.aggregate([{ $match: { gym, status: 'Active' } }, { $group: { _id: '$program', n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((x) => [String(x._id), x.n]));
}

r.get('/dashboard', allow(...STAFF), ah(async (req, res) => {
  const g = req.gymId;
  const s = req.gym.settings;
  const today = startOfDay();
  const yesterday = addDays(today, -1);
  const since30 = addDays(today, -29);
  const near = addDays(today, s.nearExpiryDays);
  const count = (f) => Member.countDocuments({ gym: g, ...f });
  const [att30, pay30, pos30, members30, totalMembers, active, nearExp, expired, pending, unpaid, sessions, enrolled, programs, lowStock, openIncidents, openInquiries, studentPending, equipmentDue, recent] = await Promise.all([
    Attendance.find({ gym: g, timeIn: { $gte: since30 } }).select('attendeeType timeIn timeOut').lean(),
    Payment.find({ gym: g, status: 'Paid', paymentDate: { $gte: since30 } }).select('amount paymentDate').lean(),
    PosTransaction.find({ gym: g, status: 'Completed', transactionDate: { $gte: since30 } }).select('productAmount transactionDate').lean(),
    Member.find({ gym: g, registrationDate: { $gte: since30 } }).select('registrationDate').lean(),
    count({}), count({ 'current.endDate': { $gt: near } }), count({ 'current.endDate': { $gte: today, $lte: near } }), count({ 'current.endDate': { $lt: today } }), count({ 'current.endDate': null }),
    Payment.aggregate([{ $match: { gym: g, status: 'Unpaid' } }, { $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    ProgramSchedule.find({ gym: g, scheduleDate: today }).populate('program', 'programName capacity').populate('coach', 'firstName lastName').sort({ startTime: 1 }).lean(),
    enrolledMap(g),
    FitnessProgram.find({ gym: g, status: 'Active' }).select('programName capacity').lean(),
    Product.find({ gym: g, status: 'Active', $expr: { $lte: ['$stockQuantity', '$reorderLevel'] } }).select('productName stockQuantity').limit(5).lean(),
    IncidentReport.find({ gym: g, status: { $in: ['Open', 'In Progress'] } }).select('subject reportNo').sort({ dateReported: -1 }).lean(),
    Inquiry.countDocuments({ gym: g, status: { $in: ['Open', 'In Progress'] } }),
    Member.find({ gym: g, 'student.status': 'pending' }).select('firstName lastName memberCode').lean(),
    Equipment.find({ gym: g, $or: [{ status: { $ne: 'Operational' } }, { nextServiceAt: { $lte: addDays(today, 7) } }] }).select('equipmentName code status nextServiceAt').lean(),
    Payment.find({ gym: g }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);
  const income = [...pay30.map((p) => ({ amount: p.amount, at: p.paymentDate })), ...pos30.map((p) => ({ amount: p.productAmount, at: p.transactionDate }))];
  const sum = (arr) => arr.reduce((a, p) => a + p.amount, 0);
  const tA = att30.filter((a) => a.timeIn >= today);
  const yA = att30.filter((a) => a.timeIn >= yesterday && a.timeIn < today);
  res.json({
    cards: {
      totalMembers, newMembers30: members30.length,
      membersToday: tA.filter((a) => a.attendeeType === 'Member').length, membersYesterday: yA.filter((a) => a.attendeeType === 'Member').length,
      walkinsToday: tA.filter((a) => a.attendeeType === 'Walk-in').length, walkinsYesterday: yA.filter((a) => a.attendeeType === 'Walk-in').length,
      salesToday: sum(income.filter((p) => p.at >= today)), salesYesterday: sum(income.filter((p) => p.at >= yesterday && p.at < today)),
      unpaidTotal: unpaid[0]?.total || 0, unpaidCount: unpaid[0]?.n || 0, inGymNow: tA.filter((a) => !a.timeOut).length, checkinsToday: tA.length,
    },
    series: { revenue: seriesByDay(income, 'at', 30, (p) => p.amount), checkins: seriesByDay(att30, 'timeIn', 30), newMembers: seriesByDay(members30, 'registrationDate', 30) },
    membershipStatus: { active, nearExpiry: nearExp, expired, pending },
    todaysClasses: sessions.filter((x) => x.program).map((x) => ({ _id: x._id, programName: x.program.programName, coachName: fullName(x.coach), startTime: x.startTime, endTime: x.endTime, start: atTime(x.scheduleDate, x.startTime), capacity: x.program.capacity, enrolled: enrolled[String(x.program._id)] || 0, state: sessionState(x) })),
    alerts: { lowStock, openIncidents: openIncidents.length, latestIncident: openIncidents[0]?.subject, openInquiries, nearExpiry: nearExp, studentPending: studentPending.map((m) => ({ id: m._id, name: fullName(m), code: m.memberCode })), equipment: equipmentDue },
    recentPayments: recent,
    topPrograms: programs.map((p) => ({ programName: p.programName, enrolled: enrolled[String(p._id)] || 0, capacity: p.capacity })).sort((a, b) => b.enrolled - a.enrolled).slice(0, 5),
  });
}));

function seriesForMonth(docs, field, range, valueFn = () => 1) {
  const keys = Array.from({ length: range.daysInMonth }, (_, i) => dayKey(addDays(range.start, i)));
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  docs.forEach((d) => {
    const k = dayKey(d[field]);
    if (k in map) map[k] += valueFn(d);
  });
  return keys.map((k) => ({ date: k, value: Math.round(map[k] * 100) / 100 }));
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

r.get('/analytics', allow('admin'), ah(async (req, res) => {
  const g = req.gymId;
  const range = monthRange(req.query.month);
  const inMonth = { $gte: range.start, $lt: range.end };
  const prev = monthRange(dayKey(addDays(range.start, -1)).slice(0, 7));
  const weekStart = startOfWeek();
  const [pays, pos, att, newMembers, plans, planCounts, coaches, programs, enrolled, weekSessions, totalMembers, current, expenses, prevPays, prevPos, prevExpenses] = await Promise.all([
    Payment.find({ gym: g, status: 'Paid', paymentDate: inMonth }).select('amount paymentDate paymentType paymentMethod').lean(),
    PosTransaction.find({ gym: g, status: 'Completed', transactionDate: inMonth }).select('_id productAmount transactionDate paymentMethod').lean(),
    Attendance.find({ gym: g, timeIn: inMonth }).select('timeIn attendeeType guestType').lean(),
    Member.find({ gym: g, registrationDate: inMonth }).select('registrationDate').lean(),
    MembershipPlan.find({ gym: g }).lean(),
    Member.aggregate([{ $match: { gym: g, 'current.endDate': { $gte: startOfDay() } } }, { $group: { _id: '$current.plan', n: { $sum: 1 } } }]),
    Coach.find({ gym: g, status: 'active' }).lean(),
    FitnessProgram.find({ gym: g, status: 'Active' }).lean(),
    enrolledMap(g),
    ProgramSchedule.find({ gym: g, status: 'Scheduled', scheduleDate: { $gte: weekStart, $lt: addDays(weekStart, 7) } }).lean(),
    Member.countDocuments({ gym: g }),
    Member.countDocuments({ gym: g, 'current.endDate': { $gte: startOfDay() } }),
    Expense.find({ gym: g, date: inMonth }).lean(),
    Payment.find({ gym: g, status: 'Paid', paymentDate: { $gte: prev.start, $lt: prev.end } }).select('amount').lean(),
    PosTransaction.find({ gym: g, status: 'Completed', transactionDate: { $gte: prev.start, $lt: prev.end } }).select('productAmount').lean(),
    Expense.find({ gym: g, date: { $gte: prev.start, $lt: prev.end } }).select('amount').lean(),
  ]);
  const items = await PosItem.find({ transaction: { $in: pos.map((p) => p._id) }, itemType: 'Product' }).lean();
  const productTotals = {};
  items.forEach((i) => {
    productTotals[i.itemName] = productTotals[i.itemName] || { quantity: 0, revenue: 0 };
    productTotals[i.itemName].quantity += i.quantity;
    productTotals[i.itemName].revenue += i.quantity * i.price;
  });
  const hourly = Array(24).fill(0);
  att.forEach((a) => hourly[new Date(a.timeIn).getHours()]++);
  const planName = Object.fromEntries(plans.map((p) => [String(p._id), p.planName]));
  const byType = (t) => pays.filter((p) => p.paymentType === t);
  const posIncome = pos.map((p) => ({ amount: p.productAmount || 0, at: p.transactionDate, method: p.paymentMethod }));
  const totalOf = (arr) => r2(arr.reduce((a, p) => a + (p.amount || 0), 0));
  const sales = r2(totalOf(pays) + totalOf(posIncome));
  const expenseTotal = totalOf(expenses);
  const prevSales = r2(totalOf(prevPays) + prevPos.reduce((a, p) => a + (p.productAmount || 0), 0));
  const prevExpenseTotal = totalOf(prevExpenses);
  const byCategory = {};
  expenses.forEach((e) => (byCategory[e.category] = r2((byCategory[e.category] || 0) + e.amount)));
  const methods = {};
  const addMethod = (m, amt) => {
    const k = m && m !== 'Unpaid' ? m : 'Other';
    methods[k] = methods[k] || { method: k, count: 0, amount: 0 };
    methods[k].count += 1;
    methods[k].amount = r2(methods[k].amount + (amt || 0));
  };
  pays.forEach((p) => addMethod(p.paymentMethod, p.amount));
  posIncome.filter((p) => p.amount > 0).forEach((p) => addMethod(p.method, p.amount));
  const dayCount = Math.max(range.elapsed, 1);
  res.json({
    month: range.key,
    label: range.label,
    days: range.daysInMonth,
    daysCounted: range.elapsed,
    isCurrentMonth: range.isCurrent,
    profit: {
      sales,
      expenses: expenseTotal,
      net: r2(sales - expenseTotal),
      previous: { month: prev.key, label: prev.label, sales: prevSales, expenses: prevExpenseTotal, net: r2(prevSales - prevExpenseTotal) },
      expensesByCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    },
    totals: {
      revenue: sales,
      byType: { membership: totalOf(byType('Membership')), walkin: totalOf(byType('Walk-in')), retail: totalOf(posIncome), other: totalOf(byType('Other')) },
      checkins: att.length,
      walkins: att.filter((a) => a.attendeeType === 'Walk-in').length,
      studentWalkins: att.filter((a) => a.attendeeType === 'Walk-in' && a.guestType === 'Student').length,
      newMembers: newMembers.length,
      retention: totalMembers ? Math.round((current / totalMembers) * 100) : 0, currentMembers: current, totalMembers,
    },
    revenue: {
      membership: seriesForMonth(byType('Membership'), 'paymentDate', range, (p) => p.amount),
      walkin: seriesForMonth(byType('Walk-in'), 'paymentDate', range, (p) => p.amount),
      retail: seriesForMonth([...posIncome, ...byType('Other').map((p) => ({ amount: p.amount, at: p.paymentDate }))], 'at', range, (p) => p.amount),
      expenses: seriesForMonth(expenses, 'date', range, (e) => e.amount),
    },
    methods: Object.values(methods).sort((a, b) => b.amount - a.amount),
    checkins: seriesForMonth(att, 'timeIn', range),
    newMembers: seriesForMonth(newMembers, 'registrationDate', range),
    avgByHour: hourly.map((n) => Math.round((n / dayCount) * 10) / 10),
    planDistribution: planCounts.map((m) => ({ plan: planName[String(m._id)] || 'Other', members: m.n })),
    coachUtilization: coaches.map((c) => {
      const ps = programs.filter((p) => String(p.coach) === String(c._id));
      const ss = weekSessions.filter((s) => String(s.coach) === String(c._id));
      const hours = ss.reduce((a, s) => a + (hhmmToMinutes(s.endTime) - hhmmToMinutes(s.startTime)), 0) / 60;
      const fill = ps.length ? Math.round((ps.reduce((a, p) => a + (enrolled[String(p._id)] || 0) / p.capacity, 0) / ps.length) * 100) : 0;
      return { coach: fullName(c), availabilityStatus: c.availabilityStatus, programs: ps.length, sessionsThisWeek: ss.length, hoursThisWeek: Math.round(hours * 10) / 10, avgFill: fill };
    }),
    topProducts: Object.entries(productTotals).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    programPerformance: programs.map((p) => ({ programName: p.programName, enrolled: enrolled[String(p._id)] || 0, capacity: p.capacity })).sort((a, b) => b.enrolled - a.enrolled),
  });
}));

r.get('/coach', allow('coach'), ah(async (req, res) => {
  const { ids, programs } = await clientIdsOf(req.coach);
  const enrolled = await enrolledMap(req.gymId);
  const full = await FitnessProgram.find({ _id: { $in: programs.map((p) => p._id) }, status: 'Active' }).lean();
  const sessions = await ProgramSchedule.find({ coach: req.coach._id, scheduleDate: startOfDay() }).populate('program', 'programName capacity').sort({ startTime: 1 }).lean();
  const since = addDays(startOfDay(), -29);
  const visits = await Attendance.find({ member: { $in: ids }, timeIn: { $gte: since } }).select('timeIn member').lean();
  const cut = addDays(startOfDay(), -req.gym.settings.inactiveDays);
  const members = await Member.find({ _id: { $in: ids } }).select('firstName lastName lastVisitAt memberCode fitnessGoal').lean();
  const per = {};
  visits.forEach((v) => (per[String(v.member)] = (per[String(v.member)] || 0) + 1));
  res.json({
    sessionsToday: sessions.filter((s) => s.program).map((s) => ({ _id: s._id, programName: s.program.programName, startTime: s.startTime, endTime: s.endTime, start: atTime(s.scheduleDate, s.startTime), capacity: s.program.capacity, enrolled: enrolled[String(s.program._id)] || 0, state: sessionState(s) })),
    clients: members.length,
    activeClients: members.filter((m) => m.lastVisitAt && new Date(m.lastVisitAt) >= cut).length,
    programs: full.map((p) => ({ _id: p._id, programName: p.programName, enrolled: enrolled[String(p._id)] || 0, capacity: p.capacity })),
    checkins: seriesByDay(visits, 'timeIn', 30),
    recentClients: members.map((m) => ({ _id: m._id, name: fullName(m), memberCode: m.memberCode, fitnessGoal: m.fitnessGoal, lastVisitAt: m.lastVisitAt, visits30: per[String(m._id)] || 0, active: !!(m.lastVisitAt && new Date(m.lastVisitAt) >= cut) })).sort((a, b) => new Date(b.lastVisitAt || 0) - new Date(a.lastVisitAt || 0)).slice(0, 8),
    availabilityStatus: req.coach.availabilityStatus,
  });
}));

export default r;

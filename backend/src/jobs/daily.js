import cron from 'node-cron';
import { Gym, Member, Product, Attendance, Equipment, Notification } from '../models/index.js';
import { notify, notifyStaff, toMember } from '../utils/notify.js';
import { auditSystem } from '../utils/audit.js';
import { startOfDay, addDays, hhmmToMinutes } from '../utils/dates.js';
import { emitToStaff } from '../utils/socket.js';
import { closeOpenVisitsAtClosing } from '../utils/attendance.js';
import { expireOldBookings } from '../routes/bookings.routes.js';
import { env } from '../config/env.js';

async function recentlySent(type, id, title, days) {
  return Notification.exists({ recipientType: type, recipient: id, title, dateSent: { $gte: addDays(new Date(), -days) } });
}

export async function runDailyJobs({ gymId } = {}) {
  const gyms = await Gym.find(gymId ? { _id: gymId } : { status: 'active' });
  const totals = { renewalReminders: 0, inactivityAlerts: 0, lowStockItems: 0, equipmentDue: 0, autoCheckedOut: 0, expiredBookings: 0 };
  for (const gym of gyms) {
    const s = gym.settings;
    const today = startOfDay();

    const expiring = await Member.find({ gym: gym._id, status: 'active', 'current.endDate': { $gte: today, $lte: addDays(today, s.nearExpiryDays) } });
    for (const m of expiring) {
      if (await recentlySent('Member', m._id, 'Renewal reminder', 3)) continue;
      await notify(toMember(m._id), { gym: gym._id, type: 'Renewal', title: 'Renewal reminder', message: `Your ${m.current.planName} ends on ${new Date(m.current.endDate).toDateString()}. Renew in the app or at the front desk.`, link: '/member/payments', email: true });
      totals.renewalReminders++;
    }

    const cutoff = addDays(today, -s.inactiveDays);
    const inactive = await Member.find({ gym: gym._id, status: 'active', 'current.endDate': { $gte: today }, $or: [{ lastVisitAt: { $lt: cutoff } }, { lastVisitAt: null }] });
    for (const m of inactive) {
      if (await recentlySent('Member', m._id, 'We miss you!', 7)) continue;
      await notify(toMember(m._id), { gym: gym._id, type: 'Inactivity', title: 'We miss you!', message: `It has been over ${s.inactiveDays} days since your last visit. Come back this week!`, link: '/member/programs', email: true });
      totals.inactivityAlerts++;
    }

    const low = await Product.find({ gym: gym._id, status: 'Active', $expr: { $lte: ['$stockQuantity', '$reorderLevel'] } }).select('productName stockQuantity');
    if (low.length) {
      await notifyStaff(gym._id, { type: 'Low Stock', title: 'Low stock summary', message: low.map((p) => `${p.productName} (${p.stockQuantity})`).join(', '), link: '/admin/inventory' });
      totals.lowStockItems += low.length;
    }

    const due = await Equipment.find({ gym: gym._id, nextServiceAt: { $lte: addDays(today, 3) } }).select('equipmentName code');
    if (due.length) {
      await notifyStaff(gym._id, { type: 'Equipment', title: 'Equipment service due', message: due.map((e) => `${e.equipmentName}${e.code ? ` ${e.code}` : ''}`).join(', '), link: '/admin/equipment' });
      totals.equipmentDue += due.length;
    }

    const close = hhmmToMinutes(s.closeTime);
    const stale = await Attendance.find({ gym: gym._id, timeOut: null, timeIn: { $lt: today } });
    for (const a of stale) {
      const day = startOfDay(a.timeIn);
      a.timeOut = new Date(Math.max(a.timeIn.getTime(), day.getTime() + close * 60000));
      a.status = 'Auto Checked Out';
      await a.save();
      totals.autoCheckedOut++;
    }
    if (stale.length) emitToStaff(gym._id, 'attendance:update', {});
    totals.expiredBookings += await expireOldBookings(gym._id);
    await auditSystem(gym._id, 'System', 'Scheduled jobs ran', totals);
  }
  return totals;
}

export async function runClosingCheckout() {
  const gyms = await Gym.find({ status: 'active' }).select('settings.openTime settings.closeTime');
  let total = 0;
  for (const gym of gyms) {
    const open = hhmmToMinutes(gym.settings.openTime);
    const close = hhmmToMinutes(gym.settings.closeTime);
    if (!(close > open)) continue;
    const n = await closeOpenVisitsAtClosing(gym._id, close);
    if (n) await auditSystem(gym._id, 'Attendance', `Auto checked out ${n} at closing time`);
    total += n;
  }
  return total;
}

export function scheduleJobs() {
  cron.schedule('*/10 * * * *', () => runClosingCheckout().catch((e) => console.error('[jobs]', e)), { timezone: process.env.TZ });
  if (!cron.validate(env.dailyJobCron)) {
    console.warn(`Invalid DAILY_JOB_CRON "${env.dailyJobCron}". Scheduled jobs are off.`);
    return;
  }
  cron.schedule(env.dailyJobCron, () => runDailyJobs().catch((e) => console.error('[jobs]', e)), { timezone: process.env.TZ });
}

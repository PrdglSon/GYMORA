import { Attendance, Payment, WalkInGuest, nextCode } from '../models/index.js';
import { canCheckIn } from './membership.js';
import { normalizePhone } from './validators.js';
import { evaluateBadges } from './rules.js';
import { emitToStaff, emitToGym, emitToAccount } from './socket.js';
import { startOfDay } from './dates.js';

export function findOpenVisit(gym, memberId) {
  return Attendance.findOne({ gym, member: memberId, timeOut: null, timeIn: { $gte: startOfDay() } });
}

function broadcast(gym, att, memberId) {
  emitToStaff(gym, 'attendance:update', { id: att._id });
  emitToGym(gym, 'busy:update', {});
  if (memberId) emitToAccount('Member', memberId, 'attendance:self', { id: att._id, out: !!att.timeOut });
}

export const SCAN_COOLDOWN_MIN = 5;

const clock = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

export function scanCard(member) {
  return { name: `${member.firstName} ${member.lastName}`, memberCode: member.memberCode, photoUrl: member.avatarUrl || '', planName: member.current?.planName || '' };
}

export async function toggleMemberVisit({ gym, settings, member, method, recordedBy }) {
  const open = await findOpenVisit(gym, member._id);
  const name = `${member.firstName} ${member.lastName}`;
  if (method === 'QR Kiosk') {
    const gap = SCAN_COOLDOWN_MIN * 60000;
    if (open && Date.now() - open.timeIn.getTime() < gap) {
      return { ok: true, action: 'cooldown', attendance: open, title: `Already checked in, ${member.firstName}`, message: `You checked in at ${clock(open.timeIn)}. Scan again when you leave to check out.` };
    }
    if (!open) {
      const last = await Attendance.findOne({ gym, member: member._id, timeOut: { $gte: new Date(Date.now() - gap) } }).sort({ timeOut: -1 });
      if (last) return { ok: true, action: 'cooldown', attendance: last, title: `Already checked out, ${member.firstName}`, message: `You checked out at ${clock(last.timeOut)}. See you next time!` };
    }
  }
  if (open) {
    open.timeOut = new Date();
    open.status = 'Checked Out';
    await open.save();
    broadcast(gym, open, member._id);
    const mins = Math.round((open.timeOut - open.timeIn) / 60000);
    return { ok: true, action: 'out', attendance: open, title: `Goodbye, ${member.firstName}!`, message: `Tapped out. Session time: ${Math.floor(mins / 60)}h ${mins % 60}m.` };
  }
  const gate = canCheckIn(member, settings);
  if (!gate.ok) {
    return {
      ok: false,
      action: 'denied',
      title: gate.status === 'Pending' ? 'Membership not active yet' : 'Membership expired',
      message: gate.status === 'Pending' ? `${name} has no paid membership yet. Please pay at the front desk.` : `${name}'s membership has ended. Please renew at the front desk.`,
    };
  }
  const now = new Date();
  const att = await Attendance.create({ gym, attendeeType: 'Member', member: member._id, name, date: startOfDay(now), timeIn: now, method, status: 'Checked In', recordedBy });
  member.lastVisitAt = now;
  member.totalVisits = (member.totalVisits || 0) + 1;
  await member.save();
  broadcast(gym, att, member._id);
  evaluateBadges(member).catch((e) => console.error('[badges]', e.message));
  const note = gate.status === 'Grace Period' ? ' Your plan has ended and you are in the grace period. Please renew today.' : gate.status === 'Near Expiry' ? ' Heads up: your plan ends soon.' : '';
  return { ok: true, action: 'in', attendance: att, title: `Welcome, ${member.firstName}!`, message: `Tapped in at ${now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}.${note}` };
}

export async function recordWalkIn({ gym, settings, fullName, phoneNumber, email, method = 'Cash', paid = true, via = 'Front Desk', recordedBy, referenceNumber }) {
  phoneNumber = normalizePhone(phoneNumber);
  let guest = phoneNumber ? await WalkInGuest.findOne({ gym, phoneNumber }) : null;
  if (!guest) guest = await WalkInGuest.create({ gym, fullName, phoneNumber, email });
  guest.visits += 1;
  guest.lastVisitAt = new Date();
  if (fullName) guest.fullName = fullName;
  await guest.save();
  const payment = await Payment.create({
    gym,
    receiptNo: await nextCode(gym, 'receipt'),
    paymentType: 'Walk-in',
    walkInGuest: guest._id,
    payerName: guest.fullName,
    description: 'Walk-in day pass',
    amount: settings.walkInFee,
    paymentMethod: paid ? method : 'Unpaid',
    referenceNumber,
    status: paid ? 'Paid' : 'Unpaid',
    paymentDate: paid ? new Date() : undefined,
    recordedBy,
  });
  const now = new Date();
  const att = await Attendance.create({ gym, attendeeType: 'Walk-in', walkInGuest: guest._id, name: guest.fullName, date: startOfDay(now), timeIn: now, method: via, status: 'Checked In', payment: payment._id, recordedBy });
  broadcast(gym, att);
  return { guest, payment, attendance: att };
}

export async function walkInCheckout(att) {
  att.timeOut = new Date();
  att.status = 'Checked Out';
  await att.save();
  broadcast(att.gym, att, att.member);
  return att;
}

export async function closeOpenVisitsAtClosing(gym, closeMinutes, now = new Date()) {
  const today = startOfDay(now);
  const closeAt = new Date(today.getTime() + closeMinutes * 60000);
  if (now < closeAt) return 0;
  const open = await Attendance.find({ gym, timeOut: null, timeIn: { $gte: today, $lte: closeAt } });
  for (const a of open) {
    a.timeOut = closeAt;
    a.status = 'Auto Checked Out';
    await a.save();
    if (a.member) emitToAccount('Member', a.member, 'attendance:self', { id: a._id, out: true });
  }
  if (open.length) {
    emitToStaff(gym, 'attendance:update', {});
    emitToGym(gym, 'busy:update', {});
  }
  return open.length;
}

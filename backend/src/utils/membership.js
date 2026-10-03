import { Membership, Payment, Member, MembershipPlan, nextCode } from '../models/index.js';
import { addDays, startOfDay, daysBetween, DAY_MS } from './dates.js';
import { ApiError } from './http.js';

export function membershipStatus(endDate, settings = {}) {
  if (!endDate) return 'Pending';
  const left = daysBetween(new Date(), endDate);
  if (left < 0) return -left <= (settings.graceDays ?? 3) ? 'Grace Period' : 'Expired';
  if (left <= (settings.nearExpiryDays ?? 7)) return 'Near Expiry';
  return 'Active';
}

export const daysLeft = (endDate) => (endDate ? daysBetween(new Date(), endDate) : null);

export function canCheckIn(member, settings) {
  const s = membershipStatus(member.current?.endDate, settings);
  return { ok: ['Active', 'Near Expiry', 'Grace Period'].includes(s), status: s };
}

function nextRange(member, plan) {
  const today = startOfDay();
  const currentEnd = member.current?.endDate ? new Date(member.current.endDate) : null;
  const start = currentEnd && currentEnd >= today ? addDays(startOfDay(currentEnd), 1) : today;
  return { startDate: start, endDate: addDays(start, plan.duration - 1) };
}

async function syncCurrent(member, membership) {
  const stillValid = member.current?.endDate && new Date(member.current.endDate) >= startOfDay();
  member.current = {
    membership: membership._id,
    plan: membership.plan,
    planName: membership.planName,
    startDate: stillValid ? member.current.startDate : membership.startDate,
    endDate: membership.endDate,
  };
  await member.save();
}

export async function sellMembership({ gym, member, plan, paid = true, method = 'Cash', referenceNumber, amount, recordedBy, posTransaction, allowDuplicate = false }) {
  if (!allowDuplicate) {
    const recent = await Payment.findOne({ gym, member: member._id, paymentType: 'Membership', status: { $ne: 'Void' }, createdAt: { $gte: startOfDay() } }).sort({ createdAt: -1 });
    if (recent) {
      if (recent.status === 'Unpaid') throw new ApiError(409, `${member.firstName} ${member.lastName} already has an unpaid membership invoice (${recent.receiptNo}). Mark that invoice as paid in Payments & Billing instead.`, { duplicate: true, receiptNo: recent.receiptNo, blocked: true });
      const fresh = Date.now() - recent.createdAt.getTime() < 2 * 60000;
      if (fresh) throw new ApiError(409, `This membership was already recorded a moment ago (${recent.receiptNo}). Refresh the page to see it.`, { duplicate: true, receiptNo: recent.receiptNo, blocked: true });
      throw new ApiError(409, `${member.firstName} ${member.lastName} already has a membership recorded today (${recent.receiptNo}). Record another one only if they are paying for an extra period.`, { duplicate: true, receiptNo: recent.receiptNo });
    }
  }
  const price = amount ?? plan.price;
  const membership = await Membership.create({
    gym,
    member: member._id,
    plan: plan._id,
    planName: plan.planName,
    price,
    status: paid ? 'Active' : 'Pending',
    createdBy: recordedBy,
    ...(paid ? nextRange(member, plan) : {}),
  });
  const payment = await Payment.create({
    gym,
    receiptNo: await nextCode(gym, 'receipt'),
    paymentType: 'Membership',
    membership: membership._id,
    member: member._id,
    posTransaction,
    payerName: `${member.firstName} ${member.lastName}`,
    description: `${plan.planName} membership`,
    amount: price,
    paymentMethod: paid ? method : 'Unpaid',
    referenceNumber,
    status: paid ? 'Paid' : 'Unpaid',
    paymentDate: paid ? new Date() : undefined,
    recordedBy,
  });
  if (paid) await syncCurrent(member, membership);
  return { membership, payment };
}

export async function settlePayment(payment, { method = 'Cash', referenceNumber, recordedBy }) {
  payment.status = 'Paid';
  payment.paymentMethod = method;
  payment.referenceNumber = referenceNumber || payment.referenceNumber;
  payment.paymentDate = new Date();
  payment.recordedBy = recordedBy;
  await payment.save();
  if (payment.paymentType !== 'Membership' || !payment.membership) return payment;
  const membership = await Membership.findById(payment.membership);
  const member = await Member.findById(payment.member);
  const plan = membership ? await MembershipPlan.findById(membership.plan) : null;
  if (membership && member && plan && membership.status === 'Pending') {
    Object.assign(membership, nextRange(member, plan), { status: 'Active' });
    await membership.save();
    await syncCurrent(member, membership);
  }
  return payment;
}

export async function cancelMembership(membershipId) {
  const ms = await Membership.findById(membershipId);
  if (!ms || ms.status === 'Cancelled') return null;
  const wasActive = ms.status === 'Active';
  ms.status = 'Cancelled';
  await ms.save();
  const member = await Member.findById(ms.member);
  if (!member || !wasActive) return member;
  const today = startOfDay();
  const all = await Membership.find({ member: member._id, status: 'Active' }).sort({ startDate: 1, createdAt: 1 });
  const past = all.filter((m) => m.endDate && new Date(m.endDate) < today);
  const ongoing = all.filter((m) => m.endDate && new Date(m.endDate) >= today);
  let prevEnd = past.length ? startOfDay(past[past.length - 1].endDate) : null;
  let chainStart = null;
  for (const m of ongoing) {
    const length = Math.round((startOfDay(m.endDate) - startOfDay(m.startDate)) / DAY_MS) + 1;
    const earliest = prevEnd && addDays(prevEnd, 1) > today ? addDays(prevEnd, 1) : today;
    const start = startOfDay(m.startDate) <= today ? startOfDay(m.startDate) : earliest;
    m.startDate = start;
    m.endDate = addDays(start, length - 1);
    await m.save();
    if (!chainStart) chainStart = start;
    prevEnd = startOfDay(m.endDate);
  }
  const last = ongoing[ongoing.length - 1] || past[past.length - 1];
  member.current = last
    ? { membership: last._id, plan: last.plan, planName: last.planName, startDate: ongoing.length ? chainStart : last.startDate, endDate: last.endDate }
    : undefined;
  await member.save();
  return member;
}

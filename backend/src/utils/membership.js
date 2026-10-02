import { Membership, Payment, Member, MembershipPlan, nextCode } from '../models/index.js';
import { addDays, startOfDay, daysBetween } from './dates.js';

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

export async function sellMembership({ gym, member, plan, paid = true, method = 'Cash', referenceNumber, amount, recordedBy, posTransaction }) {
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

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Gym, Member, MembershipPlan, Payment } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, notFound } from '../utils/http.js';
import { sellMembership, settlePayment } from '../utils/membership.js';
import { notify, notifyStaff, toMember } from '../utils/notify.js';
import { createCheckout, getCheckout, paidPayment, METHOD_LABELS, MIN_AMOUNT } from '../utils/paymongo.js';
import { open } from '../utils/secretBox.js';
import { emitToStaff } from '../utils/socket.js';
import { auditSystem } from '../utils/audit.js';
import { env } from '../config/env.js';
import { fullName } from '../utils/format.js';

const r = Router();

async function gymWithKey(gymId) {
  const gym = await Gym.findById(gymId).select('+paymongo.secretKeyEnc');
  const secretKey = open(gym?.paymongo?.secretKeyEnc);
  if (!gym?.paymongo?.enabled || !secretKey) throw new ApiError(400, 'Online payment is not available at this gym yet. Please pay at the front desk.');
  return { gym, secretKey };
}

export async function confirmOnlinePayment(payment, { gym, secretKey }) {
  if (payment.status === 'Paid') return 'Paid';
  if (payment.status !== 'Unpaid' || !payment.online?.checkoutId) return payment.status;
  const session = await getCheckout(secretKey, payment.online.checkoutId);
  const paid = paidPayment(session);
  if (!paid) return 'Pending';
  payment.online.channel = paid.channel;
  payment.online.providerPaymentId = paid.id;
  payment.online.paidAt = new Date();
  await settlePayment(payment, { method: 'Online', referenceNumber: paid.id });
  const label = METHOD_LABELS[paid.channel] || 'online payment';
  if (payment.member) await notify(toMember(payment.member), { gym: gym._id, type: 'Payment', title: 'Payment received', message: `We received ₱${payment.amount} via ${label} for ${payment.description} (${payment.receiptNo}).`, link: '/member/payments', email: true });
  await notifyStaff(gym._id, { type: 'Payment', title: 'Online payment received', message: `${payment.payerName}: ₱${payment.amount} via ${label} (${payment.receiptNo})`, link: '/admin/billing' });
  auditSystem(gym._id, 'Payment and Billing', `Online payment confirmed for ${payment.receiptNo} via ${label}`);
  emitToStaff(gym._id, 'payment:update', { id: payment._id });
  return 'Paid';
}

r.post('/webhook/:gymId', rateLimit({ windowMs: 60 * 1000, max: 60 }), ah(async (req, res) => {
  const id = req.body?.data?.attributes?.data?.attributes?.metadata?.paymentId;
  if (id && /^[a-f0-9]{24}$/.test(String(id)) && /^[a-f0-9]{24}$/.test(req.params.gymId)) {
    const payment = await Payment.findOne({ _id: id, gym: req.params.gymId });
    if (payment) {
      try {
        await confirmOnlinePayment(payment, await gymWithKey(req.params.gymId));
      } catch (err) {
        console.error('[paymongo]', err.message);
      }
    }
  }
  res.json({ received: true });
}));

r.use(protect);

r.post('/checkout', allow('member'), ah(async (req, res) => {
  const ctx = await gymWithKey(req.gymId);
  const member = req.member;
  let payment;
  if (req.body.paymentId) {
    payment = await Payment.findOne({ _id: req.body.paymentId, gym: req.gymId, member: member._id });
    if (!payment) throw notFound('Invoice');
    if (payment.status !== 'Unpaid') throw new ApiError(400, 'This invoice is already settled.');
  } else {
    const plan = await MembershipPlan.findOne({ _id: req.body.planId, gym: req.gymId, status: 'Active' });
    if (!plan) throw new ApiError(400, 'Choose a valid plan.');
    if (plan.isStudentPlan && member.student?.status !== 'verified') throw new ApiError(400, 'Verify your school ID first to use the student plan.');
    const existing = await Payment.findOne({ gym: req.gymId, member: member._id, paymentType: 'Membership', status: 'Unpaid' });
    if (existing) throw new ApiError(409, `You already have an unpaid invoice (${existing.receiptNo}). Pay that one first.`);
    ({ payment } = await sellMembership({ gym: req.gymId, member, plan, paid: false, allowDuplicate: true }));
  }
  if (payment.amount < MIN_AMOUNT) throw new ApiError(400, `Online payment needs at least ₱${MIN_AMOUNT}. Please pay at the front desk.`);
  if (payment.online?.checkoutId) {
    const status = await confirmOnlinePayment(payment, ctx).catch(() => 'Pending');
    if (status === 'Paid') return res.json({ paid: true, paymentId: payment._id });
  }
  const site = env.siteUrl(req);
  const session = await createCheckout(ctx.secretKey, {
    amount: payment.amount,
    name: payment.description,
    description: `${ctx.gym.name} · ${payment.receiptNo}`,
    reference: payment.receiptNo,
    successUrl: `${site}/member/payments?online=${payment._id}`,
    cancelUrl: `${site}/member/payments?cancelled=${payment._id}`,
    methods: ctx.gym.paymongo.methods?.length ? ctx.gym.paymongo.methods : ['card', 'gcash', 'paymaya'],
    billing: { name: fullName(member), email: member.email, phone: member.phoneNumber || undefined },
    metadata: { paymentId: String(payment._id), gymId: String(req.gymId), receiptNo: payment.receiptNo },
  });
  payment.online = { provider: 'PayMongo', checkoutId: session.id, checkoutUrl: session.attributes?.checkout_url, startedAt: new Date() };
  await payment.save();
  res.json({ checkoutUrl: session.attributes?.checkout_url, paymentId: payment._id });
}));

r.post('/:paymentId/verify', allow('member', ...STAFF), ah(async (req, res) => {
  const filter = { _id: req.params.paymentId, gym: req.gymId };
  if (req.role === 'member') filter.member = req.account._id;
  const payment = await Payment.findOne(filter);
  if (!payment) throw notFound('Payment');
  if (payment.status === 'Paid') return res.json({ status: 'Paid', receiptNo: payment.receiptNo });
  if (!payment.online?.checkoutId) return res.json({ status: payment.status });
  const status = await confirmOnlinePayment(payment, await gymWithKey(req.gymId));
  res.json({ status, receiptNo: payment.receiptNo });
}));

export async function reconcileOnlinePayments() {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pending = await Payment.find({ status: 'Unpaid', 'online.checkoutId': { $exists: true }, 'online.startedAt': { $gte: since } });
  const keys = {};
  let confirmed = 0;
  for (const p of pending) {
    const g = String(p.gym);
    if (keys[g] === undefined) keys[g] = await gymWithKey(p.gym).catch(() => null);
    if (!keys[g]) continue;
    if ((await confirmOnlinePayment(p, keys[g]).catch(() => 'Pending')) === 'Paid') confirmed++;
  }
  return confirmed;
}

export default r;

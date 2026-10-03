import { Router } from 'express';
import { Product, Inventory, PosTransaction, PosItem, Payment, Member, MembershipPlan, nextCode } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick, notFound, escapeRegex, paging } from '../utils/http.js';
import { sellMembership } from '../utils/membership.js';
import { notify, notifyStaff, toMember } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { emitToStaff } from '../utils/socket.js';
import { upload, saveFile } from '../utils/upload.js';
import { startOfDay, addDays } from '../utils/dates.js';

const r = Router();
r.use(protect, allow(...STAFF));
const FIELDS = ['productName', 'brand', 'category', 'price', 'cost', 'reorderLevel', 'status'];
const round2 = (n) => Math.round(n * 100) / 100;

async function moveStock(product, quantity, status, { by, note, posTransaction } = {}) {
  product.stockQuantity += quantity;
  await product.save();
  await Inventory.create({ gym: product.gym, product: product._id, quantity, status, stockAfter: product.stockQuantity, note, posTransaction, updatedBy: by });
  if (quantity < 0 && product.stockQuantity <= product.reorderLevel) await notifyStaff(product.gym, { type: 'Inventory', title: product.stockQuantity <= 0 ? 'Out of stock' : 'Low stock', message: `${product.productName}: ${product.stockQuantity} left`, link: '/admin/inventory' });
  emitToStaff(product.gym, 'inventory:update', { id: product._id, stockQuantity: product.stockQuantity });
}

r.get('/products', ah(async (req, res) => {
  const filter = { gym: req.gymId };
  if (req.query.status !== 'all') filter.status = 'Active';
  if (req.query.category) filter.category = req.query.category;
  if (req.query.stock === 'low') filter.$expr = { $and: [{ $lte: ['$stockQuantity', '$reorderLevel'] }, { $gt: ['$stockQuantity', 0] }] };
  if (req.query.stock === 'out') filter.stockQuantity = { $lte: 0 };
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ productName: rx }, { brand: rx }, { sku: rx }];
  }
  res.json(await Product.find(filter).sort({ category: 1, productName: 1 }));
}));

r.post('/products', upload.single('image'), ah(async (req, res) => {
  requireFields(req.body, ['productName', 'category', 'price']);
  const p = await Product.create({ gym: req.gymId, sku: req.body.sku || (await nextCode(req.gymId, 'sku')), ...pick(req.body, FIELDS), stockQuantity: 0, imageUrl: req.file ? await saveFile(req.file, 'products') : undefined });
  const initial = Number(req.body.stockQuantity) || 0;
  if (initial > 0) await moveStock(p, initial, 'Initial', { by: req.account._id });
  audit(req, 'Inventory Management', `Added product ${p.productName}`);
  res.status(201).json(p);
}));

r.patch('/products/:id', allow('admin'), upload.single('image'), ah(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Product');
  Object.assign(p, pick(req.body, FIELDS));
  if (req.file) p.imageUrl = await saveFile(req.file, 'products');
  await p.save();
  audit(req, 'Inventory Management', `Edited product ${p.productName}`);
  res.json(p);
}));

r.post('/products/:id/restock', ah(async (req, res) => {
  const qty = Number(req.body.quantity);
  if (!(qty > 0)) throw new ApiError(400, 'Enter a quantity above 0.');
  const p = await Product.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Product');
  await moveStock(p, qty, 'Restock', { by: req.account._id, note: req.body.note });
  audit(req, 'Inventory Management', `Restocked ${p.productName} +${qty}${req.body.note ? ` (${req.body.note})` : ''}`);
  res.json(p);
}));

r.post('/products/:id/adjust', allow('admin'), ah(async (req, res) => {
  const change = Number(req.body.quantity);
  if (!change) throw new ApiError(400, 'Enter a non-zero change.');
  requireFields(req.body, ['note']);
  const p = await Product.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Product');
  if (p.stockQuantity + change < 0) throw new ApiError(400, 'Stock cannot go below zero.');
  await moveStock(p, change, 'Adjustment', { by: req.account._id, note: req.body.note });
  audit(req, 'Inventory Management', `Adjusted ${p.productName} ${change > 0 ? '+' : ''}${change}: ${req.body.note}`);
  res.json(p);
}));

r.get('/products/:id/inventory', ah(async (req, res) => {
  res.json(await Inventory.find({ product: req.params.id, gym: req.gymId }).sort({ lastUpdated: -1 }).limit(100).populate('updatedBy', 'firstName lastName').lean());
}));

r.post('/transactions', ah(async (req, res) => {
  const { items = [], paymentMethod = 'Cash' } = req.body;
  if (!items.length) throw new ApiError(400, 'The cart is empty.');
  if (!['Cash', 'GCash', 'Card', 'Other'].includes(paymentMethod)) throw new ApiError(400, 'Choose a payment method.');
  const settings = req.gym.settings;
  const member = req.body.memberId ? await Member.findOne({ _id: req.body.memberId, gym: req.gymId }) : null;
  const discountRate = Math.min(Math.max(Number(req.body.discountRate) || 0, 0), 0.5);
  const lines = [];
  for (const it of items) {
    const qty = Math.max(parseInt(it.quantity, 10) || 1, 1);
    if (it.itemType === 'Product') {
      const p = await Product.findOne({ _id: it.productId, gym: req.gymId, status: 'Active' });
      if (!p) throw new ApiError(400, 'A product in the cart no longer exists.');
      if (p.stockQuantity < qty) throw new ApiError(409, `Only ${p.stockQuantity} ${p.productName} left in stock.`);
      lines.push({ itemType: 'Product', product: p._id, itemName: p.productName, price: p.price, quantity: qty, doc: p });
    } else if (it.itemType === 'Walk-in Pass') {
      lines.push({ itemType: 'Walk-in Pass', itemName: 'Walk-in day pass', price: settings.walkInFee, quantity: qty });
    } else if (it.itemType === 'Membership') {
      if (!member) throw new ApiError(400, 'Choose the member before selling a membership.');
      const plan = await MembershipPlan.findOne({ _id: it.planId, gym: req.gymId, status: 'Active' });
      if (!plan) throw new ApiError(400, 'Unknown plan.');
      if (plan.isStudentPlan && member.student?.status !== 'verified') throw new ApiError(400, 'The student plan needs a verified school ID.');
      lines.push({ itemType: 'Membership', plan: plan._id, itemName: `${plan.planName} membership`, price: plan.price, quantity: 1, doc: plan });
    } else throw new ApiError(400, 'Unknown item type.');
  }
  if (lines.filter((l) => l.itemType === 'Membership').length > 1) throw new ApiError(400, 'Sell one membership per transaction.');
  const subtotal = round2(lines.reduce((a, l) => a + l.price * l.quantity, 0));
  const discount = round2(subtotal * discountRate);
  const totalAmount = round2(subtotal - discount);
  const ratio = subtotal ? totalAmount / subtotal : 1;
  const productAmount = round2(lines.filter((l) => l.itemType === 'Product').reduce((a, l) => a + l.price * l.quantity, 0) * ratio);
  const tendered = paymentMethod === 'Cash' ? Number(req.body.amountTendered) : totalAmount;
  if (paymentMethod === 'Cash' && !(tendered >= totalAmount)) throw new ApiError(400, 'Amount tendered is less than the total.');
  const tx = await PosTransaction.create({
    gym: req.gymId, transactionNo: await nextCode(req.gymId, 'pos'), member: member?._id, customerName: member ? `${member.firstName} ${member.lastName}` : req.body.customerName || 'Walk-in',
    subtotal, discountRate, discountLabel: req.body.discountLabel, discount, totalAmount, productAmount, paymentMethod, referenceNumber: req.body.referenceNumber, amountTendered: tendered, change: round2(tendered - totalAmount), cashier: req.account._id,
  });
  await PosItem.insertMany(lines.map(({ doc, ...l }) => ({ gym: req.gymId, transaction: tx._id, ...l })));
  for (const l of lines.filter((x) => x.itemType === 'Product')) await moveStock(l.doc, -l.quantity, 'Sale', { by: req.account._id, posTransaction: tx._id });
  for (const l of lines.filter((x) => x.itemType === 'Walk-in Pass')) {
    await Payment.create({ gym: req.gymId, receiptNo: await nextCode(req.gymId, 'receipt'), paymentType: 'Walk-in', posTransaction: tx._id, payerName: tx.customerName, description: `Walk-in day pass ×${l.quantity} (${tx.transactionNo})`, amount: round2(l.price * l.quantity * ratio), paymentMethod, referenceNumber: req.body.referenceNumber, status: 'Paid', paymentDate: new Date(), recordedBy: req.account._id });
  }
  const ms = lines.find((l) => l.itemType === 'Membership');
  if (ms) {
    await sellMembership({ gym: req.gymId, member, plan: ms.doc, paid: true, method: paymentMethod, referenceNumber: req.body.referenceNumber, amount: round2(ms.price * ratio), recordedBy: req.account._id, posTransaction: tx._id, allowDuplicate: true });
    await notify(toMember(member), { gym: req.gymId, type: 'Membership', title: 'Membership renewed', message: `${ms.doc.planName} active until ${new Date(member.current.endDate).toDateString()}.`, link: '/member/payments', email: true });
  }
  audit(req, 'Point of Sale', `Transaction ${tx.transactionNo}: ₱${totalAmount} (${paymentMethod})`);
  emitToStaff(req.gymId, 'payments:update', {});
  res.status(201).json({ ...tx.toObject(), items: lines.map(({ doc, ...l }) => l) });
}));

r.get('/transactions', ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 50);
  const filter = { gym: req.gymId, transactionDate: { $gte: addDays(startOfDay(), -(Number(req.query.days) || 30) + 1) } };
  const [items, total] = await Promise.all([PosTransaction.find(filter).sort({ transactionDate: -1 }).skip(skip).limit(limit).populate('cashier', 'firstName lastName').lean(), PosTransaction.countDocuments(filter)]);
  const lines = await PosItem.find({ transaction: { $in: items.map((t) => t._id) } }).lean();
  res.json({ items: items.map((t) => ({ ...t, items: lines.filter((l) => String(l.transaction) === String(t._id)) })), total });
}));

r.post('/transactions/:id/void', allow('admin'), ah(async (req, res) => {
  const tx = await PosTransaction.findOne({ _id: req.params.id, gym: req.gymId });
  if (!tx) throw notFound('Transaction');
  if (tx.status === 'Void') throw new ApiError(409, 'Already void.');
  const lines = await PosItem.find({ transaction: tx._id });
  if (lines.some((l) => l.itemType === 'Membership')) throw new ApiError(400, 'Transactions with a membership cannot be voided here. Adjust the membership from the member record.');
  for (const l of lines.filter((x) => x.itemType === 'Product')) {
    const p = await Product.findById(l.product);
    if (p) await moveStock(p, l.quantity, 'Void', { by: req.account._id, posTransaction: tx._id, note: 'Transaction voided' });
  }
  await Payment.updateMany({ posTransaction: tx._id }, { status: 'Void' });
  tx.status = 'Void';
  await tx.save();
  audit(req, 'Point of Sale', `Voided ${tx.transactionNo}${req.body.reason ? `: ${req.body.reason}` : ''}`);
  res.json(tx);
}));

export default r;

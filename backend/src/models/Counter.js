import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
schema.index({ gym: 1, key: 1 }, { unique: true });

const Counter = mongoose.model('Counter', schema);

const FORMATS = {
  member: (n) => `M-${String(n).padStart(4, '0')}`,
  receipt: (n) => `OR-${String(n).padStart(6, '0')}`,
  pos: (n) => `POS-${String(n).padStart(6, '0')}`,
  incident: (n) => `IR-${String(n).padStart(4, '0')}`,
  inquiry: (n) => `INQ-${String(n).padStart(4, '0')}`,
  sku: (n) => `SKU-${String(n).padStart(4, '0')}`,
  booking: (n) => `BK-${String(n).padStart(5, '0')}`,
};

export async function nextCode(gym, key) {
  const c = await Counter.findOneAndUpdate({ gym, key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return FORMATS[key] ? FORMATS[key](c.seq) : String(c.seq);
}

export default Counter;

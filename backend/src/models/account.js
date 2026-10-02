import bcrypt from 'bcryptjs';

export const accountFields = {
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phoneNumber: String,
  avatarUrl: String,
  lastLoginAt: Date,
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
};

export function applyAccount(schema) {
  schema.virtual('fullName').get(function fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  });
  schema.pre('save', async function hash(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
  });
  schema.methods.checkPassword = function checkPassword(plain) {
    return bcrypt.compare(plain, this.password);
  };
  schema.set('toJSON', { virtuals: true, transform: (doc, ret) => { delete ret.password; delete ret.resetTokenHash; delete ret.resetTokenExpires; return ret; } });
  schema.set('toObject', { virtuals: true });
}

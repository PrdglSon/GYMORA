export const PHONE_MESSAGE = 'Phone number must be 11 digits and start with 09 (example: 09171234567).';

export function normalizePhone(value) {
  if (value === undefined || value === null) return value;
  let digits = String(value).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  return digits || undefined;
}

export const isPhPhone = (value) => /^09\d{9}$/.test(String(value || ''));

export const isPersonName = (value) => /^\p{L}[\p{L}\p{M}\s.'-]*$/u.test(String(value || '').trim());

const LABELS = { firstName: 'First name', lastName: 'Last name', fullName: 'Name', payerName: 'Payer name', customerName: 'Customer name' };

export function applyContactRules(schema, { phones = [], names = [] } = {}) {
  for (const p of phones) schema.path(p).set(normalizePhone);
  schema.pre('validate', function validateContact(next) {
    for (const p of phones) {
      const v = this.get(p);
      if (v && (this.isNew || this.isModified(p)) && !isPhPhone(v)) this.invalidate(p, PHONE_MESSAGE);
    }
    for (const p of names) {
      const v = this.get(p);
      if (v && (this.isNew || this.isModified(p)) && !isPersonName(v)) this.invalidate(p, `${LABELS[p] || 'Name'} can only contain letters.`);
    }
    next();
  });
}

import { TextField } from '@mui/material';

export const cleanPhone = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 11);
export const cleanName = (v) => String(v ?? '').replace(/[^\p{L}\p{M}\s.'-]/gu, '').replace(/^\s+/, '');
export const isPhPhone = (v) => /^09\d{9}$/.test(String(v || ''));

function phoneHint(v) {
  const d = String(v || '');
  if (!d) return '';
  if (!d.startsWith('0') || (d.length > 1 && !d.startsWith('09'))) return 'Must start with 09';
  if (d.length < 11) return `${d.length}/11 digits`;
  return '';
}

export function PhoneField({ value, onChange, helperText, inputProps, ...rest }) {
  const hint = phoneHint(value);
  return (
    <TextField
      {...rest}
      value={value ?? ''}
      onChange={(e) => onChange?.({ ...e, target: { ...e.target, value: cleanPhone(e.target.value) } })}
      placeholder={rest.placeholder || '09XXXXXXXXX'}
      error={!!hint && String(value || '').length >= 2 && !String(value).startsWith('09')}
      helperText={hint || helperText}
      inputProps={{ ...inputProps, inputMode: 'numeric', maxLength: 11, pattern: '09[0-9]{9}', title: '11-digit mobile number starting with 09, like 09171234567' }}
    />
  );
}

export function NameField({ value, onChange, inputProps, ...rest }) {
  return (
    <TextField
      {...rest}
      value={value ?? ''}
      onChange={(e) => onChange?.({ ...e, target: { ...e.target, value: cleanName(e.target.value) } })}
      inputProps={{ ...inputProps, pattern: "[\\p{L}\\p{M}][\\p{L}\\p{M}\\s.'\\-]*", title: 'Letters only (spaces, periods, hyphens and apostrophes are allowed)' }}
    />
  );
}

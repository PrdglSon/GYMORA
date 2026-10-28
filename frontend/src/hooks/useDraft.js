import { useCallback, useEffect, useRef, useState } from 'react';

const read = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function useDraft(key, initial, { exclude = ['password', 'confirmPassword'] } = {}) {
  const first = useRef(initial);
  const [value, setValue] = useState(() => {
    const saved = read(key);
    return saved ? { ...initial, ...saved } : initial;
  });
  useEffect(() => {
    try {
      const copy = { ...value };
      exclude.forEach((k) => delete copy[k]);
      sessionStorage.setItem(key, JSON.stringify(copy));
    } catch {
      return undefined;
    }
    return undefined;
  }, [key, value]);
  const clear = useCallback((next) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      return setValue(next || first.current);
    }
    return setValue(next || first.current);
  }, [key]);
  return [value, setValue, clear];
}

export const keepOpenOnTapOutside = (close) => (event, reason) => {
  if (reason === 'backdropClick') return;
  close(event, reason);
};

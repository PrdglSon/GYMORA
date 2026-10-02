import { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const toast = useCallback((message, severity = 'success') => setT({ message, severity, key: Date.now() }), []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Snackbar key={t?.key} open={!!t} autoHideDuration={4000} onClose={() => setT(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {t ? (
          <Alert onClose={() => setT(null)} severity={t.severity} variant="filled" sx={{ fontWeight: 600, color: '#fff' }}>
            {t.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken, setPortal } from '../api';

const AuthContext = createContext(null);
const EMPTY = { accountType: null, role: null, account: null, gym: null };

export const PORTALS = {
  admin: { role: 'admin', label: 'Administrator', home: '/admin' },
  staff: { role: 'receptionist', label: 'Staff', home: '/staff' },
  coach: { role: 'coach', label: 'Coach', home: '/coach' },
  member: { role: 'member', label: 'Member', home: '/member' },
  platform: { role: 'platform', label: 'Platform Admin', home: '/platform' },
};

export const homeFor = (role) => ({ platform: '/platform', admin: '/admin', receptionist: '/staff', coach: '/coach', member: '/member' })[role] || '/';
export const portalOf = (role) => ({ platform: 'platform', admin: 'admin', receptionist: 'staff', coach: 'coach', member: 'member' })[role] || '';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setSession(EMPTY);
      setReady(true);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setSession(data);
    } catch {
      setToken(null);
      setSession(EMPTY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const acceptSession = useCallback((data) => {
    setToken(data.token);
    setPortal(portalOf(data.role));
    setSession({ accountType: data.accountType, role: data.role, account: data.account, gym: data.gym });
  }, []);

  const login = useCallback(async (portal, email, password, gymSlug) => {
    const { data } = await api.post('/auth/login', { portal, email, password, gymSlug });
    acceptSession(data);
    return data;
  }, [acceptSession]);

  const logout = useCallback(() => {
    setToken(null);
    setSession(EMPTY);
  }, []);

  const value = useMemo(() => ({ ...session, user: session.account, ready, login, logout, refresh, acceptSession, setSession }), [session, ready, login, logout, refresh, acceptSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

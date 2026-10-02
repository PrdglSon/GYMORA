import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'gymora_token';
const PORTAL_KEY = 'gymora_portal';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
export const getPortal = () => localStorage.getItem(PORTAL_KEY) || '';
export const setPortal = (p) => (p ? localStorage.setItem(PORTAL_KEY, p) : localStorage.removeItem(PORTAL_KEY));

const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && getToken()) {
      setToken(null);
      const portal = getPortal();
      const target = portal ? `/${portal}/login?expired=1` : '/login?expired=1';
      if (!window.location.pathname.endsWith('/login')) window.location.href = target;
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.';
export const fileUrl = (u) => (!u ? '' : u.startsWith('http') ? u : `${API_URL}${u}`);

export default api;

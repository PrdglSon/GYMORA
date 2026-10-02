import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, getToken } from '../api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { account } = useAuth();
  const [socket, setSocket] = useState(null);
  const id = account?._id;

  useEffect(() => {
    if (!id) return undefined;
    const s = io(API_URL, { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocketEvent(event, handler) {
  const socket = useContext(SocketContext);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (payload) => ref.current(payload);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}

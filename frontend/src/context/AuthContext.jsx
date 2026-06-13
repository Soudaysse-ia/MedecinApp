import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ctx, setCtx] = useState({ doctorId: null, patientId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/auth/me')
      .then((data) => { setUser(data.user); setCtx({ doctorId: data.doctorId, patientId: data.patientId }); })
      .catch(() => { setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    const me = await api.get('/auth/me');
    setUser(me.user);
    setCtx({ doctorId: me.doctorId, patientId: me.patientId });
    return me.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    setCtx({ doctorId: null, patientId: null });
  }

  return (
    <AuthContext.Provider value={{ user, ...ctx, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

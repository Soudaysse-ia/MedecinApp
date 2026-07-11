import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ctx, setCtx] = useState({ doctorId: null, patientId: null });
  const [abonnement, setAbonnement] = useState(null);
  const [loading, setLoading] = useState(true);

  function applyMe(me) {
    setUser(me.user);
    setCtx({ doctorId: me.doctorId, patientId: me.patientId });
    setAbonnement(me.abonnement || null);
  }

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/auth/me')
      .then(applyMe)
      .catch(() => { setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    const me = await api.get('/auth/me');
    applyMe(me);
    return me.user;
  }

  // Re-verifie l'abonnement (utilise apres un paiement pour faire disparaitre le rappel)
  async function refreshAbonnement() {
    try { const me = await api.get('/auth/me'); setAbonnement(me.abonnement || null); } catch {}
  }

  function logout() {
    setToken(null);
    setUser(null);
    setCtx({ doctorId: null, patientId: null });
    setAbonnement(null);
  }

  return (
    <AuthContext.Provider value={{ user, ...ctx, abonnement, loading, login, logout, refreshAbonnement }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

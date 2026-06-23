import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { setAccessToken, onUnauthorized } from '../api/authToken';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    authApi.fetchMe()
      .then((u) => { if (active) { setUser(u); setStatus('authenticated'); } })
      .catch(() => { if (active) { setUser(null); setStatus('anonymous'); } });
    const off = onUnauthorized(() => { setUser(null); setStatus('anonymous'); });
    return () => { active = false; off(); };
  }, []);

  const login = useCallback(async (creds) => {
    const { user: u, accessToken } = await authApi.login(creds);
    setAccessToken(accessToken);
    setUser(u); setStatus('authenticated');
    return u;
  }, []);

  const register = useCallback(async (body) => {
    const { user: u, accessToken } = await authApi.register(body);
    setAccessToken(accessToken);
    setUser(u); setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally {
      setAccessToken(null); setUser(null); setStatus('anonymous');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, getMe, setToken, removeToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Vérifie token au démarrage
  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        if (t) {
          const me = await getMe();
          setUser(me);
        }
      } catch {
        await removeToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email, password) {
    const data = await apiLogin(email, password);
    await setToken(data.access_token);
    const me = await getMe();
    setUser(me);
  }

  async function signInWithToken(token) {
    await setToken(token);
    const me = await getMe();
    setUser(me);
  }

  async function signOut() {
    await removeToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

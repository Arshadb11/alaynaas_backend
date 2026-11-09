import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken, clearAccessToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount (page refresh/tab reopen)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        // No valid refresh token — user needs to log in
        clearAccessToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout even if API fails
    }
    clearAccessToken();
    setUser(null);
  }, []);

  const logoutOthers = useCallback(async () => {
    const { data } = await api.post('/auth/logout-all');
    return data;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data);
    } catch {
      // Ignore
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    logoutAll: logoutOthers,
    logoutOthers,
    refreshUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;

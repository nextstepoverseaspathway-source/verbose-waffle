/**
 * Authentication state. Persists the JWT, exposes login/register/logout,
 * and restores the session on load via /auth/me.
 */
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, setToken } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  loginWithGoogle: (email: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  token: string;
  user: User;
}

/** Registration now requires email verification, so no token is returned. */
export interface RegisterResult {
  requiresVerification?: boolean;
  emailSent?: boolean;
  message?: string;
  user?: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore an existing session, if any.
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = (res: AuthResponse) => {
    setToken(res.token);
    setUser(res.user);
  };

  const login = async (email: string, password: string) => {
    handleAuth(await api.post<AuthResponse>('/auth/login', { email, password }, false));
  };

  const register = async (name: string, email: string, password: string) => {
    // Registration does not sign the user in — they must verify their email.
    return api.post<RegisterResult>('/auth/register', { name, email, password }, false);
  };

  const loginWithGoogle = async (email: string, name: string) => {
    handleAuth(await api.post<AuthResponse>('/auth/google', { email, name }, false));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    const r = await api.get<{ user: User }>('/auth/me');
    setUser(r.user);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, refresh, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

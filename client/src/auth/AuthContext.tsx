import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ApiError,
  loginRequest,
  logoutRequest,
  registerRequest,
  restoreSessionRequest,
  type AuthUser,
  type WorkerProfileInput
} from '../api/http';

const storedUserKey = 'claimproof.currentUser';

interface RegisterInput {
  email: string;
  password: string;
  profile?: WorkerProfileInput;
}

interface AuthContextValue {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const rememberUser = useCallback((user: AuthUser | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem(storedUserKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(storedUserKey);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const restoredUser = await restoreSessionRequest();
        const cachedUser = readStoredUser();
        if (!active) return;
        rememberUser(withDisplayCache(restoredUser, cachedUser));
      } catch (error) {
        if (!active) return;
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error(error);
        }
        rememberUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [rememberUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await loginRequest(email, password);
      rememberUser(user);
    },
    [rememberUser]
  );

  const register = useCallback(
    async ({ email, password, profile }: RegisterInput) => {
      if (!profile) {
        throw new Error('Full name and mobile number are required');
      }
      await registerRequest(email, password, profile.fullName, profile.phone);
      rememberUser(null);
    },
    [rememberUser]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      rememberUser(null);
    }
  }, [rememberUser]);

  const value = useMemo(
    () => ({
      currentUser,
      loading,
      login,
      register,
      logout
    }),
    [currentUser, loading, login, logout, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(storedUserKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.id || !parsed.role) return null;
    return {
      id: parsed.id,
      email: parsed.email ?? null,
      role: parsed.role
    };
  } catch {
    return null;
  }
}

function withDisplayCache(verifiedUser: AuthUser, cachedUser: AuthUser | null): AuthUser {
  if (!cachedUser || cachedUser.id !== verifiedUser.id) {
    return verifiedUser;
  }

  return {
    ...verifiedUser,
    email: cachedUser.email ?? verifiedUser.email
  };
}

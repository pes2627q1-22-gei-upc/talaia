import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { authRepository, type AuthUser } from './authRepository';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  signingOut: boolean;
  error: 'restore' | 'logout' | null;
  restore: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const cache = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<AuthState['error']>(null);
  const currentUser = useRef<AuthUser | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);
  const logoutPending = useRef(false);

  const accept = useCallback(
    (next: AuthUser | null) => {
      if (currentUser.current?.id !== next?.id) cache.clear();
      currentUser.current = next;
      setUser(next);
    },
    [cache],
  );

  const invalidate = useCallback(() => ++revision.current, []);

  const load = useCallback(() => {
    const version = ++revision.current;
    return authRepository.getUser().then(
      (next) => {
        if (!mounted.current || revision.current !== version) return;
        accept(next);
        setLoading(false);
      },
      () => {
        if (!mounted.current || revision.current !== version) return;
        setError('restore');
        setLoading(false);
      },
    );
  }, [accept]);

  const restore = useCallback(async () => {
    setLoading(true);
    setError(null);
    await load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = authRepository.subscribe((next) => {
      if (!mounted.current) return;
      revision.current++;
      accept(next);
      setLoading(false);
      setError(null);
    });
    const stopRefresh = authRepository.startAutoRefresh();
    void load();
    return () => {
      mounted.current = false;
      invalidate();
      unsubscribe();
      stopRefresh();
    };
  }, [accept, load, invalidate]);

  const signOut = useCallback(async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setSigningOut(true);
    setError(null);
    // Un getSession anterior no pot restaurar l'usuari després del logout.
    const version = ++revision.current;
    try {
      await authRepository.signOut();
      if (mounted.current && revision.current === version) accept(null);
    } catch {
      if (mounted.current && revision.current === version) setError('logout');
    } finally {
      logoutPending.current = false;
      if (mounted.current) {
        setSigningOut(false);
        setLoading(false);
      }
    }
  }, [accept]);

  return (
    <AuthContext.Provider value={{ user, loading, signingOut, error, restore, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthState() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuthViewModel requires AuthProvider');
  return state;
}

import { authRepository } from './authRepository';
import { useAuthState } from './AuthProvider';

export type SessionGate = 'restoring' | 'signedIn' | 'signedOut';

/**
 * Si es pot entrar a l'app. Sense Supabase configurat (proves locals, CI) la porta és oberta, com
 * abans de TG-249.
 */
export function useSessionGate(): SessionGate {
  const { user, loading } = useAuthState();
  if (!authRepository.isConfigured()) return 'signedIn';
  if (loading) return 'restoring';
  return user ? 'signedIn' : 'signedOut';
}

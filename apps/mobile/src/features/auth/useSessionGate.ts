import { authRepository } from './authRepository';
import { useAuthState } from './AuthProvider';

export type SessionGate = 'restoring' | 'restoreFailed' | 'signedIn' | 'signedOut';

/**
 * Si es pot entrar a l'app. Si no s'ha pogut recuperar la sessió (sense cobertura i amb el token
 * caducat), no és que no n'hi hagi: es pot tornar a provar i, quan torna la xarxa, el SDK la renova
 * sol. Sense Supabase configurat (proves locals, CI) la porta és oberta, com abans de TG-249.
 */
export function useSessionGate(): SessionGate {
  const { user, loading, error } = useAuthState();
  if (!authRepository.isConfigured()) return 'signedIn';
  if (user) return 'signedIn';
  if (loading) return 'restoring';
  return error === 'restore' ? 'restoreFailed' : 'signedOut';
}

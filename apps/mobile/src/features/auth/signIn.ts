import { ACCOUNT_BLOCKED } from '@/core/api/accountBlocked';
import { ApiError } from '@/core/api/httpClient';

import {
  authRepository,
  type ProfileHints,
  SignInFailure,
  type SignInFailureReason,
} from './authRepository';
import { profileRepository } from './profileRepository';

export type SignInResult = { ok: true } | { ok: false; reason: SignInFailureReason };

/**
 * Inicia sessió i assegura el perfil (HU35: «en el primer accés es crea el perfil»). Si el perfil
 * falla, tanca la sessió: així no queda cap compte a mitges i tornar-ho a provar ho arregla. Un
 * compte bloquejat sí que entra: la porta de la sessió li mostra l'avís, amb el botó per sortir.
 */
export async function signInAndEnsureProfile(
  signIn: () => Promise<ProfileHints | void>,
): Promise<SignInResult> {
  let hints: ProfileHints | void;
  try {
    hints = await signIn();
  } catch (error) {
    return { ok: false, reason: error instanceof SignInFailure ? error.reason : 'unknown' };
  }
  try {
    await profileRepository.ensure(hints ?? {});
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.code === ACCOUNT_BLOCKED) return { ok: true };
    await authRepository.signOut().catch(() => {});
    return { ok: false, reason: 'profile' };
  }
}

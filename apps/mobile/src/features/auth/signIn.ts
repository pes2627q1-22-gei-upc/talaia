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
 * falla, tanca la sessió: així no queda cap compte a mitges i tornar-ho a provar ho arregla.
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
  } catch {
    await authRepository.signOut().catch(() => {});
    return { ok: false, reason: 'profile' };
  }
}

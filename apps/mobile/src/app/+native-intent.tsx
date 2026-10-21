import { OAUTH_CALLBACK_PATH } from '@/features/auth/authRepository';

/**
 * A Android, la redirecció de Google (`…/auth/callback?code=…`) també arriba a l'app com a enllaç.
 * `openAuthSessionAsync` ja la gestiona: Expo Router es queda a la benvinguda en lloc d'obrir una
 * ruta que no existeix.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.includes(OAUTH_CALLBACK_PATH) ? '/benvinguda' : path;
}

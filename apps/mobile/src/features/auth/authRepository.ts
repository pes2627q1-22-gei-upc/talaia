import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import { getAuthClient } from '@/core/auth/supabase';

export type AuthUser = { id: string; email?: string };

/** Per què no s'ha pogut iniciar sessió. `cancelled` no es mostra: l'usuari ja ho sap. */
export type SignInFailureReason =
  | 'cancelled'
  | 'network'
  | 'invalidEmail'
  | 'invalidCode'
  | 'rateLimited'
  | 'unavailable'
  | 'profile'
  | 'unknown';

export class SignInFailure extends Error {
  constructor(
    readonly reason: SignInFailureReason,
    options?: { cause?: unknown },
  ) {
    super(reason, options);
    this.name = 'SignInFailure';
  }
}

/** Expo Router la redirigeix a la benvinguda (`+native-intent.tsx`). */
export const OAUTH_CALLBACK_PATH = 'auth/callback';

const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);
const INVALID_EMAIL_CODES = new Set(['email_address_invalid', 'validation_failed']);

/** Tradueix un error de Supabase (o de xarxa) al motiu que entén la vista. */
export function toSignInFailure(error: unknown): SignInFailure {
  if (error instanceof SignInFailure) return error;
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return new SignInFailure('network', { cause: error });
  }
  if (isAuthError(error)) {
    const code = error.code ?? '';
    if (code === 'otp_expired') return new SignInFailure('invalidCode', { cause: error });
    if (RATE_LIMIT_CODES.has(code) || error.status === 429) {
      return new SignInFailure('rateLimited', { cause: error });
    }
    if (INVALID_EMAIL_CODES.has(code)) return new SignInFailure('invalidEmail', { cause: error });
  }
  return new SignInFailure('unknown', { cause: error });
}

function requireClient() {
  const client = getAuthClient();
  if (!client) throw new SignInFailure('unavailable');
  return client;
}

/** Les crides d'Auth tornen `{ error }` en lloc de llançar; aquí tot passa a `SignInFailure`. */
async function guard<R extends { error: unknown }>(run: () => Promise<R>): Promise<R> {
  let result: R;
  try {
    result = await run();
  } catch (error) {
    throw toSignInFailure(error);
  }
  if (result.error) throw toSignInFailure(result.error);
  return result;
}

function toUser(user: AuthUser | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email } : null;
}

export const authRepository = {
  async getUser(): Promise<AuthUser | null> {
    const client = getAuthClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return toUser(data.session?.user);
  },
  subscribe(onChange: (user: AuthUser | null) => void): () => void {
    const client = getAuthClient();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // La restauració explícita gestiona també els errors. El SDK pot emetre
      // INITIAL_SESSION amb null quan falla la lectura/renovació inicial.
      if (event === 'INITIAL_SESSION') return;
      // No cridar mètodes async de Supabase dins d'aquest callback (lock d'Auth).
      onChange(toUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  },
  isConfigured(): boolean {
    return getAuthClient() !== null;
  },
  /** Google pel navegador del sistema (PKCE). A Expo Go la redirecció és `exp://…`. */
  async signInWithGoogle(): Promise<void> {
    const client = requireClient();
    const redirectTo = Linking.createURL(OAUTH_CALLBACK_PATH);
    const { data } = await guard(() =>
      client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      }),
    );
    if (!data.url) throw new SignInFailure('unknown');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new SignInFailure('cancelled');
    const params = new URL(result.url).searchParams;
    const code = params.get('code');
    if (!code) {
      // Google torna `access_denied` si l'usuari no dona permís.
      throw new SignInFailure(params.get('error') === 'access_denied' ? 'cancelled' : 'unknown');
    }
    await guard(() => client.auth.exchangeCodeForSession(code));
  },
  /** Apple amb el full natiu d'iOS (ADR-0016): el token va directe a Supabase. */
  async signInWithApple(): Promise<void> {
    const client = requireClient();
    // Apple rep el hash del nonce i Supabase el nonce: així el token no es pot reutilitzar.
    const nonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      throw new SignInFailure(code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'unknown', {
        cause: error,
      });
    }
    const token = credential.identityToken;
    if (!token) throw new SignInFailure('unknown');
    await guard(() => client.auth.signInWithIdToken({ provider: 'apple', token, nonce }));
    // Apple només dona el nom el primer cop; l'API el llegeix de `full_name` per al perfil.
    const { givenName, familyName } = credential.fullName ?? {};
    const fullName = [givenName, familyName].filter(Boolean).join(' ');
    if (fullName) {
      await guard(() => client.auth.updateUser({ data: { full_name: fullName } }));
    }
  },
  /** Envia un codi de 6 xifres (no un enllaç màgic: a Expo Go fallen). */
  async sendEmailCode(email: string): Promise<void> {
    const client = requireClient();
    await guard(() => client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }));
  },
  async verifyEmailCode(email: string, token: string): Promise<void> {
    const client = requireClient();
    await guard(() => client.auth.verifyOtp({ email, token, type: 'email' }));
  },
  async signOut(): Promise<void> {
    const client = getAuthClient();
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },
  startAutoRefresh(): () => void {
    const client = getAuthClient();
    if (!client || Platform.OS === 'web') return () => {};
    const update = (state: string) => {
      // AppState no espera promeses: deleguem el temporitzador al SDK.
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const listener = AppState.addEventListener('change', update);
    return () => {
      listener.remove();
      void client.auth.stopAutoRefresh();
    };
  },
};

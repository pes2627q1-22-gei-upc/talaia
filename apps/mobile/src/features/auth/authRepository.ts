import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import { getAuthClient } from '@/core/auth/supabase';

export type AuthUser = { id: string; email?: string };

/** Dades del perfil que només té l'app després d'iniciar sessió (el nom d'Apple). */
export type ProfileHints = { nom?: string };

/** Per què no s'ha pogut iniciar sessió. `cancelled` no es mostra: l'usuari ja ho sap. */
export type SignInFailureReason =
  | 'cancelled'
  | 'network'
  | 'invalidEmail'
  | 'invalidCode'
  | 'invalidLink'
  | 'emailNotAllowed'
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
/** On torna l'enllaç del correu: la ruta `app/auth/correu.tsx` hi completa l'inici de sessió. */
export const EMAIL_LINK_PATH = 'auth/correu';

/** Si l'usuari no dona permís: Google torna `access_denied`; Apple, `user_cancelled_authorize`. */
const CANCELLED_OAUTH_ERRORS = new Set(['access_denied', 'user_cancelled_authorize']);
const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);
const INVALID_EMAIL_CODES = new Set(['email_address_invalid', 'validation_failed']);
/** L'enllaç ja s'ha fet servir, ha caducat o s'obre en un altre mòbil (sense el verificador PKCE). */
const INVALID_LINK_CODES = new Set([
  'flow_state_not_found',
  'flow_state_expired',
  'bad_code_verifier',
  'pkce_code_verifier_not_found',
]);

/** Tradueix un error de Supabase (o de xarxa) al motiu que entén la vista. */
export function toSignInFailure(error: unknown): SignInFailure {
  if (error instanceof SignInFailure) return error;
  // `fetch` de React Native llança aquest TypeError sense xarxa; la resta són errors de codi.
  if (
    isAuthRetryableFetchError(error) ||
    (error instanceof TypeError && error.message === 'Network request failed')
  ) {
    return new SignInFailure('network', { cause: error });
  }
  if (isAuthError(error)) {
    const code = error.code ?? '';
    if (code === 'otp_expired') return new SignInFailure('invalidCode', { cause: error });
    if (INVALID_LINK_CODES.has(code) || error.name === 'AuthPKCECodeVerifierMissingError') {
      return new SignInFailure('invalidLink', { cause: error });
    }
    // Sense SMTP propi, Supabase només envia correus a les adreces de l'equip (P21).
    if (code === 'email_address_not_authorized') {
      return new SignInFailure('emailNotAllowed', { cause: error });
    }
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

/** OAuth pel navegador del sistema (PKCE). A Expo Go la redirecció és `exp://…`. */
async function signInWithBrowser(provider: 'google' | 'apple'): Promise<void> {
  const client = requireClient();
  const redirectTo = Linking.createURL(OAUTH_CALLBACK_PATH);
  const { data } = await guard(() =>
    client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        // Després d'un logout, Google ha de deixar triar el compte i no reprendre l'anterior.
        ...(provider === 'google' && { queryParams: { prompt: 'select_account' } }),
      },
    }),
  );
  if (!data.url) throw new SignInFailure('unknown');
  // A Android, la pestanya del navegador en una tasca pròpia no es tanca en tornar a l'app, i el
  // login següent hi reprenia la pàgina de l'anterior (`bad_oauth_state`). Dins la tasca de l'app,
  // es tanca sola.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { createTask: false });
  if (result.type !== 'success') throw new SignInFailure('cancelled');
  const params = new URL(result.url).searchParams;
  const code = params.get('code');
  if (!code) {
    throw new SignInFailure(
      CANCELLED_OAUTH_ERRORS.has(params.get('error') ?? '') ? 'cancelled' : 'unknown',
    );
  }
  await guard(() => client.auth.exchangeCodeForSession(code));
}

/**
 * Si es pot fer servir el full natiu de Sign in with Apple: només a iOS i amb el mòdul natiu, que
 * Expo Go (SDK 57) no porta, ni al simulador ni al mòbil.
 */
async function appleNativeAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
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
  signInWithGoogle(): Promise<void> {
    return signInWithBrowser('google');
  },
  /** Si hi ha el full natiu d'Apple: llavors la benvinguda hi posa el botó oficial. */
  isAppleNativeAvailable(): Promise<boolean> {
    return appleNativeAvailable();
  },
  /**
   * Apple (ADR-0016): amb el full natiu d'iOS si hi és, i el token va directe a Supabase. Sense el
   * mòdul natiu (Expo Go), pel navegador, com Google.
   */
  async signInWithApple(): Promise<ProfileHints> {
    if (!(await appleNativeAvailable())) {
      await signInWithBrowser('apple');
      return {};
    }
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
    // Apple només dona el nom el primer cop i no el posa al token: va al cos de POST /perfil.
    const { givenName, familyName } = credential.fullName ?? {};
    const nom = [givenName, familyName].filter(Boolean).join(' ');
    return nom ? { nom } : {};
  },
  /**
   * Envia el correu per entrar. Amb la plantilla de Talaia porta un codi de 6 xifres; amb la de
   * Supabase per defecte (sense SMTP propi, P21) només porta un enllaç, que torna a
   * `EMAIL_LINK_PATH` amb un `code` PKCE d'un sol ús.
   */
  async sendEmailCode(email: string): Promise<void> {
    const client = requireClient();
    const emailRedirectTo = Linking.createURL(EMAIL_LINK_PATH);
    await guard(() =>
      client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } }),
    );
  },
  /** Completa l'enllaç del correu. Només funciona al mateix mòbil on s'ha demanat (PKCE). */
  async completeEmailLink(code: string): Promise<void> {
    const client = requireClient();
    await guard(() => client.auth.exchangeCodeForSession(code));
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
    // Amb els tipus estrictes de RN 0.88, `currentState` pot ser null (encara desconegut).
    const update = (state: string | null | undefined) => {
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

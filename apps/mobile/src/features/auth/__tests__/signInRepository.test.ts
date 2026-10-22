import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getAuthClient } from '@/core/auth/supabase';

import { authRepository, SignInFailure, toSignInFailure } from '../authRepository';

jest.mock('@/core/auth/supabase', () => ({ getAuthClient: jest.fn() }));
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `exp://192.168.1.50:8081/--/${path}`,
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'raw-nonce',
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const REDIRECT = 'exp://192.168.1.50:8081/--/auth/callback';
const auth = {
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  signInWithIdToken: jest.fn(),
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
};
const ok = { data: {}, error: null };

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getAuthClient)
    .mockReturnValue({ auth } as unknown as NonNullable<ReturnType<typeof getAuthClient>>);
  auth.signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: 'https://supabase.test/authorize' },
    error: null,
  });
  for (const fn of [auth.exchangeCodeForSession, auth.signInWithIdToken]) {
    fn.mockResolvedValue(ok);
  }
  auth.signInWithOtp.mockResolvedValue(ok);
  auth.verifyOtp.mockResolvedValue(ok);
});

async function reason(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SignInFailure);
  return (error as SignInFailure).reason;
}

describe('Google', () => {
  it('obre el navegador amb la redirecció de l’app i canvia el codi per la sessió', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: `${REDIRECT}?code=abc` });
    await authRepository.signInWithGoogle();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://supabase.test/authorize',
      REDIRECT,
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('tancar el navegador o no donar permís és una cancel·lació', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'cancel' } as WebBrowser.WebBrowserAuthSessionResult);
    expect(await reason(authRepository.signInWithGoogle())).toBe('cancelled');

    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: `${REDIRECT}?error=access_denied` });
    expect(await reason(authRepository.signInWithGoogle())).toBe('cancelled');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('una redirecció sense codi és un error', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: `${REDIRECT}?error=server_error` });
    expect(await reason(authRepository.signInWithGoogle())).toBe('unknown');
  });
});

describe('Apple', () => {
  it('sense el mòdul natiu (Expo Go) va pel navegador, com Google', async () => {
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValueOnce(false);
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: `${REDIRECT}?code=abc` });
    expect(await authRepository.signInWithApple()).toEqual({});
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });

  it("tancar el full web d'Apple és una cancel·lació, no un error", async () => {
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValueOnce(false);
    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: `${REDIRECT}?error=user_cancelled_authorize`,
    });
    expect(await reason(authRepository.signInWithApple())).toBe('cancelled');
  });

  it('diu si hi ha el full natiu, perquè la benvinguda hi posi el botó oficial', async () => {
    expect(await authRepository.isAppleNativeAvailable()).toBe(true);
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValueOnce(false);
    expect(await authRepository.isAppleNativeAvailable()).toBe(false);
  });

  it('també pel navegador si no es pot saber si hi és, i fora d’iOS', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: `${REDIRECT}?code=abc` });
    jest
      .mocked(AppleAuthentication.isAvailableAsync)
      .mockRejectedValueOnce(new Error('sense mòdul'));
    await authRepository.signInWithApple();
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    await authRepository.signInWithApple();
    restore.restore();
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(2);
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });

  const credential = { identityToken: 'id-token', fullName: null };

  it('envia el hash del nonce a Apple i el nonce i el token a Supabase', async () => {
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockResolvedValue(
        credential as unknown as AppleAuthentication.AppleAuthenticationCredential,
      );
    expect(await authRepository.signInWithApple()).toEqual({});
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'hashed-nonce' }),
    );
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'id-token',
      nonce: 'raw-nonce',
    });
  });

  it('torna el nom que Apple només dona el primer cop, per al perfil', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
      ...credential,
      fullName: { givenName: 'Martina', familyName: 'Maldonado' },
    } as unknown as AppleAuthentication.AppleAuthenticationCredential);
    expect(await authRepository.signInWithApple()).toEqual({ nom: 'Martina Maldonado' });
  });

  it('cancel·lar el full d’Apple és una cancel·lació', async () => {
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await reason(authRepository.signInWithApple())).toBe('cancelled');
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});

describe('correu', () => {
  it("demana el correu (amb la tornada de l'enllaç) i comprova el codi", async () => {
    await authRepository.sendEmailCode('nom@exemple.cat');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'nom@exemple.cat',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'exp://192.168.1.50:8081/--/auth/correu',
      },
    });
    await authRepository.verifyEmailCode('nom@exemple.cat', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'nom@exemple.cat',
      token: '123456',
      type: 'email',
    });
  });

  it("completa l'enllaç del correu canviant el code PKCE per la sessió", async () => {
    await authRepository.completeEmailLink('pkce-code');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');

    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: new AuthApiError(
        'invalid flow state, no valid flow state found',
        404,
        'flow_state_not_found',
      ),
    });
    expect(await reason(authRepository.completeEmailLink('gastat'))).toBe('invalidLink');
  });

  it('un codi incorrecte o caducat torna invalidCode', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    });
    expect(await reason(authRepository.verifyEmailCode('nom@exemple.cat', '000000'))).toBe(
      'invalidCode',
    );
  });
});

it('sense Supabase configurat, cap mètode pot iniciar sessió', async () => {
  jest.mocked(getAuthClient).mockReturnValue(null);
  expect(authRepository.isConfigured()).toBe(false);
  expect(await reason(authRepository.sendEmailCode('nom@exemple.cat'))).toBe('unavailable');
  expect(await reason(authRepository.signInWithGoogle())).toBe('unavailable');
});

it.each([
  [new AuthRetryableFetchError('fetch failed', 0), 'network'],
  [new TypeError('Network request failed'), 'network'],
  [new AuthApiError('rate', 429, 'over_email_send_rate_limit'), 'rateLimited'],
  [new AuthApiError('bad', 400, 'email_address_invalid'), 'invalidEmail'],
  [new AuthApiError('not authorized', 400, 'email_address_not_authorized'), 'emailNotAllowed'],
  [new AuthApiError('verifier', 400, 'bad_code_verifier'), 'invalidLink'],
  [new AuthApiError('boom', 500, 'unexpected_failure'), 'unknown'],
  [new TypeError("Cannot read properties of undefined (reading 'url')"), 'unknown'],
])('tradueix %p a %s', (error, expected) => {
  expect(toSignInFailure(error).reason).toBe(expected);
});

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { getAuthClient } from '@/core/auth/supabase';

import { authRepository } from '../authRepository';

jest.mock('@/core/auth/supabase', () => ({ getAuthClient: jest.fn() }));
const getSession = jest.fn();
const signOut = jest.fn();
const mockClient = { auth: { getSession, signOut } };

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getAuthClient)
    .mockReturnValue(mockClient as unknown as NonNullable<ReturnType<typeof getAuthClient>>);
});

it('no exposa els tokens ni metadades a les vistes', async () => {
  getSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'secret',
        user: { id: 'one', email: 'one@example.test', metadata: {} },
      },
    },
    error: null,
  });
  expect(await authRepository.getUser()).toEqual({ id: 'one', email: 'one@example.test' });
});

it('propaga errors de restauració i logout', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: new Error('expired') });
  await expect(authRepository.getUser()).rejects.toThrow('expired');
  signOut.mockResolvedValue({ error: new Error('offline') });
  await expect(authRepository.signOut()).rejects.toThrow('offline');
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('permet executar l’app sense credencials de Supabase', async () => {
  jest.mocked(getAuthClient).mockReturnValue(null);
  expect(await authRepository.getUser()).toBeNull();
  await expect(authRepository.signOut()).resolves.toBeUndefined();
});

it('renova només en primer pla i elimina el listener en aturar-se', () => {
  const startAutoRefresh = jest.fn();
  const stopAutoRefresh = jest.fn();
  const remove = jest.fn();
  let change!: (state: AppStateStatus) => void;
  const originalOS = Platform.OS;
  Platform.OS = 'android';
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      change = callback;
      return { remove };
    });
  jest
    .mocked(getAuthClient)
    .mockReturnValue({ auth: { startAutoRefresh, stopAutoRefresh } } as unknown as NonNullable<
      ReturnType<typeof getAuthClient>
    >);
  try {
    const stop = authRepository.startAutoRefresh();
    startAutoRefresh.mockClear();
    stopAutoRefresh.mockClear();
    change('active');
    expect(startAutoRefresh).toHaveBeenCalledTimes(1);
    change('background');
    expect(stopAutoRefresh).toHaveBeenCalledTimes(1);
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(stopAutoRefresh).toHaveBeenCalledTimes(2);
  } finally {
    listener.mockRestore();
    Platform.OS = originalOS;
  }
});

it('no oculta errors de restauració amb INITIAL_SESSION i escolta els canvis posteriors', () => {
  let event!: (name: AuthChangeEvent, session: Session | null) => void;
  const unsubscribe = jest.fn();
  const onAuthStateChange = jest.fn((callback) => {
    event = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  jest
    .mocked(getAuthClient)
    .mockReturnValue({ auth: { onAuthStateChange } } as unknown as NonNullable<
      ReturnType<typeof getAuthClient>
    >);
  const change = jest.fn();
  const stop = authRepository.subscribe(change);
  event('INITIAL_SESSION', null);
  expect(change).not.toHaveBeenCalled();
  event('SIGNED_IN', {
    user: { id: 'one', email: 'one@example.test' },
    access_token: 'secret',
  } as Session);
  expect(change).toHaveBeenLastCalledWith({ id: 'one', email: 'one@example.test' });
  event('SIGNED_OUT', null);
  expect(change).toHaveBeenLastCalledWith(null);
  stop();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

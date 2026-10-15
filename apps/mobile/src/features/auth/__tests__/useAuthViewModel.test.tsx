import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import '@/core/i18n';

import { AuthProvider } from '../AuthProvider';
import { authRepository, type AuthUser } from '../authRepository';
import { useAuthViewModel } from '../useAuthViewModel';

jest.mock('../authRepository', () => ({
  authRepository: {
    getUser: jest.fn(),
    subscribe: jest.fn(),
    signOut: jest.fn(),
    startAutoRefresh: jest.fn(),
  },
}));

const repository = jest.mocked(authRepository);
let change: (user: AuthUser | null) => void;
const unsubscribe = jest.fn();
const stopRefresh = jest.fn();
let cache: QueryClient;

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={cache}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  repository.getUser.mockResolvedValue(null);
  repository.signOut.mockResolvedValue(undefined);
  repository.subscribe.mockImplementation((callback) => {
    change = callback;
    return unsubscribe;
  });
  repository.startAutoRefresh.mockReturnValue(stopRefresh);
});

afterEach(() => cache.clear());

it('restaura només les dades públiques de la sessió', async () => {
  repository.getUser.mockResolvedValue({ id: 'one', email: 'one@example.test' });
  const { result, unmount } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isAuthenticated).toBe(true);
  expect(result.current.user?.email).toBe('one@example.test');
  await unmount();
  expect(unsubscribe).toHaveBeenCalled();
  expect(stopRefresh).toHaveBeenCalled();
});

it('un resultat de restauració antic no sobreescriu un canvi de sessió', async () => {
  let resolve!: (user: AuthUser | null) => void;
  repository.getUser.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await act(() => change({ id: 'new' }));
  await act(() => resolve({ id: 'old' }));
  expect(result.current.user?.id).toBe('new');
});

it('permet reintentar la restauració després d’un error', async () => {
  repository.getUser.mockRejectedValueOnce(new Error('storage unavailable'));
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.error).toBe('restore'));
  repository.getUser.mockResolvedValue({ id: 'one' });
  await act(() => result.current.restore());
  expect(result.current.error).toBeNull();
  expect(result.current.user?.id).toBe('one');
});

it('buida la memòria cau en canviar de compte i en tancar sessió', async () => {
  repository.getUser.mockResolvedValue({ id: 'one' });
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  cache.setQueryData(['private'], 'one');
  await act(() => change({ id: 'two' }));
  expect(cache.getQueryData(['private'])).toBeUndefined();
  cache.setQueryData(['private'], 'two');
  await act(() => result.current.signOut());
  expect(result.current.isAuthenticated).toBe(false);
  expect(cache.getQueryData(['private'])).toBeUndefined();
});

it('no afirma haver tancat sessió si falla el logout i permet reintentar', async () => {
  repository.getUser.mockResolvedValue({ id: 'one' });
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  repository.signOut.mockRejectedValueOnce(new Error('network'));
  await act(() => result.current.signOut());
  expect(result.current.error).toBe('logout');
  expect(result.current.user?.id).toBe('one');
  await act(() => result.current.signOut());
  expect(result.current.isAuthenticated).toBe(false);
  expect(result.current.error).toBeNull();
});

it('el logout invalida la restauració pendent i evita crides duplicades', async () => {
  let resolve!: (user: AuthUser | null) => void;
  repository.getUser.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await act(async () => {
    await Promise.all([result.current.signOut(), result.current.signOut()]);
  });
  await act(() => resolve({ id: 'old' }));
  expect(result.current.isAuthenticated).toBe(false);
  expect(repository.signOut).toHaveBeenCalledTimes(1);
});

it('un logout antic no esborra una sessió nova', async () => {
  repository.getUser.mockResolvedValue({ id: 'old' });
  let finish!: () => void;
  repository.signOut.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending!: Promise<void>;
  await act(() => {
    pending = result.current.signOut();
  });
  await act(() => change({ id: 'new' }));
  await act(async () => {
    finish();
    await pending;
  });
  expect(result.current.user?.id).toBe('new');
});

it('renovar la sessió del mateix usuari conserva la memòria cau', async () => {
  repository.getUser.mockResolvedValue({ id: 'one' });
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  cache.setQueryData(['private'], 'data');
  await act(() => change({ id: 'one' }));
  expect(cache.getQueryData(['private'])).toBe('data');
});

it('respecta SIGNED_OUT encara que després falli la revocació remota', async () => {
  repository.getUser.mockResolvedValue({ id: 'one' });
  repository.signOut.mockImplementationOnce(async () => {
    change(null);
    throw new Error('remote revocation failed after local removal');
  });
  const { result } = await renderHook(useAuthViewModel, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.signOut());
  expect(result.current.user).toBeNull();
  expect(result.current.error).toBeNull();
});

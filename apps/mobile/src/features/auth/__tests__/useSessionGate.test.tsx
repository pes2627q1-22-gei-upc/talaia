import { renderHook } from '@testing-library/react-native';

import { authRepository } from '../authRepository';
import { useAuthState } from '../AuthProvider';
import { useSessionGate } from '../useSessionGate';

jest.mock('../AuthProvider', () => ({ useAuthState: jest.fn() }));
jest.mock('../authRepository', () => ({ authRepository: { isConfigured: jest.fn(() => true) } }));

function gate(user: { id: string } | null, loading = false, error: 'restore' | null = null) {
  jest
    .mocked(useAuthState)
    .mockReturnValue({ user, loading, error } as ReturnType<typeof useAuthState>);
  return renderHook(() => useSessionGate());
}

it('sense sessió, la porta és la benvinguda; amb sessió, l’app', async () => {
  expect((await gate(null)).result.current).toBe('signedOut');
  expect((await gate({ id: 'u' })).result.current).toBe('signedIn');
  expect((await gate(null, true)).result.current).toBe('restoring');
});

it("si no s'ha pogut recuperar la sessió, no envia a la benvinguda: es torna a provar", async () => {
  expect((await gate(null, false, 'restore')).result.current).toBe('restoreFailed');
  expect((await gate({ id: 'u' }, false, 'restore')).result.current).toBe('signedIn');
});

it('sense Supabase configurat, la porta és oberta', async () => {
  jest.mocked(authRepository.isConfigured).mockReturnValue(false);
  expect((await gate(null)).result.current).toBe('signedIn');
});

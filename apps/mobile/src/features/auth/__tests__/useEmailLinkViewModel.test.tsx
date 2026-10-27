import { act, renderHook } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import i18n from '@/core/i18n';

import { authRepository } from '../authRepository';
import { signInAndEnsureProfile } from '../signIn';
import { useEmailLinkViewModel } from '../useEmailLinkViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('../signIn', () => ({ signInAndEnsureProfile: jest.fn() }));
jest.mock('../authRepository', () => ({
  authRepository: { completeEmailLink: jest.fn() },
}));
const replace = jest.fn();
const dismissAll = jest.fn();
const canDismiss = jest.fn(() => true);
jest
  .mocked(useRouter)
  .mockReturnValue({ replace, dismissAll, canDismiss } as unknown as ReturnType<typeof useRouter>);

function withParams(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
}

describe('useEmailLinkViewModel', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('ca');
  });

  it("amb un code, entra a l'app un sol cop", async () => {
    withParams({ code: 'pkce-code' });
    jest.mocked(signInAndEnsureProfile).mockImplementation(async (signIn) => {
      await signIn();
      return { ok: true };
    });
    const { result, rerender } = await renderHook(() => useEmailLinkViewModel());
    expect(result.current.title).toBe('Entrant…');
    await act(async () => {});
    await rerender({});
    expect(authRepository.completeEmailLink).toHaveBeenCalledTimes(1);
    expect(authRepository.completeEmailLink).toHaveBeenCalledWith('pkce-code');
    expect(dismissAll).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it("si l'enllaç no serveix, ho diu i deixa tornar a la benvinguda", async () => {
    withParams({ code: 'gastat' });
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: false, reason: 'invalidLink' });
    const { result } = await renderHook(() => useEmailLinkViewModel());
    await act(async () => {});
    expect(result.current.failed).toBe(true);
    expect(result.current.title).toBe('No hem pogut entrar');
    expect(result.current.subtitle).toContain("Obre'l al mateix mòbil");
    await act(() => result.current.back());
    expect(replace).toHaveBeenCalledWith('/benvinguda');
  });

  it('si Supabase ja torna un error (enllaç caducat), no intenta res', async () => {
    withParams({ error: 'access_denied', error_code: 'otp_expired' });
    const { result } = await renderHook(() => useEmailLinkViewModel());
    expect(signInAndEnsureProfile).not.toHaveBeenCalled();
    expect(result.current.subtitle).toBe('El codi no és correcte o ha caducat.');
  });
});

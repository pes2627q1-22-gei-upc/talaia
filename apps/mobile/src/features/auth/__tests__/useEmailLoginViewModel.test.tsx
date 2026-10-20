import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import i18n from '@/core/i18n';

import { authRepository, SignInFailure } from '../authRepository';
import { signInAndEnsureProfile } from '../signIn';
import { RESEND_AFTER_S, useEmailLoginViewModel } from '../useEmailLoginViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../signIn', () => ({ signInAndEnsureProfile: jest.fn() }));
jest.mock('../authRepository', () => ({
  ...jest.requireActual('../authRepository'),
  authRepository: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
}));
const replace = jest.fn();
const dismissAll = jest.fn();
jest
  .mocked(useRouter)
  .mockReturnValue({ replace, dismissAll } as unknown as ReturnType<typeof useRouter>);

async function atCodeStep() {
  const hook = await renderHook(() => useEmailLoginViewModel());
  await act(() => hook.result.current.setEmail(' Nom@Exemple.cat '));
  await act(() => hook.result.current.submit());
  return hook;
}

describe('useEmailLoginViewModel', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(authRepository.sendEmailCode).mockResolvedValue();
    await i18n.changeLanguage('ca');
  });

  it("només deixa enviar una adreça vàlida, i l'envia neta", async () => {
    const { result } = await renderHook(() => useEmailLoginViewModel());
    expect(result.current.step).toBe('email');
    expect(result.current.canSubmit).toBe(false);
    await act(() => result.current.setEmail('nom@'));
    expect(result.current.canSubmit).toBe(false);
    await act(() => result.current.setEmail(' Nom@Exemple.cat '));
    expect(result.current.canSubmit).toBe(true);
    await act(() => result.current.submit());
    expect(authRepository.sendEmailCode).toHaveBeenCalledWith('nom@exemple.cat');
    expect(result.current.step).toBe('code');
    expect(result.current.subtitle).toContain('nom@exemple.cat');
  });

  it.each(['nom@exemple', '@exemple.cat', 'nom@exemple.', 'n m@exemple.cat', 'a@b@exemple.cat'])(
    'no accepta «%s»',
    async (value) => {
      const { result } = await renderHook(() => useEmailLoginViewModel());
      await act(() => result.current.setEmail(value));
      expect(result.current.canSubmit).toBe(false);
    },
  );

  it('si no es pot enviar, es queda a l’adreça amb el motiu', async () => {
    jest.mocked(authRepository.sendEmailCode).mockRejectedValue(new SignInFailure('rateLimited'));
    const { result } = await atCodeStep();
    expect(result.current.step).toBe('email');
    expect(result.current.errorMessage).toBe(
      'Massa intents seguits. Espera un moment i torna-ho a provar.',
    );
  });

  it('en escriure la sisena xifra, comprova el codi i entra a l’app', async () => {
    jest.mocked(signInAndEnsureProfile).mockImplementation(async (signIn) => {
      await signIn();
      return { ok: true };
    });
    const { result } = await atCodeStep();
    await act(() => result.current.setCode('12 34a5'));
    expect(result.current.code).toBe('12345');
    expect(signInAndEnsureProfile).not.toHaveBeenCalled();
    await act(async () => result.current.setCode('123456'));
    expect(authRepository.verifyEmailCode).toHaveBeenCalledWith('nom@exemple.cat', '123456');
    expect(dismissAll).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('un codi incorrecte s’esborra i es diu per què', async () => {
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: false, reason: 'invalidCode' });
    const { result } = await atCodeStep();
    await act(async () => result.current.setCode('000000'));
    expect(result.current.code).toBe('');
    expect(result.current.errorMessage).toBe('El codi no és correcte o ha caducat.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('si falla el perfil, el codi ja gastat s’esborra i se’n pot demanar un altre', async () => {
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: false, reason: 'profile' });
    const { result } = await atCodeStep();
    expect(result.current.canResend).toBe(false);
    await act(async () => result.current.setCode('123456'));
    expect(result.current.code).toBe('');
    expect(result.current.canResend).toBe(true);
  });

  it('es pot tornar a enviar el codi quan passa el minut', async () => {
    jest.useFakeTimers();
    const { result } = await atCodeStep();
    expect(result.current.canResend).toBe(false);
    expect(result.current.resendLabel).toBe(`Torna a enviar el codi (${RESEND_AFTER_S} s)`);
    for (let s = 0; s < RESEND_AFTER_S; s++) {
      await act(() => jest.advanceTimersByTime(1000));
    }
    expect(result.current.canResend).toBe(true);
    await act(() => result.current.resend());
    expect(authRepository.sendEmailCode).toHaveBeenCalledTimes(2);
    expect(result.current.notice).toBe("T'hem enviat un codi nou.");
    jest.useRealTimers();
  });

  it("canviar l'adreça torna al primer pas", async () => {
    const { result } = await atCodeStep();
    await act(() => result.current.changeEmail());
    expect(result.current.step).toBe('email');
    expect(result.current.email).toBe(' Nom@Exemple.cat ');
  });
});

import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import i18n from '@/core/i18n';

import { authRepository } from '../authRepository';
import { signInAndEnsureProfile } from '../signIn';
import { useWelcomeViewModel } from '../useWelcomeViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../signIn', () => ({ signInAndEnsureProfile: jest.fn() }));
jest.mock('../authRepository', () => ({
  authRepository: {
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    isAppleAvailable: jest.fn(async () => true),
  },
}));
const replace = jest.fn();
const push = jest.fn();
jest
  .mocked(useRouter)
  .mockReturnValue({ replace, push } as unknown as ReturnType<typeof useRouter>);

describe('useWelcomeViewModel', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('ca');
  });

  it('dona els textos del mockup en català', async () => {
    const { result } = await renderHook(() => useWelcomeViewModel());
    expect(result.current.tagline).toBe('On i quan mirar el cel.');
    expect(result.current.googleLabel).toBe('Continua amb Google');
    expect(result.current.emailLabel).toBe('Continua amb el correu');
    expect(result.current.errorMessage).toBeNull();
  });

  it("tradueix els textos a la llengua de l'app", async () => {
    await i18n.changeLanguage('en');
    const { result } = await renderHook(() => useWelcomeViewModel());
    expect(result.current.tagline).toBe('Where and when to look at the sky.');
    expect(result.current.googleLabel).toBe('Continue with Google');
  });

  it('ofereix Apple només si el dispositiu el pot fer servir (ADR-0016)', async () => {
    const available = await renderHook(() => useWelcomeViewModel());
    expect(available.result.current.showApple).toBe(true);

    // Android, o un Expo Go sense el mòdul natiu: el botó oficial sortiria com un error.
    jest.mocked(authRepository.isAppleAvailable).mockResolvedValueOnce(false);
    const unavailable = await renderHook(() => useWelcomeViewModel());
    expect(unavailable.result.current.showApple).toBe(false);
  });

  it("amb Google, inicia sessió i deixa a la vista l'entrada a l'app", async () => {
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: true });
    const onSignedIn = jest.fn();
    const { result } = await renderHook(() => useWelcomeViewModel(onSignedIn));
    await act(() => result.current.continueWithGoogle());
    expect(signInAndEnsureProfile).toHaveBeenCalledWith(authRepository.signInWithGoogle);
    expect(replace).not.toHaveBeenCalled();
    onSignedIn.mock.calls[0][0]();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('mentre inicia sessió, està ocupat i no en comença una altra', async () => {
    let finish!: (value: { ok: true }) => void;
    jest
      .mocked(signInAndEnsureProfile)
      .mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useWelcomeViewModel());
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.continueWithGoogle();
    });
    expect(result.current.busy).toBe(true);
    expect(result.current.googleLabel).toBe('Entrant…');
    await act(() => result.current.continueWithApple());
    expect(signInAndEnsureProfile).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ ok: true });
      await first;
    });
    expect(result.current.busy).toBe(false);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('un error es mostra traduït; cancel·lar no mostra res', async () => {
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: false, reason: 'network' });
    const { result } = await renderHook(() => useWelcomeViewModel());
    await act(() => result.current.continueWithApple());
    expect(signInAndEnsureProfile).toHaveBeenCalledWith(authRepository.signInWithApple);
    expect(result.current.errorMessage).toBe('No hi ha connexió. Revisa-la i torna-ho a provar.');

    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: false, reason: 'cancelled' });
    await act(() => result.current.continueWithGoogle());
    expect(result.current.errorMessage).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('el correu obre la seva pantalla', async () => {
    const { result } = await renderHook(() => useWelcomeViewModel());
    await act(() => result.current.continueWithEmail());
    expect(push).toHaveBeenCalledWith('/benvinguda-correu');
  });
});

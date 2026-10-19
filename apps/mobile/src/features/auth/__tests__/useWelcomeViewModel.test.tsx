import { renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

import i18n from '@/core/i18n';

import { useWelcomeViewModel } from '../useWelcomeViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
const replace = jest.fn();
jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);

describe('useWelcomeViewModel', () => {
  beforeEach(async () => {
    replace.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('dona els textos del mockup en català', async () => {
    const { result } = await renderHook(() => useWelcomeViewModel());
    expect(result.current.tagline).toBe('On i quan mirar el cel.');
    expect(result.current.googleLabel).toBe('Continua amb Google');
    expect(result.current.emailLabel).toBe('Continua amb el correu');
  });

  it("tradueix els textos a la llengua de l'app", async () => {
    await i18n.changeLanguage('en');
    const { result } = await renderHook(() => useWelcomeViewModel());
    expect(result.current.tagline).toBe('Where and when to look at the sky.');
    expect(result.current.appleLabel).toBe('Continue with Apple');
  });

  it('ofereix Apple a iOS i no a Android (ADR-0016)', async () => {
    const ios = await renderHook(() => useWelcomeViewModel());
    expect(ios.result.current.showApple).toBe(true);

    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    const android = await renderHook(() => useWelcomeViewModel());
    expect(android.result.current.showApple).toBe(false);
    restore.restore();
  });

  it("fins a TG-83, totes les opcions entren a l'app", async () => {
    const { result } = await renderHook(() => useWelcomeViewModel());
    result.current.continueWithGoogle();
    result.current.continueWithApple();
    result.current.continueWithEmail();
    expect(replace).toHaveBeenCalledTimes(3);
    expect(replace).toHaveBeenCalledWith('/');
  });
});

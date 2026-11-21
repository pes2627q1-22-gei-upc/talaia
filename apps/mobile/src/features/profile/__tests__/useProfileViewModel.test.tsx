import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { apiGet } from '@/core/api/httpClient';
import i18n, { LANGUAGE_KEY, restoreLanguage } from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { useProfileViewModel } from '../useProfileViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));

jest.mock('@/features/auth/useAuthViewModel', () => ({
  useAuthViewModel: () => ({
    isAuthenticated: true,
    logoutLabel: 'Tanca la sessió',
    user: { id: 'u', email: 'maria@example.com' },
  }),
}));

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
const push = jest.fn();
jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);

describe('useProfileViewModel', () => {
  beforeEach(async () => {
    jest.mocked(apiGet).mockResolvedValue({
      id: 'p1',
      rol: 'usuari',
      authUserId: 'u',
      email: 'maria@example.com',
      nom: 'Maria Puig',
      avatarUrl: null,
      dataCreacio: '2026-11-01T00:00:00Z',
      dataActualitzacio: '2026-11-01T00:00:00Z',
    });
    await i18n.changeLanguage('ca');
  });

  it("ofereix els tres idiomes i marca l'actual", async () => {
    const { result } = await renderHook(() => useProfileViewModel(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.languages.map((l) => l.code)).toEqual(['ca', 'es', 'en']);
    expect(result.current.languages.find((l) => l.selected)?.code).toBe('ca');
    expect(result.current.title).toBe('Perfil');
  });

  it("si l'idioma del dispositiu no és dels tres, marca el català", async () => {
    await i18n.changeLanguage('fr');
    const { result } = await renderHook(() => useProfileViewModel(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.currentLanguage).toBe('ca');
  });

  it('exposa la sessió tal com la dona useAuthViewModel (el logout és a la pantalla)', async () => {
    const { result } = await renderHook(() => useProfileViewModel(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.auth).toMatchObject({ isAuthenticated: true });
    expect(result.current.accountLabel).toBe('Compte');
    expect(result.current.email).toBe('maria@example.com');
    // Amb sessió, l'entrada a «Els meus plans» (TG-160).
    expect(result.current.plans?.label).toBe('Els meus plans');
    result.current.plans?.onPress();
    expect(push).toHaveBeenCalledWith('/plans');
    // L'estat del servidor és per a l'equip: als tests (__DEV__) surt; a la build publicada, no.
    expect(result.current.showApiStatus).toBe(true);
  });

  it("canvia l'idioma de l'app i el desa per a la propera vegada", async () => {
    const { result } = await renderHook(() => useProfileViewModel(), {
      wrapper: createQueryWrapper(),
    });
    await act(() => result.current.selectLanguage('en'));
    expect(result.current.currentLanguage).toBe('en');
    expect(result.current.languageLabel).toBe('Language');
    expect(await AsyncStorage.getItem(LANGUAGE_KEY)).toBe('en');
  });

  it("en arrencar, l'idioma desat mana sobre el del dispositiu", async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'es');
    await restoreLanguage();
    expect(i18n.language).toBe('es');
    // Un valor que no és dels tres no canvia res.
    await AsyncStorage.setItem(LANGUAGE_KEY, 'fr');
    await i18n.changeLanguage('ca');
    await restoreLanguage();
    expect(i18n.language).toBe('ca');
  });
});

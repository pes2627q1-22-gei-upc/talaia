import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import i18n, { LANGUAGE_KEY, restoreLanguage } from '@/core/i18n';

import { useProfileViewModel } from '../useProfileViewModel';

jest.mock('@/features/auth/useAuthViewModel', () => ({
  useAuthViewModel: () => ({
    isAuthenticated: true,
    logoutLabel: 'Tanca la sessió',
    user: { id: 'u', email: 'maria@example.com' },
  }),
}));

describe('useProfileViewModel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
  });

  it("ofereix els tres idiomes i marca l'actual", async () => {
    const { result } = await renderHook(() => useProfileViewModel());
    expect(result.current.languages.map((l) => l.code)).toEqual(['ca', 'es', 'en']);
    expect(result.current.languages.find((l) => l.selected)?.code).toBe('ca');
    expect(result.current.title).toBe('Perfil');
  });

  it("si l'idioma del dispositiu no és dels tres, marca el català", async () => {
    await i18n.changeLanguage('fr');
    const { result } = await renderHook(() => useProfileViewModel());
    expect(result.current.currentLanguage).toBe('ca');
  });

  it('exposa la sessió tal com la dona useAuthViewModel (el logout és a la pantalla)', async () => {
    const { result } = await renderHook(() => useProfileViewModel());
    expect(result.current.auth).toMatchObject({ isAuthenticated: true });
    expect(result.current.accountLabel).toBe('Compte');
    expect(result.current.email).toBe('maria@example.com');
    // L'estat del servidor és per a l'equip: als tests (__DEV__) surt; a la build publicada, no.
    expect(result.current.showApiStatus).toBe(true);
  });

  it("canvia l'idioma de l'app i el desa per a la propera vegada", async () => {
    const { result } = await renderHook(() => useProfileViewModel());
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

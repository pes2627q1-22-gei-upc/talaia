import { act, renderHook } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { useProfileViewModel } from '../useProfileViewModel';

jest.mock('@/features/auth/useAuthViewModel', () => ({
  useAuthViewModel: () => ({ isAuthenticated: true, logoutLabel: 'Tanca la sessió' }),
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
    expect(result.current.auth).toEqual({ isAuthenticated: true, logoutLabel: 'Tanca la sessió' });
  });

  it("canvia l'idioma de l'app", async () => {
    const { result } = await renderHook(() => useProfileViewModel());
    await act(() => result.current.selectLanguage('en'));
    expect(result.current.currentLanguage).toBe('en');
    expect(result.current.languageLabel).toBe('Language');
  });
});

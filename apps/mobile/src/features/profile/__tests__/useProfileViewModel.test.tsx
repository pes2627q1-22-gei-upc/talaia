import { act, renderHook } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { useProfileViewModel } from '../useProfileViewModel';

jest.mock('@/features/auth/useAuthViewModel', () => ({
  useAuthViewModel: () => ({ isAuthenticated: false }),
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

  it("canvia l'idioma de l'app", async () => {
    const { result } = await renderHook(() => useProfileViewModel());
    await act(() => result.current.selectLanguage('en'));
    expect(result.current.currentLanguage).toBe('en');
    expect(result.current.languageLabel).toBe('Language');
  });
});

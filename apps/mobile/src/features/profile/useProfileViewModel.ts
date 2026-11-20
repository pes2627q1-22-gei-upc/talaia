import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { isSupportedLanguage, saveLanguage, SUPPORTED_LANGUAGES, type Language } from '@/core/i18n';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';

/**
 * ViewModel del perfil: idioma, accions de la sessió actual i l'entrada a «Els meus plans».
 */
export function useProfileViewModel() {
  const auth = useAuthViewModel();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const current: Language = isSupportedLanguage(i18n.language) ? i18n.language : 'ca';

  return {
    auth,
    title: t('profile.title'),
    languageLabel: t('profile.language'),
    currentLanguage: current,
    languages: SUPPORTED_LANGUAGES.map((code) => ({
      code,
      label: t(`profile.languages.${code}`),
      selected: code === current,
    })),
    selectLanguage: (code: Language) => saveLanguage(code),
    accountLabel: t('profile.account'),
    email: auth.isAuthenticated ? (auth.user?.email ?? null) : null,
    /** «Els meus plans» (TG-160): sense sessió no n'hi ha (l'API respon 401) i no surt. */
    plans: auth.isAuthenticated
      ? {
          label: t('profile.plans'),
          onPress: () => router.push('/plans'),
        }
      : null,
    /** L'estat del servidor és per a l'equip: a la build publicada no surt. */
    showApiStatus: __DEV__,
  };
}

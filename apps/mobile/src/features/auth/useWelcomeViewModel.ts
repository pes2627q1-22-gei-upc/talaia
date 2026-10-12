import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

export type AuthProvider = 'google' | 'apple' | 'email';

/**
 * ViewModel de la benvinguda (HU35, mockup 01). Encara no inicia sessió: Supabase Auth arriba
 * amb TG-81 i la sessió amb TG-83, que substituiran `continueWith`.
 */
export function useWelcomeViewModel() {
  const { t } = useTranslation();
  const router = useRouter();

  // ponytail: fins a TG-83 cap opció inicia sessió; totes tanquen la benvinguda i entren a l'app.
  const continueWith = (_provider: AuthProvider) => router.replace('/');

  return {
    appName: t('welcome.appName'),
    tagline: t('welcome.tagline'),
    description: t('welcome.description'),
    legal: t('welcome.legal'),
    googleLabel: t('welcome.continueGoogle'),
    appleLabel: t('welcome.continueApple'),
    emailLabel: t('welcome.continueEmail'),
    /** Sign in with Apple només a iOS (ADR-0016). */
    showApple: Platform.OS === 'ios',
    continueWithGoogle: () => continueWith('google'),
    continueWithApple: () => continueWith('apple'),
    continueWithEmail: () => continueWith('email'),
  };
}

import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authRepository, type SignInFailureReason } from './authRepository';
import { signInAndEnsureProfile } from './signIn';

export type AuthMethod = 'google' | 'apple';

/** Missatge d'error d'un inici de sessió fallit; cancel·lar no en té. */
export function useSignInErrorMessage() {
  const { t } = useTranslation();
  return (reason: SignInFailureReason | null) =>
    reason && reason !== 'cancelled' ? t(`auth.errors.${reason}`) : null;
}

/**
 * ViewModel de la benvinguda (HU35, mockup 01). Google i Apple inicien sessió aquí mateix; el
 * correu té la seva pantalla. `onSignedIn` rep l'acció d'entrar a l'app perquè la vista hi pugui
 * posar la seva sortida.
 */
export function useWelcomeViewModel(onSignedIn: (enterApp: () => void) => void = (go) => go()) {
  const { t } = useTranslation();
  const router = useRouter();
  const errorMessage = useSignInErrorMessage();
  const [pending, setPending] = useState<AuthMethod | null>(null);
  const [failure, setFailure] = useState<SignInFailureReason | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    void authRepository.isAppleAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (method: AuthMethod) => {
    if (busy.current) return;
    busy.current = true;
    setPending(method);
    setFailure(null);
    const result = await signInAndEnsureProfile(
      method === 'google' ? authRepository.signInWithGoogle : authRepository.signInWithApple,
    );
    busy.current = false;
    setPending(null);
    if (result.ok) onSignedIn(() => router.replace('/'));
    else setFailure(result.reason);
  };

  return {
    appName: t('welcome.appName'),
    tagline: t('welcome.tagline'),
    description: t('welcome.description'),
    legal: t('welcome.legal'),
    googleLabel: t(pending === 'google' ? 'welcome.signingIn' : 'welcome.continueGoogle'),
    emailLabel: t('welcome.continueEmail'),
    /** Sign in with Apple només a iOS (ADR-0016) i si el dispositiu el pot fer servir. */
    showApple: appleAvailable,
    busy: pending !== null,
    errorMessage: errorMessage(failure),
    continueWithGoogle: () => signIn('google'),
    continueWithApple: () => signIn('apple'),
    continueWithEmail: () => {
      setFailure(null);
      router.push('/benvinguda-correu');
    },
  };
}

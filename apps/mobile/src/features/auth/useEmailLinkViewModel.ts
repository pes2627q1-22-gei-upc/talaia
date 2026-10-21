import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authRepository, type SignInFailureReason } from './authRepository';
import { signInAndEnsureProfile } from './signIn';
import { useSignInErrorMessage } from './useWelcomeViewModel';

type LinkParams = { code?: string; error_code?: string };

/** Motiu d'un enllaç que Supabase ja torna amb error (caducat, gastat…). */
function linkFailure(errorCode: string): SignInFailureReason {
  return errorCode === 'otp_expired' ? 'invalidCode' : 'invalidLink';
}

/**
 * L'enllaç del correu torna aquí amb un `code` PKCE (TG-249). Es canvia per la sessió un sol cop,
 * s'assegura el perfil i s'entra a l'app; si falla, es diu per què i es torna a la benvinguda.
 */
export function useEmailLinkViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const errorMessage = useSignInErrorMessage();
  const { code, error_code: errorCode } = useLocalSearchParams<LinkParams>();
  const [failure, setFailure] = useState<SignInFailureReason | null>(
    code ? null : linkFailure(errorCode ?? ''),
  );
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    void signInAndEnsureProfile(() => authRepository.completeEmailLink(code)).then((result) => {
      if (result.ok) {
        if (router.canDismiss()) router.dismissAll();
        router.replace('/');
      } else {
        setFailure(result.reason);
      }
    });
  }, [code, router]);

  return {
    failed: failure !== null,
    title: t(failure ? 'emailLink.errorTitle' : 'emailLink.title'),
    subtitle: failure
      ? (errorMessage(failure) ?? t('auth.errors.unknown'))
      : t('emailLink.subtitle'),
    backLabel: t('emailLink.back'),
    back: () => router.replace('/benvinguda'),
  };
}

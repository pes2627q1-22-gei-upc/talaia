import { useTranslation } from 'react-i18next';

import { useAuthViewModel } from './useAuthViewModel';

/** Avís de compte bloquejat (HU41, TG-179): l'única sortida és tancar la sessió. */
export function useAccountBlockedViewModel() {
  const auth = useAuthViewModel();
  const { t } = useTranslation();
  return {
    title: t('accountBlocked.title'),
    // Si el logout falla, ho diu en lloc de l'explicació: el botó serveix per tornar-ho a provar.
    message: auth.error === 'logout' ? t('auth.logoutError') : t('accountBlocked.message'),
    signOutLabel: auth.logoutLabel,
    signingOut: auth.signingOut,
    signOut: () => void auth.signOut(),
  };
}

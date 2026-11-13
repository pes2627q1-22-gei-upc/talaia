import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { accountBlocked } from '@/core/api/accountBlocked';
import { env } from '@/core/config/env';

import { profileRepository } from './profileRepository';
import { useAuthViewModel } from './useAuthViewModel';

/**
 * Avís de compte bloquejat (HU41, TG-179): es pot tancar la sessió o tornar a comprovar-ho, per si
 * l'han desbloquejat amb l'app oberta.
 */
export function useAccountBlockedViewModel() {
  const auth = useAuthViewModel();
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [contactFailed, setContactFailed] = useState(false);

  // Si encara està bloquejat, el client HTTP el torna a marcar; un error de xarxa no canvia res.
  const retry = useCallback(async () => {
    setChecking(true);
    try {
      await profileRepository.ensure();
      accountBlocked.clear();
    } catch {
      // Segueix bloquejat o sense xarxa: l'avís es queda.
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    title: t('accountBlocked.title'),
    // Si el logout falla, ho diu en lloc de l'explicació: el botó serveix per tornar-ho a provar.
    message: auth.error === 'logout' ? t('auth.logoutError') : t('accountBlocked.message'),
    signOutLabel: auth.logoutLabel,
    signingOut: auth.signingOut,
    signOut: () => void auth.signOut(),
    retryLabel: t(checking ? 'accountBlocked.checking' : 'accountBlocked.retry'),
    checking,
    retry: () => void retry(),
    /** Sense `EXPO_PUBLIC_CONTACT_EMAIL`, l'avís no ofereix escriure a l'equip. */
    contact: env.contactEmail
      ? {
          label: t('accountBlocked.contact', { email: env.contactEmail }),
          // Sense app de correu, `mailto:` falla: es diu i l'adreça queda a la vista per copiar-la.
          open: () => {
            setContactFailed(false);
            Linking.openURL(`mailto:${env.contactEmail}`).catch(() => setContactFailed(true));
          },
          error: contactFailed
            ? t('accountBlocked.contactError', { email: env.contactEmail })
            : null,
        }
      : null,
  };
}

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
  const account = auth.user?.email ?? null;
  const team = env.contactEmail;

  // L'assumpte i el cos diuen de quin compte es tracta, encara que s'escrigui des d'un altre correu.
  const contactUrl = (to: string, email: string | null) => {
    const subject = encodeURIComponent(t('accountBlocked.contactSubject'));
    const body = email
      ? `&body=${encodeURIComponent(t('accountBlocked.contactBody', { account: email }))}`
      : '';
    return `mailto:${to}?subject=${subject}${body}`;
  };

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
    contact: team
      ? {
          label: t('accountBlocked.contact', { email: team }),
          // Sense app de correu, `mailto:` falla: es diu, i l'avís deixa seleccionar l'adreça.
          open: () => {
            setContactFailed(false);
            Linking.openURL(contactUrl(team, account)).catch(() => setContactFailed(true));
          },
          error: contactFailed ? t('accountBlocked.contactError', { email: team }) : null,
        }
      : null,
  };
}

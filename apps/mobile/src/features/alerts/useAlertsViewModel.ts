import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';

export type PushNotice = {
  message: string;
  action?: { label: string; onPress: () => void };
};

/**
 * Pestanya d'alertes. La llista amb l'interruptor arriba amb TG-148 (mockup 10).
 *
 * HU17, criteri 4: sense permís de notificacions, l'app continua igual i la pantalla d'alertes
 * ho diu. «No demanat» no es mostra: el permís es demana en crear una alerta (TG-148).
 */
export function useAlertsViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const { permission } = usePushPermission();

  let pushNotice: PushNotice | null = null;
  if (permission === 'denied') {
    pushNotice = {
      message: t('alerts.pushDenied'),
      action: { label: t('alerts.openSettings'), onPress: () => void Linking.openSettings() },
    };
  } else if (permission === 'unavailable') {
    pushNotice = { message: t('alerts.pushUnavailable') };
  }

  return {
    title: t('alerts.title'),
    soonTitle: t('alerts.soonTitle'),
    soonMessage: t('alerts.soonMessage'),
    create: { label: t('alerts.create'), onPress: () => router.push('/nova-alerta') },
    pushNotice,
  };
}

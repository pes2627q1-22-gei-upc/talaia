import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';

export type PushNotice = {
  message: string;
  action?: { label: string; onPress: () => void };
};

/**
 * HU17, criteri 4: sense permís de notificacions, l'app continua igual i la pantalla d'alertes
 * ho diu. «No demanat» no es mostra: el permís es demana en crear una alerta (TG-148).
 */
export function useAlertsViewModel(): { pushNotice: PushNotice | null } {
  const { t } = useTranslation();
  const { permission } = usePushPermission();

  if (permission === 'denied') {
    return {
      pushNotice: {
        message: t('alerts.pushDenied'),
        action: { label: t('alerts.openSettings'), onPress: () => void Linking.openSettings() },
      },
    };
  }
  if (permission === 'unavailable') return { pushNotice: { message: t('alerts.pushUnavailable') } };
  return { pushNotice: null };
}

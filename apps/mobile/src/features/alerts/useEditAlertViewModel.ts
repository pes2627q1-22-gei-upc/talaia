import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAlertsQuery } from './alertsRepository';

/**
 * «Edita l'alerta» (HU18): busca l'alerta a la llista de l'usuari, que ja és a la memòria cau quan
 * s'hi arriba des de la pestanya Alertes. L'API no té `GET /alertes/{id}` i no cal.
 */
export function useEditAlertViewModel(alertId: string) {
  const { t } = useTranslation();
  const router = useRouter();
  const alerts = useAlertsQuery();
  const alert = alerts.data?.find((item) => item.id === alertId);

  const state = alert
    ? ('ready' as const)
    : alerts.isPending
      ? ('loading' as const)
      : alerts.isError
        ? ('error' as const)
        : ('missing' as const);

  return {
    state,
    alert,
    title: t('alerts.edit.title'),
    error: {
      title: t('alerts.errorTitle'),
      action: { label: t('alerts.retry'), onPress: () => void alerts.refetch() },
    },
    missing: {
      title: t('alerts.edit.missingTitle'),
      message: t('alerts.edit.missingMessage'),
      action: { label: t('alerts.new.back'), onPress: () => router.back() },
    },
  };
}

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

/** Pestanya d'alertes. La llista amb l'interruptor arriba amb TG-148 (mockup 10). */
export function useAlertsViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  return {
    title: t('alerts.title'),
    soonTitle: t('alerts.soonTitle'),
    soonMessage: t('alerts.soonMessage'),
    create: { label: t('alerts.create'), onPress: () => router.push('/nova-alerta') },
  };
}

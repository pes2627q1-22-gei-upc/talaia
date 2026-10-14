import { useTranslation } from 'react-i18next';

import { Screen } from '@/shared/ui/Screen';
import { StateMessage } from '@/shared/ui/StateMessage';

/** Pestanya d'alertes (mockups 10 i 11): arriba en un altre sprint. */
export function AlertsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('alerts.title')}>
      <StateMessage title={t('alerts.soonTitle')} message={t('alerts.soonMessage')} />
    </Screen>
  );
}

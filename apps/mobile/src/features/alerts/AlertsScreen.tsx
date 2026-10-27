import { useTranslation } from 'react-i18next';

import { colors } from '@/core/theme/tokens';
import { Screen } from '@/shared/ui/Screen';
import { StateMessage } from '@/shared/ui/StateMessage';

const bellIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.pedra}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`,
  )}`,
};

/** Pestanya d'alertes (mockups 10 i 11): arriba en un altre sprint. */
export function AlertsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('alerts.title')}>
      <StateMessage
        icon={bellIcon}
        fill
        title={t('alerts.soonTitle')}
        message={t('alerts.soonMessage')}
      />
    </Screen>
  );
}

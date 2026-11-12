import { colors } from '@/core/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useAlertsViewModel } from './useAlertsViewModel';

const bellIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.pedra}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`,
  )}`,
};

/** Pestanya d'alertes: de moment, només el camí a «Nova alerta» (la llista és TG-148). */
export function AlertsScreen() {
  const vm = useAlertsViewModel();
  return (
    <Screen title={vm.title}>
      <StateMessage icon={bellIcon} fill title={vm.soonTitle} message={vm.soonMessage} />
      <Button label={vm.create.label} onPress={vm.create.onPress} haptic />
    </Screen>
  );
}

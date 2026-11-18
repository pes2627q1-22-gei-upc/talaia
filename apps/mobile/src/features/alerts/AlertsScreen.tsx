import { StyleSheet } from 'react-native';

import { colors, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Screen } from '@/shared/ui/Screen';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useAlertsViewModel } from './useAlertsViewModel';

const bellIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.pedra}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`,
  )}`,
};

/** Pestanya d'alertes: l'avís de notificacions i el camí a «Nova alerta» (la llista és TG-148). */
export function AlertsScreen() {
  const vm = useAlertsViewModel();
  return (
    <Screen title={vm.title}>
      {vm.pushNotice ? (
        <Card style={styles.notice}>
          <AppText variant="small" color="boira">
            {vm.pushNotice.message}
          </AppText>
          {vm.pushNotice.action ? (
            <Button
              variant="text"
              label={vm.pushNotice.action.label}
              onPress={vm.pushNotice.action.onPress}
            />
          ) : null}
        </Card>
      ) : null}
      <StateMessage icon={bellIcon} fill title={vm.soonTitle} message={vm.soonMessage} />
      <Button label={vm.create.label} onPress={vm.create.onPress} haptic />
    </Screen>
  );
}

const styles = StyleSheet.create({ notice: { gap: spacing.sm } });

import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { NewAlertScreen } from './NewAlertScreen';
import { useEditAlertViewModel } from './useEditAlertViewModel';

const SKELETON_BLOCKS = [120, 96, 160];

/** «Edita l'alerta» (HU18): la pantalla de «Nova alerta» amb els valors de l'alerta desada. */
export function EditAlertScreen({ alertId }: { alertId: string }) {
  const vm = useEditAlertViewModel(alertId);
  if (vm.alert) return <NewAlertScreen alert={vm.alert} />;

  return (
    <Screen title={vm.title}>
      {vm.state === 'loading' ? (
        <View style={styles.loading} testID="edit-alert-loading">
          {SKELETON_BLOCKS.map((height, index) => (
            <Skeleton key={index} height={height} radius="md" />
          ))}
        </View>
      ) : vm.state === 'error' ? (
        <StateMessage fill title={vm.error.title} action={vm.error.action} />
      ) : (
        <StateMessage
          fill
          title={vm.missing.title}
          message={vm.missing.message}
          action={vm.missing.action}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { gap: spacing.ms },
});

import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';

import { useEmailLinkViewModel } from './useEmailLinkViewModel';

/** S'obre des de l'enllaç del correu: entra a l'app o explica per què no ha pogut. */
export function EmailLinkScreen() {
  const vm = useEmailLinkViewModel();
  return (
    <Screen title={vm.title} subtitle={vm.subtitle}>
      {vm.failed ? (
        <Button label={vm.backLabel} onPress={vm.back} />
      ) : (
        <View testID="email-link-loading" style={styles.loading}>
          <Skeleton height={54} radius="md" />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { gap: spacing.md },
});

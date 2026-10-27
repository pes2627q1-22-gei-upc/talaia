import { StyleSheet, View } from 'react-native';

import { type ColorToken, colors, radii, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

import { type ApiStatus, useApiStatusViewModel } from './useApiStatusViewModel';

const statusColor: Record<ApiStatus, ColorToken> = {
  loading: 'boira',
  ok: 'ras',
  error: 'tap',
};

/** View de l'indicador d'estat de l'API: només pinta el que li dona el ViewModel. */
export function ApiStatusCard() {
  const vm = useApiStatusViewModel();
  return (
    <Card style={styles.card}>
      <View
        style={[styles.dot, { backgroundColor: colors[statusColor[vm.status]] }]}
        accessibilityLiveRegion="polite"
      />
      <View style={styles.texts}>
        <AppText variant="label">{vm.title}</AppText>
        <AppText variant="small" color="boira">
          {vm.message}
        </AppText>
      </View>
      {vm.canRetry ? <Button variant="text" label={vm.retryLabel} onPress={vm.retry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radii.pill },
  texts: { flex: 1, gap: spacing.xs },
});

import { StyleSheet, View } from 'react-native';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';

import type { useExploreViewModel } from './useExploreViewModel';

type TimeRangeSheetProps = ReturnType<typeof useExploreViewModel>['rangeSheet'];

function StepButton({
  symbol,
  label,
  onPress,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic="selection"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.step}
    >
      <AppText variant="heading">{symbol}</AppText>
    </PressableScale>
  );
}

/** Full per triar la franja horària: inici i final d'hora en hora; pot passar de mitjanit. */
export function TimeRangeSheet({
  visible,
  title,
  rows,
  duration,
  doneLabel,
  onClose,
}: TimeRangeSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={doneLabel}>
      {rows.map((row) => (
        <View key={row.end} style={styles.row}>
          <AppText variant="body" color="boira" style={styles.label}>
            {row.label}
          </AppText>
          <StepButton
            symbol="−"
            label={`${row.label}: ${row.earlierLabel}`}
            onPress={row.onEarlier}
          />
          <AppText
            variant="indexMd"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${row.label} ${row.value}`}
            style={styles.value}
          >
            {row.value}
          </AppText>
          <StepButton symbol="+" label={`${row.label}: ${row.laterLabel}`} onPress={row.onLater} />
        </View>
      ))}
      <AppText variant="small" color="boira">
        {duration}
      </AppText>
      <Button label={doneLabel} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  label: { flex: 1 },
  value: { minWidth: 104, textAlign: 'center' },
  step: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
});

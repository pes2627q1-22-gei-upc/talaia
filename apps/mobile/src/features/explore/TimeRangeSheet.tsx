import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';
import { WHEEL_HEIGHT, WHEEL_ITEM, WheelPicker } from '@/shared/ui/WheelPicker';

import type { useExploreViewModel } from './useExploreViewModel';

type TimeRangeSheetProps = ReturnType<typeof useExploreViewModel>['rangeSheet'];

/** Amplada de la fletxa entre les dues rodes. */
const ARROW = 32;

/**
 * Full de la franja horària: dues rodes d'hores (des de, fins a) amb una sola banda, com les de
 * l'alarma d'iOS. La franja pot passar de mitjanit.
 */
export function TimeRangeSheet({
  visible,
  title,
  hours,
  format,
  wheels,
  duration,
  doneLabel,
  onClose,
}: TimeRangeSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={doneLabel}>
      <View style={styles.row}>
        {wheels.map((wheel, index) => (
          <View key={wheel.end} style={styles.labelCell}>
            {index > 0 ? <View style={styles.arrowSpace} /> : null}
            <AppText variant="tag" color="boira" style={styles.label}>
              {wheel.label}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <View pointerEvents="none" style={styles.band} />
        {wheels.map((wheel, index) => (
          <View key={wheel.end} style={styles.wheelCell}>
            {index > 0 ? (
              <AppText variant="title" color="boira" style={styles.arrow}>
                →
              </AppText>
            ) : null}
            <WheelPicker
              testID={`wheel-${wheel.end}`}
              values={hours}
              value={wheel.value}
              onChange={wheel.onChange}
              format={format}
              accessibilityLabel={wheel.label}
              band={false}
            />
          </View>
        ))}
      </View>
      <AppText variant="small" color="boira" style={styles.duration}>
        {duration}
      </AppText>
      <Button label={doneLabel} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  labelCell: { flex: 1, flexDirection: 'row' },
  arrowSpace: { width: ARROW },
  label: { flex: 1, textAlign: 'center', textTransform: 'uppercase' },
  wheelCell: { flex: 1, flexDirection: 'row', alignItems: 'center', height: WHEEL_HEIGHT },
  arrow: { width: ARROW, textAlign: 'center' },
  band: {
    position: 'absolute',
    top: WHEEL_ITEM * 2,
    right: 0,
    left: 0,
    height: WHEEL_ITEM,
    borderRadius: radii.field,
    backgroundColor: colors.crep,
  },
  duration: { textAlign: 'center' },
});

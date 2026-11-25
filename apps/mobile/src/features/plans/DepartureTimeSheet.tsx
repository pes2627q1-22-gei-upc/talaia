import { View } from 'react-native';

import { makeStyles } from '@/core/theme/theme';
import { radii, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';
import { WHEEL_HEIGHT, WHEEL_ITEM, WheelPicker } from '@/shared/ui/WheelPicker';

import type { usePlanFormFields } from './usePlanFormFields';

type DepartureTimeSheetProps = ReturnType<typeof usePlanFormFields>['timeSheet'];

/** Amplada dels dos punts entre les rodes. */
const SEPARATOR = 24;

const pad = (value: number) => String(value).padStart(2, '0');

/** «Hora de sortida»: una roda d'hores i una de minuts amb una sola banda, com l'alarma d'iOS. */
export function DepartureTimeSheet({
  visible,
  title,
  doneLabel,
  hourLabel,
  minuteLabel,
  hours,
  minutes,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onClose,
}: DepartureTimeSheetProps) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={doneLabel}>
      <View style={styles.row}>
        <View pointerEvents="none" style={styles.band} />
        <View style={styles.wheel}>
          <WheelPicker
            testID="wheel-hour"
            values={hours}
            value={hour}
            onChange={onHourChange}
            format={pad}
            accessibilityLabel={hourLabel}
            band={false}
          />
        </View>
        <AppText variant="title" style={styles.separator}>
          :
        </AppText>
        <View style={styles.wheel}>
          <WheelPicker
            testID="wheel-minute"
            values={minutes}
            value={minute}
            onChange={onMinuteChange}
            format={pad}
            accessibilityLabel={minuteLabel}
            band={false}
          />
        </View>
      </View>
      <Button label={doneLabel} onPress={onClose} />
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WHEEL_HEIGHT,
    paddingHorizontal: spacing.xl,
  },
  wheel: { flex: 1 },
  separator: { width: SEPARATOR, textAlign: 'center' },
  band: {
    position: 'absolute',
    top: WHEEL_ITEM * 2,
    right: 0,
    left: 0,
    height: WHEEL_ITEM,
    borderRadius: radii.field,
    backgroundColor: colors.crep,
  },
}));

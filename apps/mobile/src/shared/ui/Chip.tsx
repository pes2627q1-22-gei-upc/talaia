import { StyleSheet } from 'react-native';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

// El xip fa 34 d'alçada: el que falta fins a 44 es compensa amb hitSlop.
const hitSlop = (sizes.touch - sizes.chip) / 2;

/** Xip de filtre (fenomen, tipus, idioma). */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityState={{ selected }}
      hitSlop={{ top: hitSlop, bottom: hitSlop }}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText variant="chip" color={selected ? 'nit' : 'lluna'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: sizes.chip,
    justifyContent: 'center',
    paddingHorizontal: spacing.ms,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.far, borderColor: colors.far },
});

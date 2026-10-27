import type { PropsWithChildren } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/core/theme/tokens';

import { PressableScale } from './PressableScale';

type CardProps = PropsWithChildren<{
  /** Si n'hi ha, la targeta es pot prémer. */
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}>;

/** Superfície de targeta (punts, resultats, fenòmens). La seleccionada s'aixeca amb `vel`. */
export function Card({
  onPress,
  selected = false,
  accessibilityLabel,
  style,
  children,
}: CardProps) {
  const cardStyle = [styles.card, selected && styles.selected, style];
  if (!onPress) {
    return (
      <View style={cardStyle} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={cardStyle}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.vel, borderColor: colors.vora },
});

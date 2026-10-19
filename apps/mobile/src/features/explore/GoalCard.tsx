import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radii, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

type GoalCardProps = {
  label: string;
  /** `require()` d'un SVG de `assets/images/explora`. */
  icon: number;
  selected: boolean;
  onPress: () => void;
  /** Targeta ampla (Constel·lacions): icona, títol i subtítol en fila, i una etiqueta a la dreta. */
  hint?: string;
  badge?: string;
};

/** Mides del Figma (mockup 02). */
const ICON = 26;
const GRID_HEIGHT = 81;

/** Un fenomen de «Què vols veure?». El triat s'omple de `far` amb una fosa curta. */
export function GoalCard({ label, icon, selected, onPress, hint, badge }: GoalCardProps) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(selected ? 1 : 0);
  const wide = hint !== undefined;

  useEffect(() => {
    const target = selected ? 1 : 0;
    fill.set(reduceMotion ? target : withTiming(target, { duration: motion.fast }));
  }, [selected, reduceMotion, fill]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.get() }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ selected }}
      style={[styles.card, wide ? styles.wide : styles.grid, selected && styles.selected]}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
      <Image
        source={icon}
        tintColor={selected ? colors.nit : colors.pedra}
        style={styles.icon}
        accessible={false}
      />
      {wide ? (
        <>
          <View style={styles.wideText}>
            <AppText variant="link" color={selected ? 'nit' : 'lluna'}>
              {label}
            </AppText>
            <AppText variant="caption" color={selected ? 'nit' : 'boira'}>
              {hint}
            </AppText>
          </View>
          {badge ? (
            <View style={styles.badge}>
              <AppText variant="overline" color="far">
                {badge}
              </AppText>
            </View>
          ) : null}
        </>
      ) : (
        <AppText variant="link" color={selected ? 'nit' : 'lluna'}>
          {label}
        </AppText>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  grid: {
    flex: 1,
    height: GRID_HEIGHT,
    padding: spacing.ms,
    justifyContent: 'space-between',
  },
  wide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.ms - 2,
  },
  selected: { borderColor: colors.far },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.far,
  },
  icon: { width: ICON, height: ICON },
  wideText: { flex: 1, gap: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm - 2,
    backgroundColor: `${colors.far}26`,
  },
});

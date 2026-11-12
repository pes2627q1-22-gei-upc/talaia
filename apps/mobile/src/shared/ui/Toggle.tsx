import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radii, sizes } from '@/core/theme/tokens';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

/** Mides del Figma (mockup 10): pista de 52 × 32 i control de 26 amb 3 de marge. */
const WIDTH = 52;
const HEIGHT = 32;
const KNOB = 26;
const INSET = (HEIGHT - KNOB) / 2;
const TRAVEL = WIDTH - KNOB - INSET * 2;

/**
 * Interruptor del design system (TG-148): pista `crep` que s'omple de `ras` amb una fosa i control
 * `lluna` que llisca amb el spring de `motion.spring`. Tic de selecció en canviar.
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
  testID,
}: ToggleProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    progress.set(
      reduceMotion
        ? withTiming(target, { duration: motion.fast })
        : withSpring(target, { ...motion.spring, overshootClamping: true }),
    );
  }, [value, reduceMotion, progress]);

  const fill = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * TRAVEL }],
    opacity: 0.6 + progress.get() * 0.4,
  }));

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        void Haptics.selectionAsync();
        onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={(sizes.touch - HEIGHT) / 2}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, fill]} />
      <Animated.View style={[styles.knob, knob]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.crep,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: colors.ras },
  knob: {
    position: 'absolute',
    left: INSET,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.lluna,
  },
});

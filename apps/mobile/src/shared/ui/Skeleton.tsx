import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radii } from '@/core/theme/tokens';

type SkeletonProps = {
  height: number;
  width?: DimensionValue;
  radius?: keyof typeof radii;
};

/** Esquelet de càrrega: ocupa el mateix espai que el contingut i batega en opacitat. */
export function Skeleton({ height, width = '100%', radius = 'sm' }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.5, { duration: 2 * motion.slow }), -1, true));
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { height, width, borderRadius: radii[radius], backgroundColor: colors.crep },
        animatedStyle,
      ]}
    />
  );
}

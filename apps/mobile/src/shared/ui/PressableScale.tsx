import * as Haptics from 'expo-haptics';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/core/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /**
   * Vibració en prémer. `true`: un cop lleu, per a les accions clau (desar, activar una alerta…).
   * `'selection'`: el tic de seleccionar, per a xips i controls segmentats.
   */
  haptic?: boolean | 'selection';
};

/**
 * Base de tot el que es pot prémer: s'enfonsa a `motion.press.scale` de seguida i torna amb un
 * spring, tot al fil de la interfície.
 */
export function PressableScale({
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  style,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={(event: GestureResponderEvent) => {
        if (!reduceMotion) {
          scale.set(
            withTiming(motion.press.scale, { duration: motion.press.in, easing: motion.enter }),
          );
        }
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        if (!reduceMotion) scale.set(withSpring(1, motion.press.release));
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic === 'selection') void Haptics.selectionAsync();
        else if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
}

import * as Haptics from 'expo-haptics';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/core/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Vibració lleu en prémer: només per a les accions clau (desar, activar una alerta…). */
  haptic?: boolean;
};

/** Base de tot el que es pot prémer: s'encongeix a `motion.pressedScale` al fil de la interfície. */
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

  const animateTo = (value: number) => {
    if (reduceMotion) return;
    scale.set(withTiming(value, { duration: motion.fast, easing: motion.enter }));
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={(event: GestureResponderEvent) => {
        animateTo(motion.pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
}

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radii, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type SegmentedControlProps = {
  options: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

/** Mides del Figma (mockup 02): opcions de 38 dins un marc de 48. */
const SEGMENT_HEIGHT = 38;
const INSET = spacing.xs;

/** Control segmentat: la peça triada llisca darrere el text, sense rebot. */
export function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - INSET * (options.length + 1)) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = selectedIndex * (segment + INSET);
    if (reduceMotion || segment === 0) x.set(target);
    else x.set(withTiming(target, { duration: motion.base, easing: motion.enter }));
  }, [selectedIndex, segment, reduceMotion, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 2)}
    >
      {segment > 0 ? (
        <Animated.View style={[styles.indicator, { width: segment }, indicator]} />
      ) : null}
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <PressableScale
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            haptic="selection"
            onPress={() => {
              if (!selected) onChange(index);
            }}
            style={styles.segment}
          >
            <AppText variant="chip" color={selected ? 'lluna' : 'boira'}>
              {option}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: INSET,
    padding: INSET,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  indicator: {
    position: 'absolute',
    top: INSET,
    left: INSET,
    height: SEGMENT_HEIGHT,
    borderRadius: radii.sm,
    backgroundColor: colors.crep,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

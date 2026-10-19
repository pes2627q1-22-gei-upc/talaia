import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, motion, radii } from '@/core/theme/tokens';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** El valor com es llegeix en veu alta, p. ex. «2 h 30 min en cotxe». */
  accessibilityValueText: string;
  /** Base dels identificadors dels gestos als tests (`<testID>-pan`, `<testID>-tap`). */
  testID?: string;
};

/** Mides del Figma (mockup 02): pista de 6 amb 4 de marge, control de 24 dins una franja de 28. */
const HEIGHT = 28;
const TRACK = 6;
const EDGE = 4;
const THUMB = 24;

function snap(fraction: number, min: number, max: number, step: number) {
  'worklet';
  const clamped = Math.min(1, Math.max(0, fraction));
  return min + Math.round((clamped * (max - min)) / step) * step;
}

/**
 * Barra lliscant del design system. El control segueix el dit al fil de la interfície; el valor
 * avança per passos (`step`), amb un tic de vibració a cada pas, i en deixar-lo s'hi ajusta.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  accessibilityValueText,
  testID = 'slider',
}: SliderProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const track = Math.max(0, width - EDGE * 2);
  const fraction = useSharedValue((value - min) / (max - min));
  const dragging = useSharedValue(false);
  const lastValue = useSharedValue(value);

  // Si el valor canvia des de fora (lector de pantalla, ViewModel), el control hi va.
  useEffect(() => {
    lastValue.set(value);
    if (dragging.get()) return;
    const target = (value - min) / (max - min);
    fraction.set(reduceMotion ? target : withTiming(target, { duration: motion.fast }));
  }, [value, min, max, reduceMotion, fraction, dragging, lastValue]);

  const emit = (next: number) => {
    void Haptics.selectionAsync();
    onChange(next);
  };

  const moveTo = (x: number) => {
    'worklet';
    if (track === 0) return;
    fraction.set(Math.min(1, Math.max(0, (x - EDGE) / track)));
    const next = snap(fraction.get(), min, max, step);
    if (next !== lastValue.get()) {
      lastValue.set(next);
      scheduleOnRN(emit, next);
    }
  };

  const settle = () => {
    'worklet';
    dragging.set(false);
    const target = (lastValue.get() - min) / (max - min);
    fraction.set(withTiming(target, { duration: motion.fast, easing: motion.enter }));
  };

  // El desplaçament vertical és del ScrollView: la barra només s'activa amb un moviment horitzontal.
  const pan = Gesture.Pan()
    .withTestId(`${testID}-pan`)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart(() => dragging.set(true))
    .onUpdate((event) => moveTo(event.x))
    .onFinalize(settle);
  const tap = Gesture.Tap()
    .withTestId(`${testID}-tap`)
    .onEnd((event) => {
      moveTo(event.x);
      settle();
    });

  const fill = useAnimatedStyle(() => ({
    transform: [{ translateX: (fraction.get() - 1) * track }],
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: fraction.get() * track }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View
        accessible
        testID={testID}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: accessibilityValueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
          const next = Math.min(max, Math.max(min, value + delta));
          if (next !== value) emit(next);
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.container}
      >
        <View style={[styles.track, { width: track }]}>
          <Animated.View style={[styles.fill, fill]} />
        </View>
        <Animated.View style={[styles.thumb, thumb]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { height: HEIGHT, justifyContent: 'center' },
  track: {
    height: TRACK,
    marginLeft: EDGE,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.crep,
  },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.far },
  thumb: {
    position: 'absolute',
    left: EDGE - THUMB / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.lluna,
    shadowColor: colors.nit,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});

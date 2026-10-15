import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, radii } from '@/core/theme/tokens';

import { AppText } from './AppText';

type WheelPickerProps = {
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  accessibilityLabel: string;
  /** Sense banda pròpia: quan diverses rodes comparteixen la mateixa (com l'alarma d'iOS). */
  band?: boolean;
  testID?: string;
};

/** Files de 48 i cinc de visibles, com les rodes de l'alarma d'iOS. */
export const WHEEL_ITEM = 48;
const VISIBLE = 5;
export const WHEEL_HEIGHT = WHEEL_ITEM * VISIBLE;
/** La llista es repeteix perquè la roda doni la volta; es comença a la còpia del mig. */
const REPEAT = 41;
const CENTER = Math.floor(REPEAT / 2);

const WheelItem = memo(function WheelItem({
  index,
  label,
  y,
}: {
  index: number;
  label: string;
  y: SharedValue<number>;
}) {
  // Cada fila gira com si fos sobre un cilindre: com més lluny del centre, més inclinada i fosa.
  const style = useAnimatedStyle(() => {
    const offset = Math.max(-3, Math.min(3, (index * WHEEL_ITEM - y.get()) / WHEEL_ITEM));
    return {
      opacity: 1 - Math.min(0.85, Math.abs(offset) * 0.3),
      transform: [
        { perspective: 500 },
        { rotateX: `${-offset * 22}deg` },
        { scale: 1 - Math.min(0.25, Math.abs(offset) * 0.07) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, style]}>
      <AppText variant="indexMd">{label}</AppText>
    </Animated.View>
  );
});

/** Roda per triar un valor, a l'estil de l'alarma d'iOS: gira en cilindre i dona la volta. */
export function WheelPicker({
  values,
  value,
  onChange,
  format,
  accessibilityLabel,
  band = true,
  testID,
}: WheelPickerProps) {
  const count = values.length;
  const indexOf = (v: number) => CENTER * count + Math.max(0, values.indexOf(v));
  const data = Array.from({ length: count * REPEAT }, (_, i) => values[i % count] ?? 0);

  const list = useAnimatedRef<Animated.FlatList<number>>();
  const [initialIndex] = useState(() => indexOf(value));
  /** Fila on s'ha aturat la roda (no fa falta tornar a pintar quan canvia). */
  const current = useRef(initialIndex);
  const y = useSharedValue(initialIndex * WHEEL_ITEM);
  const tickAt = useSharedValue(initialIndex);
  const dragging = useSharedValue(false);

  const tick = () => void Haptics.selectionAsync();
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => dragging.set(true),
    onScroll: (event) => {
      y.set(event.contentOffset.y);
      const at = Math.round(event.contentOffset.y / WHEEL_ITEM);
      if (at !== tickAt.get()) {
        tickAt.set(at);
        if (dragging.get()) scheduleOnRN(tick);
      }
    },
    onMomentumEnd: () => dragging.set(false),
  });

  const settle = (offsetY: number) => {
    const at = Math.max(0, Math.min(data.length - 1, Math.round(offsetY / WHEEL_ITEM)));
    // Si s'acosta a una punta de la llista, torna a la còpia del mig sense que es noti.
    const recentered = CENTER * count + (at % count);
    if (Math.abs(at - recentered) > count * 5) {
      list.current?.scrollToOffset({ offset: recentered * WHEEL_ITEM, animated: false });
      current.current = recentered;
    } else {
      current.current = at;
    }
    const next = data[at];
    if (next !== undefined && next !== value) onChange(next);
  };

  // Si el valor canvia des de fora (lector de pantalla, ViewModel), la roda hi gira pel camí curt.
  useEffect(() => {
    if (data[current.current] === value) return;
    const base = current.current - (current.current % count) + Math.max(0, values.indexOf(value));
    const target = [base - count, base, base + count].reduce((best, candidate) =>
      Math.abs(candidate - current.current) < Math.abs(best - current.current) ? candidate : best,
    );
    current.current = target;
    list.current?.scrollToOffset({ offset: target * WHEEL_ITEM, animated: true });
  }, [value, values, count, data, list]);

  const step = (delta: number) => {
    const at = values.indexOf(value);
    const next = values[(at + delta + count) % count];
    if (next !== undefined) onChange(next);
  };

  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    settle(event.nativeEvent.contentOffset.y);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.wheel}
    >
      {band ? <View pointerEvents="none" style={styles.band} /> : null}
      <Animated.FlatList
        ref={list}
        testID={testID}
        data={data}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item, index }) => <WheelItem index={index} label={format(item)} y={y} />}
        getItemLayout={(_, index) => ({ length: WHEEL_ITEM, offset: WHEEL_ITEM * index, index })}
        initialScrollIndex={initialIndex}
        initialNumToRender={VISIBLE + 4}
        windowSize={3}
        maxToRenderPerBatch={VISIBLE * 2}
        snapToInterval={WHEEL_ITEM}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollEndDrag={(event) => {
          if (!event.nativeEvent.velocity?.y) onEnd(event);
        }}
        onMomentumScrollEnd={onEnd}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[colors.sheet, `${colors.sheet}00`]}
        style={[styles.fade, styles.top]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.sheet}00`, colors.sheet]}
        style={[styles.fade, styles.bottom]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { height: WHEEL_HEIGHT, flex: 1, overflow: 'hidden' },
  content: { paddingVertical: WHEEL_ITEM * 2 },
  item: { height: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center' },
  band: {
    position: 'absolute',
    top: WHEEL_ITEM * 2,
    right: 0,
    left: 0,
    height: WHEEL_ITEM,
    borderRadius: radii.field,
    backgroundColor: colors.crep,
  },
  fade: { position: 'absolute', right: 0, left: 0, height: WHEEL_ITEM * 1.6 },
  top: { top: 0 },
  bottom: { bottom: 0 },
});

import { useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, sizes, spacing } from '@/core/theme/tokens';

/** Dos punts d’aturada; el moviment segueix el dit sense renders de React a cada fotograma. */
export function useRankingSheetMotion(
  collapsed: boolean,
  setCollapsed: (collapsed: boolean) => void,
) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const travel = useSharedValue(0);
  // Nansa compacta: 4 pt a dalt + 20 pt de franja + 8 pt a baix.
  // L’àrea segura inferior del contingut no s’afegeix a la franja plegada.
  const peekHeight = spacing.xs + sizes.touch - spacing.ms * 2 + spacing.sm;

  useEffect(() => {
    const target = collapsed ? travel.get() : 0;
    offset.set(
      reduceMotion ? target : withSpring(target, { ...motion.spring, overshootClamping: true }),
    );
  }, [collapsed, reduceMotion, offset, travel]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.max(0, event.nativeEvent.layout.height - peekHeight);
    // Una rotació o una resposta nova pot canviar l’alçada del full.
    travel.set(next);
    offset.set(collapsed ? next : 0);
  };

  const pan = Gesture.Pan()
    .withTestId('ranking-sheet-pan')
    .activeOffsetY([-spacing.sm, spacing.sm])
    .failOffsetX([-spacing.md, spacing.md])
    .onStart(() => {
      cancelAnimation(offset);
      start.set(offset.get());
    })
    .onUpdate((event) => {
      offset.set(Math.max(0, Math.min(travel.get(), start.get() + event.translationY)));
    })
    .onEnd((event, success) => {
      if (!success || travel.get() <= 0) return;
      // La projecció de velocitat permet un gest curt i ràpid; un arrossegament lent
      // s’ajusta al punt d’aturada més proper.
      const next = offset.get() + event.velocityY * 0.15 > travel.get() / 2;
      const target = next ? travel.get() : 0;
      offset.set(
        reduceMotion ? target : withSpring(target, { ...motion.spring, overshootClamping: true }),
      );
      scheduleOnRN(setCollapsed, next);
    })
    .onFinalize((_event, success) => {
      if (success) return;
      const target = collapsed ? travel.get() : 0;
      offset.set(
        reduceMotion ? target : withSpring(target, { ...motion.spring, overshootClamping: true }),
      );
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: travel.get() > 0 ? 1 - offset.get() / travel.get() : 1,
  }));
  return { pan, onLayout, panelStyle, contentStyle };
}

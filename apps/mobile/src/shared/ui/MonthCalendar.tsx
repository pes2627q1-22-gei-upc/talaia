import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight, ZoomIn } from 'react-native-reanimated';

import { colors, motion, sizes, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { type CalendarMonth, monthIndex, monthOf, monthWeeks, shiftMonth } from './calendarGrid';
import { PressableScale } from './PressableScale';

type MonthCalendarProps = {
  /** Dia triat (`YYYY-MM-DD`). */
  value: string;
  /** Avui, per marcar-lo en `far`. */
  today: string;
  min: string;
  max: string;
  onChange: (date: string) => void;
  /** 1: la setmana comença en dilluns (ca, es); 0: en diumenge (en). */
  firstDay: 0 | 1;
  /** Inicials dels dies, començant per diumenge. */
  weekdayNames: readonly string[];
  /** Títol del mes, p. ex. «octubre de 2026». */
  formatTitle: (month: CalendarMonth) => string;
  /** Com es llegeix un dia en veu alta, p. ex. «16 d'octubre». */
  dayLabel: (date: string) => string;
  previousLabel: string;
  nextLabel: string;
};

/** Mida del cercle del dia triat dins la cel·la de 44. */
const DOT = 38;

/**
 * Calendari mensual a l'estil de l'inline d'iOS: es canvia de mes amb les fletxes o lliscant, i
 * el dia triat s'encén en un cercle `far` que apareix amb una molla.
 */
export function MonthCalendar({
  value,
  today,
  min,
  max,
  onChange,
  firstDay,
  weekdayNames,
  formatTitle,
  dayLabel,
  previousLabel,
  nextLabel,
}: MonthCalendarProps) {
  const [visible, setVisible] = useState(() => monthOf(value));
  const [direction, setDirection] = useState<-1 | 1>(1);
  const canGoBack = monthIndex(visible) > monthIndex(monthOf(min));
  const canGoForward = monthIndex(visible) < monthIndex(monthOf(max));

  const go = (delta: -1 | 1) => {
    if (delta < 0 ? !canGoBack : !canGoForward) return;
    void Haptics.selectionAsync();
    setDirection(delta);
    setVisible((current) => shiftMonth(current, delta));
  };

  const swipe = Gesture.Race(
    Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onEnd(() => go(1)),
    Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onEnd(() => go(-1)),
  );

  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayNames[(i + firstDay) % 7] ?? '');
  const weeks = monthWeeks(visible, { firstDay, min, max });
  const enter = (direction > 0 ? FadeInRight : FadeInLeft).duration(motion.base);

  return (
    <View>
      <View style={styles.header}>
        <AppText variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite">
          {formatTitle(visible)}
        </AppText>
        <View style={styles.arrows}>
          {(
            [
              [-1, '‹', previousLabel, canGoBack],
              [1, '›', nextLabel, canGoForward],
            ] as const
          ).map(([delta, symbol, label, enabled]) => (
            <PressableScale
              key={delta}
              accessibilityLabel={label}
              accessibilityState={{ disabled: !enabled }}
              disabled={!enabled}
              onPress={() => go(delta)}
              style={[styles.arrow, !enabled && styles.off]}
            >
              <AppText variant="title" color="far">
                {symbol}
              </AppText>
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        {weekdays.map((name, i) => (
          <AppText key={i} variant="tag" color="boira" style={styles.weekday}>
            {name}
          </AppText>
        ))}
      </View>

      <GestureDetector gesture={swipe}>
        <Animated.View key={monthIndex(visible)} entering={enter}>
          {weeks.map((week, w) => (
            <View key={w} style={styles.row}>
              {week.map((cell, d) => {
                if (!cell) return <View key={d} style={styles.cell} />;
                const selected = cell.date === value;
                return (
                  <PressableScale
                    key={cell.date}
                    haptic="selection"
                    disabled={cell.disabled}
                    accessibilityLabel={dayLabel(cell.date)}
                    accessibilityState={{ selected, disabled: cell.disabled }}
                    onPress={() => onChange(cell.date)}
                    style={styles.cell}
                  >
                    {selected ? (
                      <Animated.View
                        entering={ZoomIn.springify().damping(16).stiffness(220)}
                        style={styles.dot}
                      />
                    ) : null}
                    <AppText
                      variant={selected || cell.date === today ? 'label' : 'body'}
                      color={
                        selected
                          ? 'nit'
                          : cell.disabled
                            ? 'vora'
                            : cell.date === today
                              ? 'far'
                              : 'lluna'
                      }
                    >
                      {cell.day}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  arrows: { flexDirection: 'row', gap: spacing.xs },
  arrow: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.3 },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', textTransform: 'uppercase', marginBottom: spacing.xs },
  cell: { flex: 1, height: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.far,
  },
});

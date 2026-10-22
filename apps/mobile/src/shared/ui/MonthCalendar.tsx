import * as Haptics from 'expo-haptics';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { type ColorToken, colors, motion, radii, sizes, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { type CalendarMonth, monthIndex, monthOf, monthWeeks, shiftMonth } from './calendarGrid';
import { PressableScale } from './PressableScale';

type MonthCalendarProps = {
  /** Dia triat (`YYYY-MM-DD`). */
  value: string | null;
  /** Avui, per marcar-lo en `far`. */
  today: string;
  min?: string;
  max?: string;
  /** El calendari de fenòmens controla el mes visible per poder tornar a avui. */
  visibleMonth?: CalendarMonth;
  onMonthChange?: (month: CalendarMonth) => void;
  headerAction?: ReactNode;
  markersByDay?: ReadonlyMap<string, readonly ColorToken[]>;
  dimPastDays?: boolean;
  outlineToday?: boolean;
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
 * el dia triat s'encén en un cercle `far` amb una aparició breu.
 */
export function MonthCalendar({
  value,
  today,
  min = '0001-01-01',
  max = '9999-12-31',
  visibleMonth,
  onMonthChange,
  headerAction,
  markersByDay,
  dimPastDays = false,
  outlineToday = false,
  onChange,
  firstDay,
  weekdayNames,
  formatTitle,
  dayLabel,
  previousLabel,
  nextLabel,
}: MonthCalendarProps) {
  const [internalVisible, setInternalVisible] = useState(() => monthOf(value ?? today));
  const visible = visibleMonth ?? internalVisible;
  const [direction, setDirection] = useState<-1 | 1>(1);
  const canGoBack = monthIndex(visible) > monthIndex(monthOf(min));
  const canGoForward = monthIndex(visible) < monthIndex(monthOf(max));

  const go = (delta: -1 | 1) => {
    if (delta < 0 ? !canGoBack : !canGoForward) return;
    void Haptics.selectionAsync();
    setDirection(delta);
    const next = shiftMonth(visible, delta);
    if (visibleMonth) onMonthChange?.(next);
    else setInternalVisible(next);
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
        <AppText
          variant="heading"
          style={styles.monthTitle}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {formatTitle(visible)}
        </AppText>
        <View style={styles.headerActions}>
          {headerAction}
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
                const markers = markersByDay?.get(cell.date) ?? [];
                return (
                  <PressableScale
                    key={cell.date}
                    haptic="selection"
                    disabled={cell.disabled}
                    accessibilityLabel={dayLabel(cell.date)}
                    accessibilityState={{ selected, disabled: cell.disabled }}
                    onPress={() => onChange(cell.date)}
                    style={[styles.cell, markersByDay && styles.markerCell]}
                  >
                    <View style={styles.dayArea}>
                      {selected ? (
                        <Animated.View entering={FadeIn.duration(motion.fast)} style={styles.dot} />
                      ) : cell.date === today && outlineToday ? (
                        <View style={styles.todayOutline} accessible={false} />
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
                                : dimPastDays && cell.date < today
                                  ? 'vora'
                                  : 'lluna'
                        }
                      >
                        {cell.day}
                      </AppText>
                    </View>
                    {markersByDay ? (
                      <View style={styles.markers} accessible={false}>
                        {markers.map((color) => (
                          <View
                            key={color}
                            style={[
                              styles.marker,
                              {
                                backgroundColor: colors[color],
                                opacity: cell.date < today ? 0.55 : 1,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    ) : null}
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
  monthTitle: { flex: 1, minWidth: 0, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  arrows: { height: sizes.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
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
  markerCell: { height: sizes.touch + spacing.ms },
  dayArea: { width: '100%', height: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.far,
  },
  todayOutline: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.far,
  },
  markers: { height: spacing.ms, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  marker: {
    width: spacing.xs + spacing.xs / 2,
    height: spacing.xs + spacing.xs / 2,
    borderRadius: radii.pill,
  },
});

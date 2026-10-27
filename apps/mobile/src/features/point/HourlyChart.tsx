import { memo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

import type { usePointDetailViewModel } from './usePointDetailViewModel';

type Props = Pick<
  ReturnType<typeof usePointDetailViewModel>,
  'hours' | 'hoursLabel' | 'timezoneLabel' | 'noHours'
> & {
  /** L'hora triada la porta `IndexBreakdown`, que en pinta els factors. */
  selectedHourId: string | null;
  onSelect: (hourId: string) => void;
};

export const HourlyChart = memo(function HourlyChart({
  hours,
  hoursLabel,
  timezoneLabel,
  noHours,
  selectedHourId,
  onSelect,
}: Props) {
  const hasBestWindow = hours.some((hour) => hour.isBest);
  // S'obre amb l'hora triada a la vista (la millor de la nit pot ser a la matinada, fora de la
  // pantalla), amb un parell de columnes abans perquè es vegi d'on ve.
  const initialScrollIndex = Math.max(0, hours.findIndex((hour) => hour.id === selectedHourId) - 2);

  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {hoursLabel}
      </AppText>
      <AppText variant="caption" color="boira">
        {timezoneLabel}
      </AppText>
      {hours.length ? (
        <FlatList
          horizontal
          data={hours}
          extraData={selectedHourId}
          keyExtractor={(hour) => hour.id}
          showsHorizontalScrollIndicator
          initialScrollIndex={initialScrollIndex}
          getItemLayout={(_, index) => ({
            length: sizes.hourlyColumn,
            offset: (sizes.hourlyColumn + spacing.xs) * index,
            index,
          })}
          style={styles.chartList}
          contentContainerStyle={styles.chart}
          renderItem={({ item }) => (
            <PressableScale
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ selected: item.id === selectedHourId }}
              haptic
              onPress={() => onSelect(item.id)}
              style={styles.hour}
            >
              <View
                testID={`hour-bar-${item.id}`}
                style={[
                  styles.barTrack,
                  hasBestWindow && !item.isBest && item.id !== selectedHourId && styles.barMuted,
                  item.id === selectedHourId && styles.barTrackSelected,
                ]}
              >
                <View
                  style={[
                    styles.bar,
                    {
                      height: item.value === 0 ? spacing.xs / 2 : `${item.value}%`,
                      backgroundColor: colors[item.level],
                    },
                  ]}
                />
                {item.id === selectedHourId ? (
                  <>
                    <View
                      testID="selected-hour-silhouette"
                      pointerEvents="none"
                      style={[styles.barSilhouette, { borderColor: colors[item.level] }]}
                    />
                    <View pointerEvents="none" style={styles.barIndex}>
                      <AppText
                        variant="heading"
                        color={item.value >= 75 ? 'nit' : item.level}
                        style={[
                          styles.barIndexValue,
                          item.value < 75 && styles.barIndexValueShadow,
                        ]}
                      >
                        {item.value}
                      </AppText>
                    </View>
                  </>
                ) : null}
              </View>
              <AppText variant="caption" color="boira">
                {item.label}
              </AppText>
            </PressableScale>
          )}
        />
      ) : (
        <AppText variant="small" color="boira">
          {noHours}
        </AppText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  chartList: { marginTop: -spacing.xs },
  chart: { gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  hour: { minWidth: sizes.hourlyColumn, alignItems: 'center', gap: spacing.xs },
  barMuted: { opacity: 0.38 },
  barTrack: {
    height: sizes.hourlyChart,
    width: sizes.hourlyColumn - spacing.sm,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barTrackSelected: { backgroundColor: colors.vel, borderRadius: spacing.xs },
  barSilhouette: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: spacing.xs,
  },
  barIndex: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barIndexValue: typography.hourlyIndex,
  barIndexValueShadow: {
    textShadowColor: colors.nit,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bar: { width: '100%', borderTopLeftRadius: spacing.xs, borderTopRightRadius: spacing.xs },
});

import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';

import { HourlyChart } from './HourlyChart';
import type { usePointDetailViewModel } from './usePointDetailViewModel';

type ViewModel = ReturnType<typeof usePointDetailViewModel>;
type Props = Pick<
  ViewModel,
  | 'hours'
  | 'defaultHourId'
  | 'hoursLabel'
  | 'timezoneLabel'
  | 'noHours'
  | 'hoursLoading'
  | 'hoursError'
  | 'retryLabel'
  | 'retry'
>;
type Factor = ViewModel['hours'][number]['factors'][number];

const factorIcons = {
  cloud: require('@/assets/images/point/cloud.svg'),
  sun: require('@/assets/images/point/sun.svg'),
  sparkle: require('@/assets/images/point/sparkle.svg'),
  moon: require('@/assets/images/point/moon.svg'),
} as const;

/**
 * Desglossament d'aquesta nit (HU04, mockup 05): les hores i, a sota, els factors de l'hora triada
 * (per defecte, la millor). L'hora triada viu aquí: triar-ne una no torna a pintar la fitxa ni el
 * mapa DOM.
 */
export function IndexBreakdown({
  hours,
  defaultHourId,
  hoursLabel,
  timezoneLabel,
  noHours,
  hoursLoading,
  hoursError,
  retryLabel,
  retry,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Si l'hora triada desapareix en refrescar l'índex, es torna a la millor.
  const selected =
    hours.find((hour) => hour.id === selectedId) ?? hours.find((hour) => hour.id === defaultHourId);

  if (hoursLoading) {
    return (
      <View style={styles.section}>
        <Skeleton height={sizes.hourlyChart + typography.small.lineHeight + spacing.lg} />
        <Skeleton height={typography.body.lineHeight * 3} />
      </View>
    );
  }
  if (hoursError) {
    return (
      <View style={styles.section} accessibilityLiveRegion="polite">
        <AppText variant="small" color="boira">
          {hoursError}
        </AppText>
        <Button variant="text" label={retryLabel} onPress={retry} />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <HourlyChart
        hours={hours}
        hoursLabel={hoursLabel}
        timezoneLabel={timezoneLabel}
        noHours={noHours}
        selectedHourId={selected?.id ?? null}
        onSelect={setSelectedId}
      />
      {selected ? (
        <View style={styles.factors} accessibilityLiveRegion="polite">
          <AppText variant="small" color="boira">
            {selected.factorsTitle}
          </AppText>
          {selected.factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FactorRow({ factor }: { factor: Factor }) {
  return (
    <View style={styles.factorRow}>
      <Image source={factorIcons[factor.icon]} style={styles.factorIcon} accessible={false} />
      <View style={styles.factorContent}>
        <View style={styles.factorHeading}>
          <View style={styles.factorCopy}>
            <AppText variant="heading">{factor.label}</AppText>
            <AppText variant="small" color="boira">
              {factor.hint}
            </AppText>
          </View>
          <AppText variant="heading" color={factor.level}>
            {factor.value}
          </AppText>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${factor.label}. ${factor.hint}`}
          accessibilityValue={{ min: 0, max: 100, now: factor.value }}
          style={styles.factorTrack}
        >
          <View
            style={[
              styles.factorProgress,
              { width: `${factor.value}%`, backgroundColor: colors[factor.level] },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.lg },
  factors: { gap: spacing.md },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  factorIcon: { width: sizes.icon, height: sizes.icon },
  factorContent: { flex: 1, gap: spacing.xs },
  factorHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  factorCopy: { flex: 1, gap: spacing.xs / 2 },
  factorTrack: {
    height: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.crep,
    overflow: 'hidden',
  },
  factorProgress: { height: '100%', borderRadius: spacing.xs },
});

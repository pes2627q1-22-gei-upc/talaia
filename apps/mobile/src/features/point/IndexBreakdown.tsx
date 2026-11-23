import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { makeStyles, useNightTint, useTheme } from '@/core/theme/theme';
import { sizes, spacing, typography } from '@/core/theme/tokens';
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
  | 'indexExplanation'
  | 'hoursTapHint'
  | 'hourA11yHint'
  | 'hoursLoading'
  | 'hoursError'
  | 'retryLabel'
  | 'retry'
>;
type Factor = ViewModel['hours'][number]['factors'][number];

const factorIcons = {
  cloud: require('@/assets/images/point/cloud.svg'),
  drop: require('@/assets/images/point/drop.svg'),
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
  indexExplanation,
  hoursTapHint,
  hourA11yHint,
  hoursLoading,
  hoursError,
  retryLabel,
  retry,
}: Props) {
  const styles = useStyles();
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
        indexExplanation={indexExplanation}
        hoursTapHint={hoursTapHint}
        hourA11yHint={hourA11yHint}
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
  const nightTint = useNightTint();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.factorRow}>
      <Image
        tintColor={nightTint}
        source={factorIcons[factor.icon]}
        style={styles.factorIcon}
        accessible={false}
      />
      <View style={styles.factorContent}>
        <View style={styles.factorHeading}>
          <View style={styles.factorCopy}>
            <AppText variant="heading">{factor.label}</AppText>
            <AppText variant="small" color="boira">
              {factor.hint}
            </AppText>
            {factor.note ? (
              <AppText variant="small" color="boira">
                {factor.note}
              </AppText>
            ) : null}
          </View>
          <AppText variant="heading" color={factor.level}>
            {factor.value}
          </AppText>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={[factor.label, factor.hint, factor.note].filter(Boolean).join('. ')}
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

const useStyles = makeStyles(({ colors }) => ({
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
}));

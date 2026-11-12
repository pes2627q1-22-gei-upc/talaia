import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, motion, radii, sizes, spacing } from '@/core/theme/tokens';
import type { GRID_GOALS } from '@/features/explore/exploreModel';
import { FieldRow } from '@/features/explore/FieldRow';
import { GoalCard } from '@/features/explore/GoalCard';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Slider } from '@/shared/ui/Slider';

import { useNewAlertViewModel } from './useNewAlertViewModel';

/** Les mateixes icones de fenomen que «Què vols veure?» (mockup 02). */
const GOAL_ICONS: Record<(typeof GRID_GOALS)[number], number> = {
  pluja_estels: require('@/assets/images/explora/pluja-estels.svg'),
  eclipsi: require('@/assets/images/explora/eclipsi.svg'),
  via_lactia: require('@/assets/images/explora/via-lactia.svg'),
  posta_sol: require('@/assets/images/explora/posta-sol.svg'),
  sortida_sol: require('@/assets/images/explora/sortida-sol.svg'),
  cel_estrellat: require('@/assets/images/explora/cel-estrellat.svg'),
};
const locationIcon = require('@/assets/images/explora/ubicacio.svg');
const backIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.lluna}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6L8.5 12L14.5 18"/></svg>`,
  )}`,
};

/** Entrada en cascada, com a Explora: fosa i 6 pt, com a molt 6 blocs. */
function Enter({ index, children }: PropsWithChildren<{ index: number }>) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(Math.min(index, 5) * motion.stagger)
        .easing(motion.enter)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
    >
      {children}
    </Animated.View>
  );
}

type SliderFieldProps = {
  title: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  hint?: string;
  onChange: (value: number) => void;
};

/** Títol i valor a dalt, barra i límits a sota (com «Fins a quina distància» d'Explora). */
function SliderField({ title, label, minLabel, maxLabel, hint, ...slider }: SliderFieldProps) {
  return (
    <>
      <View style={[styles.sliderHeader, styles.sectionTitle]}>
        <AppText variant="link" color="boira" style={styles.shrink}>
          {title}
        </AppText>
        <AppText variant="label">{label}</AppText>
      </View>
      <Slider {...slider} accessibilityLabel={title} accessibilityValueText={label} />
      <View style={styles.limits}>
        <AppText variant="caption" color="boira">
          {minLabel}
        </AppText>
        <AppText variant="caption" color="boira">
          {maxLabel}
        </AppText>
      </View>
      {hint ? (
        <AppText variant="caption" color="boira" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </>
  );
}

/** «Nova alerta» (HU16, mockup 11): s'hi arriba des de la pestanya Alertes. */
export function NewAlertScreen() {
  const vm = useNewAlertViewModel();
  const [firstRow, secondRow] = [vm.goals.slice(0, 3), vm.goals.slice(3)];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea} testID="new-alert-safe-area">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Enter index={0}>
            <View style={styles.header}>
              <PressableScale
                onPress={vm.back.onPress}
                accessibilityLabel={vm.back.label}
                style={styles.back}
              >
                <Image source={backIcon} style={styles.backIcon} accessible={false} />
              </PressableScale>
              <AppText variant="display" accessibilityRole="header" style={styles.shrink}>
                {vm.title}
              </AppText>
            </View>
          </Enter>

          <Enter index={1}>
            <AppText variant="link" color="boira" style={styles.sectionTitle}>
              {vm.goalTitle}
            </AppText>
            <View style={styles.goals}>
              {[firstRow, secondRow].map((row, index) => (
                <View key={index} style={styles.goalRow}>
                  {row.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      label={goal.label}
                      icon={GOAL_ICONS[goal.id]}
                      selected={goal.selected}
                      onPress={goal.onPress}
                      badge={goal.badge}
                      disabled={goal.disabled}
                    />
                  ))}
                </View>
              ))}
            </View>
          </Enter>

          <Enter index={2}>
            <AppText variant="link" color="boira" style={styles.sectionTitle}>
              {vm.originTitle}
            </AppText>
            <FieldRow
              icon={locationIcon}
              label={vm.origin.label}
              hint={vm.origin.hint}
              loading={vm.origin.state === 'loading'}
              onPress={vm.origin.onPress}
            />
          </Enter>

          <Enter index={3}>
            <SliderField {...vm.distance} />
          </Enter>

          <Enter index={4}>
            <SliderField {...vm.minIndex} />
          </Enter>

          <Enter index={5}>
            {vm.error ? (
              <Animated.View entering={FadeIn.duration(motion.fast)} style={styles.error}>
                <AppText variant="small" color="tap" accessibilityRole="alert">
                  {vm.error}
                </AppText>
              </Animated.View>
            ) : null}
            <Button
              label={vm.cta.label}
              onPress={vm.cta.onPress}
              disabled={vm.cta.disabled}
              haptic
              style={styles.cta}
            />
          </Enter>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.nit },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: spacing.ml, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  back: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  backIcon: { width: sizes.icon, height: sizes.icon },
  // El títol i els rètols llargs (es, en) baixen de línia en lloc de sortir de la pantalla.
  shrink: { flexShrink: 1 },
  sectionTitle: { marginTop: spacing.ml, marginBottom: spacing.sm },
  goals: { gap: spacing.sm },
  goalRow: { flexDirection: 'row', gap: spacing.sm },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  limits: { flexDirection: 'row', justifyContent: 'space-between' },
  hint: { marginTop: spacing.xs },
  error: { marginTop: spacing.ml },
  cta: { marginTop: spacing.ml },
});

import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ColorToken, colors, motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { FieldRow } from '@/features/explore/FieldRow';
import { GoalCard } from '@/features/explore/GoalCard';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { PressableScale } from '@/shared/ui/PressableScale';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Slider } from '@/shared/ui/Slider';

import { GOAL_ICONS } from './goalIcons';
import { NotifyHourSheet } from './NotifyHourSheet';
import { useNewAlertViewModel } from './useNewAlertViewModel';
import { ZoneSheet } from './ZoneSheet';

const locationIcon = require('@/assets/images/explora/ubicacio.svg');
const clockIcon = require('@/assets/images/explora/rellotge.svg');
// Un fitxer, com les icones d'Explora: una `data:` URI amb l'SVG no es pintava a Android.
const backIcon = require('@/assets/images/alerts/enrere.svg');

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
  /** Color del valor (la franja de l'índex). */
  color?: ColorToken;
  segments?: readonly { until: number; color: ColorToken }[];
  onChange: (value: number) => void;
};

/** Títol i valor a dalt, barra i límits a sota (com «Fins a quina distància» d'Explora). */
function SliderField({ title, label, minLabel, maxLabel, color, ...slider }: SliderFieldProps) {
  return (
    <>
      <View style={[styles.sliderHeader, styles.sectionTitle]}>
        <AppText variant="link" color="boira" style={styles.shrink}>
          {title}
        </AppText>
        <AppText variant="label" color={color}>
          {label}
        </AppText>
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <SegmentedControl
              options={vm.originModes.options}
              selectedIndex={vm.originModes.selectedIndex}
              onChange={vm.originModes.onChange}
              onReselect={vm.originModes.onChange}
            />
            <View style={styles.gap}>
              <FieldRow
                icon={locationIcon}
                label={vm.origin.label}
                hint={vm.origin.hint}
                loading={vm.origin.state === 'loading'}
                onPress={vm.origin.onPress}
              />
            </View>
          </Enter>

          <Enter index={3}>
            <SliderField {...vm.travel} />
            <SliderField {...vm.minIndex} />
          </Enter>

          <Enter index={4}>
            <AppText variant="link" color="boira" style={styles.sectionTitle}>
              {vm.notifyTitle}
            </AppText>
            <View style={styles.chips}>
              {vm.notifyOptions.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={option.selected}
                  onPress={option.onPress}
                />
              ))}
            </View>
            {vm.notifyHour ? (
              <Animated.View entering={FadeIn.duration(motion.fast)} style={styles.gap}>
                <FieldRow
                  icon={clockIcon}
                  label={vm.notifyHour.label}
                  hint={vm.notifyHour.hint}
                  onPress={vm.notifyHour.onPress}
                />
              </Animated.View>
            ) : null}
            {vm.notifyHint ? (
              <AppText variant="caption" color="boira" style={styles.gap}>
                {vm.notifyHint}
              </AppText>
            ) : null}
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

      <ZoneSheet {...vm.zoneSheet} />
      <NotifyHourSheet {...vm.hourSheet} />
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
  gap: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  limits: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { marginTop: spacing.ml },
  cta: { marginTop: spacing.ml },
});

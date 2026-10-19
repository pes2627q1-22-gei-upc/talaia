import type { ObjectiuObservacio } from '@talaia/shared';
import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, motion, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Slider } from '@/shared/ui/Slider';

import { CalendarSheet } from './CalendarSheet';
import { FieldRow } from './FieldRow';
import { GoalCard } from './GoalCard';
import { TimeRangeSheet } from './TimeRangeSheet';
import { useExploreViewModel } from './useExploreViewModel';

/** Icones del mockup 02, exportades del Figma tal com són. */
const GOAL_ICONS: Record<ObjectiuObservacio, number> = {
  pluja_estels: require('@/assets/images/explora/pluja-estels.svg'),
  eclipsi: require('@/assets/images/explora/eclipsi.svg'),
  via_lactia: require('@/assets/images/explora/via-lactia.svg'),
  posta_sol: require('@/assets/images/explora/posta-sol.svg'),
  sortida_sol: require('@/assets/images/explora/sortida-sol.svg'),
  cel_estrellat: require('@/assets/images/explora/cel-estrellat.svg'),
  constellacions: require('@/assets/images/explora/constellacions.svg'),
};
const locationIcon = require('@/assets/images/explora/ubicacio.svg');
const clockIcon = require('@/assets/images/explora/rellotge.svg');
const searchIcon = require('@/assets/images/explora/cerca.svg');

/** Entrada en cascada, com `Screen`: fosa i 6 pt, com a molt 6 blocs. */
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

/** «Què vols veure?» (HU01, mockup 02): l'inici de la pestanya Explora. */
export function ExploreScreen() {
  const vm = useExploreViewModel();
  const [firstRow, secondRow] = [vm.goals.slice(0, 3), vm.goals.slice(3)];

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Enter index={0}>
          <AppText variant="body" color="boira">
            {vm.greeting}
          </AppText>
          <AppText variant="display" accessibilityRole="header" style={styles.title}>
            {vm.title}
          </AppText>
        </Enter>

        <Enter index={1}>
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
                  />
                ))}
              </View>
            ))}
            <GoalCard
              label={vm.constellations.label}
              hint={vm.constellations.hint}
              badge={vm.constellations.badge}
              icon={GOAL_ICONS.constellacions}
              selected={vm.constellations.selected}
              onPress={vm.constellations.onPress}
            />
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
          <AppText variant="link" color="boira" style={styles.sectionTitle}>
            {vm.whenTitle}
          </AppText>
          <SegmentedControl
            options={vm.days.options}
            selectedIndex={vm.days.selectedIndex}
            onChange={vm.days.onChange}
            onReselect={vm.days.onReselect}
          />
          <View style={styles.gap}>
            <FieldRow
              icon={clockIcon}
              label={vm.range.label}
              hint={vm.range.hint}
              onPress={vm.range.onPress}
            />
          </View>
        </Enter>

        <Enter index={4}>
          <View style={[styles.travelHeader, styles.sectionTitle]}>
            <AppText variant="link" color="boira">
              {vm.travel.title}
            </AppText>
            <AppText variant="label">{vm.travel.label}</AppText>
          </View>
          <Slider
            value={vm.travel.value}
            min={vm.travel.min}
            max={vm.travel.max}
            step={vm.travel.step}
            onChange={vm.travel.onChange}
            accessibilityLabel={vm.travel.title}
            accessibilityValueText={vm.travel.label}
          />
          <View style={styles.limits}>
            <AppText variant="caption" color="boira">
              {vm.travel.minLabel}
            </AppText>
            <AppText variant="caption" color="boira">
              {vm.travel.maxLabel}
            </AppText>
          </View>
        </Enter>

        <Enter index={5}>
          <Button
            label={vm.cta.label}
            onPress={vm.cta.onPress}
            disabled={vm.cta.disabled}
            haptic
            icon={<Image source={searchIcon} style={styles.ctaIcon} accessible={false} />}
            style={styles.cta}
          />
          <Button label={vm.browse.label} onPress={vm.browse.onPress} variant="text" />
        </Enter>
      </ScrollView>

      <CalendarSheet {...vm.calendar} />
      <TimeRangeSheet {...vm.rangeSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.nit },
  content: { paddingHorizontal: spacing.ml, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  title: { marginTop: spacing.sm },
  goals: { marginTop: spacing.ms, gap: spacing.sm + 1 },
  goalRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  sectionTitle: { marginTop: spacing.sm + 2, marginBottom: spacing.sm - 1 },
  gap: { marginTop: spacing.sm },
  travelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  limits: { flexDirection: 'row', justifyContent: 'space-between' },
  ctaIcon: { width: sizes.icon, height: sizes.icon },
  cta: { marginTop: spacing.ms },
});

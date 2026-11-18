import { Image, type ImageSource } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { FieldRow } from '@/features/explore/FieldRow';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { MonthCalendar } from '@/shared/ui/MonthCalendar';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';
import { TextField } from '@/shared/ui/TextField';

import { DepartureTimeSheet } from './DepartureTimeSheet';
import { EventSheet } from './EventSheet';
import { type NewPlanParams, useNewPlanViewModel } from './useNewPlanViewModel';

const pinIcon = require('@/assets/images/explora/ubicacio.svg');
const calendarIcon = require('@/assets/images/plans/calendari.svg');
const clockIcon = require('@/assets/images/explora/rellotge.svg');

/** Entrada en cascada, com `Screen`: fosa i 6 pt, com a molt 6 blocs. */
function Enter({ index, children }: PropsWithChildren<{ index: number }>) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(Math.min(index, 5) * motion.stagger)
        .easing(motion.enter)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
      style={styles.section}
    >
      {children}
    </Animated.View>
  );
}

function SectionLabel({ children }: PropsWithChildren) {
  return (
    <AppText variant="label" color="boira">
      {children}
    </AppText>
  );
}

/** Targeta de «Dia» o «Hora de sortida»: icona i etiqueta a dalt, valor gran a sota. */
function ValueCard({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ImageSource;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={styles.card}>
      <View style={styles.cardLabel}>
        <Image source={icon} tintColor={colors.boira} style={styles.icon} accessible={false} />
        <AppText variant="label" color="boira" numberOfLines={1} style={styles.shrink}>
          {label}
        </AppText>
      </View>
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </PressableScale>
  );
}

/** «Pla d'observació» (HU12, mockup 06). El calendari del mòbil és la TG-158. */
export function NewPlanScreen(params: NewPlanParams) {
  const vm = useNewPlanViewModel(params);
  const { visible, title, closeLabel, onClose, ...calendar } = vm.dateSheet;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Enter index={0}>
          <AppText variant="display" accessibilityRole="header">
            {vm.title}
          </AppText>
        </Enter>

        <Enter index={1}>
          <SectionLabel>{vm.point.label}</SectionLabel>
          <FieldRow
            icon={pinIcon}
            label={vm.point.name}
            accessibilityLabel={vm.point.accessibilityLabel}
            iconTint={colors.lluna}
            loading={vm.point.loading}
            loadingTestID="plan-point-loading"
          />
        </Enter>

        <Enter index={2}>
          <View style={styles.cards}>
            <ValueCard
              icon={calendarIcon}
              label={vm.day.label}
              value={vm.day.value}
              onPress={vm.day.onPress}
            />
            <ValueCard
              icon={clockIcon}
              label={vm.time.label}
              value={vm.time.value}
              onPress={vm.time.onPress}
            />
          </View>
          {vm.pastMessage ? (
            <AppText variant="small" color="tap" accessibilityRole="alert">
              {vm.pastMessage}
            </AppText>
          ) : null}
        </Enter>

        <Enter index={3}>
          <SectionLabel>{vm.event.label}</SectionLabel>
          <FieldRow
            icon={vm.event.icon}
            label={vm.event.value}
            accessibilityLabel={`${vm.event.label}: ${vm.event.value}`}
            iconTint={colors.lluna}
            onPress={vm.event.onPress}
            chevron
          />
        </Enter>

        <Enter index={4}>
          <TextField
            label={vm.notes.label}
            placeholder={vm.notes.placeholder}
            value={vm.notes.value}
            onChangeText={vm.notes.onChange}
            maxLength={vm.notes.maxLength}
            multiline
          />
        </Enter>

        <Enter index={5}>
          {vm.error ? (
            <AppText variant="small" color="tap" accessibilityRole="alert">
              {vm.error}
            </AppText>
          ) : null}
          <Button
            label={vm.save.label}
            onPress={vm.save.onPress}
            disabled={vm.save.disabled}
            haptic
          />
        </Enter>
      </ScrollView>

      <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
        <MonthCalendar {...calendar} />
      </Sheet>
      <DepartureTimeSheet {...vm.timeSheet} />
      <EventSheet {...vm.eventSheet} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.nit },
  content: { padding: spacing.ml, gap: spacing.lg },
  section: { gap: spacing.ms },
  icon: { width: sizes.icon, height: sizes.icon },
  cards: { flexDirection: 'row', gap: spacing.ms },
  card: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  cardLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shrink: { flexShrink: 1 },
});

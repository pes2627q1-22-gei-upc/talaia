import { Image, type ImageSource } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { FieldRow } from '@/features/explore/FieldRow';
import { AppText } from '@/shared/ui/AppText';
import { BackButton } from '@/shared/ui/BackButton';
import { Button } from '@/shared/ui/Button';
import { MonthCalendar } from '@/shared/ui/MonthCalendar';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { Toggle } from '@/shared/ui/Toggle';

import { DepartureTimeSheet } from './DepartureTimeSheet';
import { EventSheet } from './EventSheet';
import { type NewPlanParams, useNewPlanViewModel } from './useNewPlanViewModel';

const pinIcon = require('@/assets/images/explora/ubicacio.svg');
const calendarIcon = require('@/assets/images/plans/calendari.svg');
const clockIcon = require('@/assets/images/explora/rellotge.svg');

/** Entrada en cascada, com `Screen`: fosa i 6 pt, com a molt 6 blocs. */
function Enter({ index, children }: PropsWithChildren<{ index: number }>) {
  const styles = useStyles();
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
  const styles = useStyles();
  const { colors } = useTheme();
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

/** «Pla d'observació» (HU12, mockup 06), amb calendari del mòbil opcional (TG-158). */
/** L'enrere i el nom de la pantalla, fixos a dalt en tots els estats (també en desar el calendari). */
function TopBar({ back, title }: { back: { label: string; onPress: () => void }; title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.topBar}>
      <BackButton label={back.label} onPress={back.onPress} />
      <AppText variant="label" color="boira">
        {title}
      </AppText>
    </View>
  );
}

export function NewPlanScreen(params: NewPlanParams) {
  const styles = useStyles();
  const { colors } = useTheme();
  const vm = useNewPlanViewModel(params);
  const { height } = useWindowDimensions();
  const { visible, title, closeLabel, onClose, ...calendar } = vm.dateSheet;

  if (vm.saved) {
    const saved = vm.saved;
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <TopBar back={vm.back} title={vm.header} />
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="display" accessibilityRole="header">
            {saved.title}
          </AppText>
          <AppText variant="body" accessibilityLiveRegion="polite">
            {saved.message}
          </AppText>
          {saved.busy ? (
            <Skeleton height={sizes.button} />
          ) : (
            <>
              {saved.settings && <Button {...saved.settings} />}
              <Button {...saved.retry} />
              <PressableScale onPress={saved.finish.onPress} style={styles.continue}>
                <AppText variant="link">{saved.finish.label}</AppText>
              </PressableScale>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <TopBar back={vm.back} title={vm.header} />
      <ScrollView
        testID="new-plan-scroll"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        pointerEvents={vm.busy ? 'none' : 'auto'}
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
          <View style={styles.calendarRow}>
            <AppText variant="label" style={styles.calendarLabel}>
              {vm.calendar.label}
            </AppText>
            <Toggle
              value={vm.calendar.value}
              onValueChange={vm.calendar.onChange}
              accessibilityLabel={vm.calendar.label}
              disabled={vm.calendar.disabled}
            />
          </View>
          <AppText variant="small" color="boira">
            {vm.calendar.hint}
          </AppText>
          {vm.calendar.loading && (
            <View accessible accessibilityLabel={vm.calendar.loadingLabel}>
              <Skeleton height={sizes.button} />
            </View>
          )}
          {vm.calendar.target && (
            <FieldRow
              icon={calendarIcon}
              label={vm.calendar.target.value}
              accessibilityLabel={`${vm.calendar.target.label}: ${vm.calendar.target.value}`}
              onPress={vm.calendar.target.onPress}
              chevron
            />
          )}
          {vm.calendar.error && (
            <AppText variant="small" color="tap" accessibilityRole="alert">
              {vm.calendar.error}
            </AppText>
          )}
          {vm.calendar.action && (
            <PressableScale onPress={vm.calendar.action.onPress}>
              <AppText variant="link">{vm.calendar.action.label}</AppText>
            </PressableScale>
          )}
        </Enter>

        <Enter index={6}>
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
      <Sheet
        visible={vm.calendarSheet.visible}
        title={vm.calendarSheet.title}
        closeLabel={vm.calendarSheet.closeLabel}
        onClose={vm.calendarSheet.onClose}
      >
        <ScrollView style={{ maxHeight: height * 0.5 }}>
          {vm.calendarSheet.options.map((option) => (
            <PressableScale
              key={option.id}
              onPress={option.onPress}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.selected }}
              accessibilityLabel={[option.label, option.hint].filter(Boolean).join(', ')}
              style={[styles.calendarOption, option.selected && styles.calendarSelected]}
            >
              <AppText variant="label">{option.label}</AppText>
              {!!option.hint && (
                <AppText variant="small" color="boira">
                  {option.hint}
                </AppText>
              )}
            </PressableScale>
          ))}
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.nit },
  content: { padding: spacing.ml, gap: spacing.lg },
  // Fora del ScrollView: com la capçalera nativa, l'enrere no marxa en baixar pel formulari.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ml,
    paddingTop: spacing.sm,
  },
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
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touch,
  },
  calendarLabel: { flex: 1 },
  calendarOption: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.linia,
    marginBottom: spacing.sm,
  },
  calendarSelected: { borderColor: colors.far },
  continue: { minHeight: sizes.touch, justifyContent: 'center', alignItems: 'center' },
}));

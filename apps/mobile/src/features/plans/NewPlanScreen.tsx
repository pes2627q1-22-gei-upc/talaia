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
import { PointSheet } from './PointSheet';
import {
  type NewPlanParams,
  type PlanFormViewModel,
  useNewPlanViewModel,
} from './useNewPlanViewModel';

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
  /** Sense, la targeta només es llegeix (un pla acabat, TG-161). */
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${label}: ${value}`}
      style={styles.card}
    >
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

/** «Pla d'observació» (HU12, mockup 06), amb calendari del mòbil opcional (TG-158). */
export function NewPlanScreen(params: NewPlanParams) {
  return <PlanFormView vm={useNewPlanViewModel(params)} />;
}

/**
 * El formulari d'un pla: nou (`NewPlanScreen`) o desat (`EditPlanScreen`, TG-161), on el punt es
 * pot canviar, el calendari s'actualitza i un pla acabat només es llegeix.
 */
export function PlanFormView({ vm }: { vm: PlanFormViewModel }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { visible, title, closeLabel, onClose, ...month } = vm.dateSheet;
  const calendar = vm.calendar;

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
          {vm.readOnlyMessage ? (
            <AppText variant="body" color="boira">
              {vm.readOnlyMessage}
            </AppText>
          ) : null}
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
            onPress={vm.point.onPress}
            chevron={!!vm.point.onPress}
          />
          {vm.point.error ? (
            <AppText variant="small" color="tap" accessibilityRole="alert">
              {vm.point.error}
            </AppText>
          ) : null}
          {vm.point.link ? (
            <PressableScale onPress={vm.point.link.onPress} style={styles.link}>
              <AppText variant="link">{vm.point.link.label}</AppText>
            </PressableScale>
          ) : null}
        </Enter>

        <Enter index={2}>
          <View style={styles.cards}>
            <ValueCard
              icon={calendarIcon}
              label={vm.day.label}
              value={vm.day.value}
              onPress={vm.readOnly ? undefined : vm.day.onPress}
            />
            <ValueCard
              icon={clockIcon}
              label={vm.time.label}
              value={vm.time.value}
              onPress={vm.readOnly ? undefined : vm.time.onPress}
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
            onPress={vm.readOnly ? undefined : vm.event.onPress}
            chevron={!vm.readOnly}
          />
        </Enter>

        <Enter index={4}>
          <TextField
            label={vm.notes.label}
            placeholder={vm.notes.placeholder}
            value={vm.notes.value}
            onChangeText={vm.notes.onChange}
            maxLength={vm.notes.maxLength}
            editable={!vm.readOnly}
            multiline
          />
        </Enter>

        {calendar ? (
          <Enter index={5}>
            {calendar.linkedHint ? (
              <>
                <AppText variant="label">{calendar.label}</AppText>
                <AppText variant="small" color="boira">
                  {calendar.linkedHint}
                </AppText>
              </>
            ) : (
              <>
                <View style={styles.calendarRow}>
                  <AppText variant="label" style={styles.calendarLabel}>
                    {calendar.label}
                  </AppText>
                  <Toggle
                    value={calendar.value}
                    onValueChange={calendar.onChange}
                    accessibilityLabel={calendar.label}
                    disabled={calendar.disabled}
                  />
                </View>
                <AppText variant="small" color="boira">
                  {calendar.hint}
                </AppText>
                {calendar.loading && (
                  <View accessible accessibilityLabel={calendar.loadingLabel}>
                    <Skeleton height={sizes.button} />
                  </View>
                )}
                {calendar.target && (
                  <FieldRow
                    icon={calendarIcon}
                    label={calendar.target.value}
                    accessibilityLabel={`${calendar.target.label}: ${calendar.target.value}`}
                    onPress={calendar.target.onPress}
                    chevron
                  />
                )}
                {calendar.error && (
                  <AppText variant="small" color="tap" accessibilityRole="alert">
                    {calendar.error}
                  </AppText>
                )}
                {calendar.action && (
                  <PressableScale onPress={calendar.action.onPress}>
                    <AppText variant="link">{calendar.action.label}</AppText>
                  </PressableScale>
                )}
              </>
            )}
            {vm.calendarNotice ? (
              <View style={styles.notice}>
                <AppText variant="small" accessibilityRole="alert">
                  {vm.calendarNotice.message}
                </AppText>
                {vm.calendarNotice.action ? (
                  <PressableScale onPress={vm.calendarNotice.action.onPress} style={styles.link}>
                    <AppText variant="link">{vm.calendarNotice.action.label}</AppText>
                  </PressableScale>
                ) : null}
                <PressableScale onPress={vm.calendarNotice.finish.onPress} style={styles.link}>
                  <AppText variant="link">{vm.calendarNotice.finish.label}</AppText>
                </PressableScale>
              </View>
            ) : null}
          </Enter>
        ) : null}

        <Enter index={6}>
          {vm.error ? (
            <AppText variant="small" color="tap" accessibilityRole="alert">
              {vm.error}
            </AppText>
          ) : null}
          {vm.save ? (
            <Button
              label={vm.save.label}
              onPress={vm.save.onPress}
              disabled={vm.save.disabled}
              haptic
            />
          ) : null}
        </Enter>
      </ScrollView>

      <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
        <MonthCalendar {...month} />
      </Sheet>
      <DepartureTimeSheet {...vm.timeSheet} />
      <EventSheet {...vm.eventSheet} />
      {vm.pointSheet ? <PointSheet {...vm.pointSheet} /> : null}
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
  link: { minHeight: sizes.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  notice: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
}));

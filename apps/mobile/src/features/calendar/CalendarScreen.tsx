import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { MonthCalendar } from '@/shared/ui/MonthCalendar';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { eventDate } from './calendarModel';
import { eventAppearance, filterColors, filterIcons } from './phenomenonAppearance';
import { useCalendarViewModel } from './useCalendarViewModel';

/** Calendari mensual de fenòmens (HU09, mockup 08). */
export function CalendarScreen() {
  const vm = useCalendarViewModel();

  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.screenHeader}>
            <AppText variant="display" accessibilityRole="header">
              {vm.title}
            </AppText>
          </View>

          <MonthCalendar
            value={vm.selectedDay}
            today={vm.today}
            min={vm.minDate}
            visibleMonth={vm.month}
            onMonthChange={vm.selectMonth}
            onChange={vm.selectDay}
            firstDay={vm.firstDay}
            weekdayNames={vm.weekdayNames}
            formatTitle={vm.formatMonth}
            dayLabel={vm.dayLabel}
            previousLabel={`${vm.t('calendar.previous')}: ${vm.previousMonthLabel}`}
            nextLabel={`${vm.t('calendar.next')}: ${vm.nextMonthLabel}`}
            markersByDay={vm.markersByDay}
            dimPastDays
            outlineToday
            headerAction={
              vm.showGoToday ? (
                <PressableScale
                  haptic="selection"
                  onPress={vm.goToday}
                  style={styles.todayButton}
                  accessibilityLabel={vm.t('calendar.goToday')}
                >
                  <AppText variant="chip" color="far">
                    {vm.t('calendar.relative.today')}
                  </AppText>
                </PressableScale>
              ) : null
            }
          />

          <View style={styles.events}>
            <View style={styles.eventsHeader}>
              <View style={styles.headerControls}>
                {vm.selectedDay ? (
                  <PressableScale
                    haptic="selection"
                    onPress={vm.clearSelectedDay}
                    style={styles.allMonthButton}
                    accessibilityRole="button"
                    accessibilityLabel={vm.t('calendar.allMonth')}
                  >
                    <AppText variant="chip" color="far">
                      {vm.t('calendar.allMonth')}
                    </AppText>
                  </PressableScale>
                ) : null}
                <PressableScale
                  onPress={vm.toggleFilterMenu}
                  style={[styles.controlButton, vm.showPast && styles.controlButtonActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${vm.t('calendar.filterLabel', {
                    filter: vm.activeFilterLabel,
                  })}${vm.showPast ? `, ${vm.t('calendar.showPast')}` : ''}`}
                  accessibilityState={{ expanded: vm.filterMenuOpen }}
                >
                  {vm.filter === 'all' ? (
                    <Image source={filterIcons.all} style={styles.filterIcon} accessible={false} />
                  ) : (
                    <View
                      style={[
                        styles.filterDot,
                        { backgroundColor: colors[filterColors[vm.filter]] },
                      ]}
                      accessible={false}
                    />
                  )}
                  <AppText variant="chip">{vm.activeFilterShortLabel}</AppText>
                  <Image
                    source={require('@/assets/images/calendar/chevron-down.svg')}
                    style={styles.chevron}
                    accessible={false}
                  />
                </PressableScale>
              </View>
              <AppText variant="heading" style={styles.periodTitle} numberOfLines={1}>
                {vm.periodLabel}
              </AppText>
            </View>
            {vm.isLoading ? (
              <>
                <Skeleton height={sizes.calendarEvent} />
                <Skeleton height={sizes.calendarEvent} />
                <Skeleton height={sizes.calendarEvent} />
              </>
            ) : vm.isError ? (
              <StateMessage
                title={vm.t('calendar.error')}
                action={{ label: vm.t('calendar.retry'), onPress: vm.retry }}
              />
            ) : vm.events.length === 0 ? (
              <StateMessage title={vm.emptyMessage} />
            ) : (
              vm.events.map((event) => {
                const date = eventDate(event);
                const past = date < vm.today;
                const relativeDay =
                  date === vm.today ? 'today' : date === vm.tomorrow ? 'tomorrow' : null;
                const day = Number(date.slice(-2));
                const month = new Intl.DateTimeFormat(vm.locale, { month: 'short' }).format(
                  new Date(`${date}T12:00:00`),
                );
                const appearance = eventAppearance(event);
                return (
                  <View
                    key={event.id}
                    style={[
                      styles.event,
                      past && styles.pastEvent,
                      date === vm.selectedDay && styles.activeEvent,
                    ]}
                  >
                    <View style={[styles.dateBadge, past && styles.pastDateBadge]}>
                      <AppText variant="heading" color={past ? 'boira' : 'lluna'}>
                        {day}
                      </AppText>
                      <AppText variant="tag" color="boira">
                        {month}
                      </AppText>
                    </View>
                    <View style={styles.eventCopy}>
                      <View style={styles.eventTitleRow}>
                        <AppText
                          variant="label"
                          color={past ? 'boira' : 'lluna'}
                          style={styles.eventName}
                        >
                          {event.nom}
                        </AppText>
                      </View>
                      <AppText variant="small" color="boira" numberOfLines={2}>
                        {event.descripcio}
                      </AppText>
                    </View>
                    {past ? (
                      <Image
                        source={require('@/assets/images/calendar/history.svg')}
                        style={styles.eventIcon}
                        accessible
                        accessibilityLabel={vm.t('calendar.relative.past')}
                      />
                    ) : relativeDay ? (
                      <View style={styles.relativeBadge}>
                        <AppText variant="tag" color={relativeDay === 'today' ? 'lluna' : 'boira'}>
                          {vm.t(`calendar.relative.${relativeDay}`)}
                        </AppText>
                      </View>
                    ) : (
                      <Image source={appearance.icon} style={styles.eventIcon} accessible={false} />
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
        <Sheet
          visible={vm.filterMenuOpen}
          onClose={vm.closeFilterMenu}
          title={vm.t('calendar.filterTitle')}
          closeLabel={vm.t('calendar.closeFilter')}
        >
          <View style={styles.filterOptions}>
            {vm.filters.map(({ value, label }) => (
              <PressableScale
                key={value}
                haptic="selection"
                onPress={() => vm.selectFilter(value)}
                style={[styles.filterOption, value === vm.filter && styles.filterOptionSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: value === vm.filter }}
              >
                <Image source={filterIcons[value]} style={styles.filterIcon} accessible={false} />
                <AppText variant="label" style={styles.filterOptionLabel}>
                  {label}
                </AppText>
                <View
                  style={[styles.radio, value === vm.filter && styles.radioSelected]}
                  accessible={false}
                >
                  {value === vm.filter ? <View style={styles.radioCenter} /> : null}
                </View>
              </PressableScale>
            ))}
            <PressableScale
              haptic="selection"
              onPress={vm.toggleShowPast}
              style={styles.showPastOption}
              accessibilityRole="switch"
              accessibilityState={{ checked: vm.showPast }}
              accessibilityLabel={vm.t('calendar.showPast')}
            >
              <AppText variant="label" style={styles.filterOptionLabel}>
                {vm.t('calendar.showPast')}
              </AppText>
              <View
                style={[styles.switchTrack, vm.showPast && styles.switchTrackActive]}
                accessible={false}
              >
                <View style={[styles.switchThumb, vm.showPast && styles.switchThumbActive]} />
              </View>
            </PressableScale>
          </View>
        </Sheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.nit },
  content: {
    paddingHorizontal: spacing.ml,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  todayButton: {
    minWidth: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  controlButton: {
    minHeight: sizes.touch,
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.linia,
    borderRadius: radii.field,
    backgroundColor: colors.card,
  },
  controlButtonActive: { borderColor: colors.far },
  chevron: { width: spacing.md, height: spacing.md },
  filterOptions: { gap: spacing.xs },
  filterOptionLabel: { flex: 1 },
  filterIcon: { width: sizes.icon, height: sizes.icon },
  filterDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
  },
  filterOption: {
    minHeight: sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.field,
  },
  filterOptionSelected: { backgroundColor: colors.vel },
  showPastOption: {
    minHeight: sizes.button,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.ms,
    borderTopWidth: 1,
    borderTopColor: colors.linia,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  switchTrack: {
    width: sizes.touch,
    height: sizes.icon + spacing.xs / 2,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.vora,
    borderRadius: radii.pill,
    backgroundColor: colors.crep,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchTrackActive: { backgroundColor: colors.far, borderColor: colors.far },
  switchThumb: {
    width: sizes.icon - spacing.sm,
    height: sizes.icon - spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.lluna,
  },
  switchThumbActive: { marginLeft: 'auto', backgroundColor: colors.nit },
  radio: {
    width: sizes.icon,
    height: sizes.icon,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.vora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.far },
  radioCenter: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.far,
  },
  headerControls: { minHeight: sizes.touch, flexDirection: 'row', alignItems: 'center' },
  periodTitle: {
    maxWidth: '100%',
    height: sizes.touch,
    marginTop: -spacing.sm,
    textAlignVertical: 'center',
    textTransform: 'capitalize',
  },
  allMonthButton: {
    minHeight: sizes.touch,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  events: { gap: spacing.sm, marginTop: spacing.md },
  eventsHeader: {
    height: sizes.touch * 2 - spacing.sm,
  },
  event: {
    minHeight: sizes.calendarEvent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.ms,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.linia,
  },
  pastEvent: { backgroundColor: colors.nit },
  activeEvent: { borderColor: colors.far },
  dateBadge: {
    width: sizes.calendarDateWidth,
    height: sizes.calendarDateHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.vel,
  },
  pastDateBadge: { backgroundColor: colors.card },
  eventCopy: { flex: 1, gap: spacing.xs },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventName: { flex: 1 },
  eventIcon: { width: sizes.icon, height: sizes.icon, marginLeft: spacing.xs },
  relativeBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.vel,
    borderRadius: radii.pill,
  },
});

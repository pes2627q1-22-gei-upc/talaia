import type { Esdeveniment } from '@talaia/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import type { ColorToken } from '@/core/theme/tokens';
import {
  isoDate,
  monthIndex,
  monthOf,
  shiftMonth,
  type CalendarMonth,
} from '@/shared/ui/calendarGrid';

import {
  CALENDAR_FILTERS,
  cataloniaDate,
  eventDate,
  eventFilter,
  filterEvents,
  millisecondsUntilNextCataloniaDay,
  monthBounds,
  nextDay,
  orderEventsAroundToday,
  type CalendarFilter,
} from './calendarModel';
import { useCalendarEventsQuery } from './calendarRepository';
import { eventTypeLabelKey, filterColors } from './phenomenonAppearance';

export function useCalendarViewModel() {
  const { t, i18n } = useTranslation();
  const [today, setToday] = useState(() => cataloniaDate(new Date().toISOString()));
  useEffect(() => {
    let active = AppState.currentState !== 'background';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncToday = () => {
      if (timer) clearTimeout(timer);
      if (!active) return;
      const now = new Date();
      setToday(cataloniaDate(now.toISOString()));
      timer = setTimeout(syncToday, millisecondsUntilNextCataloniaDay(now) + 50);
    };
    syncToday();
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      syncToday();
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  const [requestedMonth, setMonth] = useState(() => monthOf(today));
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [showPast, setShowPast] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [requestedDay, setSelectedDay] = useState<string | null>(null);
  const currentMonth = monthOf(today);
  const earliestMonth = shiftMonth(currentMonth, -1);
  const minDate = isoDate(earliestMonth.year, earliestMonth.month, 1);
  const month =
    monthIndex(requestedMonth) < monthIndex(earliestMonth) ? earliestMonth : requestedMonth;
  const selectedDay = requestedDay && requestedDay >= minDate ? requestedDay : null;
  const query = useCalendarEventsQuery(month);
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const visibleByStatus = (items: Esdeveniment[]) =>
    showPast ? items : items.filter((event) => eventDate(event) >= today);
  const events = visibleByStatus(filterEvents(query.data?.data ?? [], filter));
  const groupByDay = (items: Esdeveniment[]) => {
    const grouped = new Map<string, Esdeveniment[]>();
    for (const event of items) {
      const day = eventDate(event);
      grouped.set(day, [...(grouped.get(day) ?? []), event]);
    }
    return grouped;
  };
  const eventsByDay = groupByDay(events);
  const markersByDay = new Map<string, ColorToken[]>(
    [...eventsByDay].map(([day, dayEvents]) => [
      day,
      [...new Set(dayEvents.map((event) => filterColors[eventFilter(event.tipus)]))],
    ]),
  );
  const bounds = monthBounds(month);
  const visibleEvents = orderEventsAroundToday(
    events.filter((event) => {
      const date = eventDate(event);
      return selectedDay ? date === selectedDay : date >= bounds.from && date <= bounds.to;
    }),
    today,
  );
  const locale =
    i18n.resolvedLanguage === 'es' ? 'es-ES' : i18n.resolvedLanguage === 'en' ? 'en-GB' : 'ca-ES';
  const formatMonth = (target: CalendarMonth) =>
    `${new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(target.year, target.month, 1))} ${target.year}`;
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(month.year, month.month, 1),
  );
  const adjacentMonthLabel = (targetMonth: typeof month) =>
    new Intl.DateTimeFormat(locale, { month: 'short' })
      .format(new Date(targetMonth.year, targetMonth.month, 1))
      .replace(/\.$/, '');
  const formatDay = (day: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
      new Date(`${day}T12:00:00`),
    );
  const periodLabel = selectedDay ? formatDay(selectedDay) : t('calendar.events');

  const changeMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    if (monthIndex(next) < monthIndex(earliestMonth)) return;
    setMonth(next);
    setSelectedDay(null);
    setFilterMenuOpen(false);
  };
  const selectMonth = (next: CalendarMonth) => {
    if (monthIndex(next) < monthIndex(earliestMonth)) return;
    setMonth(next);
    setSelectedDay(null);
    setFilterMenuOpen(false);
  };
  const showGoToday =
    month.year !== currentMonth.year ||
    month.month !== currentMonth.month ||
    (selectedDay !== null && selectedDay !== today);
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];

  return {
    title: t('calendar.title'),
    month,
    minDate,
    monthLabel: `${monthName} ${month.year}`,
    formatMonth,
    weekdayNames: [weekdays[6]!, ...weekdays.slice(0, 6)],
    firstDay: (i18n.resolvedLanguage === 'en' ? 0 : 1) as 0 | 1,
    previousMonthLabel: adjacentMonthLabel(previousMonth),
    nextMonthLabel: adjacentMonthLabel(nextMonth),
    today,
    tomorrow: nextDay(today),
    selectedDay,
    showGoToday,
    goToday: () => {
      setMonth(monthOf(today));
      setSelectedDay(today);
      setFilterMenuOpen(false);
    },
    selectMonth,
    dayLabel: (day: string) => {
      const label = formatDay(day);
      const dayEvents = eventsByDay.get(day) ?? [];
      return dayEvents.length
        ? t('calendar.dayWithEvents', {
            day: label,
            count: dayEvents.length,
            types: [
              ...new Set(
                dayEvents.map((event) => t(`calendar.types.${eventTypeLabelKey(event.tipus)}`)),
              ),
            ].join(', '),
          })
        : label;
    },
    periodLabel,
    selectDay: (day: string) => {
      setSelectedDay((current) => (current === day ? null : day));
      setFilterMenuOpen(false);
    },
    clearSelectedDay: () => setSelectedDay(null),
    previousMonth: () => changeMonth(-1),
    nextMonth: () => changeMonth(1),
    filter,
    showPast,
    toggleShowPast: () => {
      setShowPast((current) => !current);
    },
    filterMenuOpen,
    activeFilterLabel: t(`calendar.filters.${filter}`),
    activeFilterShortLabel: t(`calendar.filterShort.${filter}`),
    filters: CALENDAR_FILTERS.map((value) => ({ value, label: t(`calendar.filters.${value}`) })),
    toggleFilterMenu: () => setFilterMenuOpen((open) => !open),
    closeFilterMenu: () => setFilterMenuOpen(false),
    selectFilter: (value: CalendarFilter) => {
      setFilter(value);
      setFilterMenuOpen(false);
    },
    events: visibleEvents,
    eventsByDay,
    markersByDay,
    emptyMessage: t(
      `calendar.empty.${showPast ? (selectedDay ? 'day' : 'month') : selectedDay ? 'upcomingDay' : 'upcomingMonth'}`,
    ),
    isLoading: query.isPending,
    isError: query.isError,
    retry: () => {
      void query.refetch();
    },
    t,
    locale,
  };
}

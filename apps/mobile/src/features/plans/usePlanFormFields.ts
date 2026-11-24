import type { Esdeveniment } from '@talaia/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { eventDate } from '@/features/calendar/calendarModel';
import {
  eventAppearance,
  eventTypeLabelKey,
  filterIcons,
} from '@/features/calendar/phenomenonAppearance';
import { addDays, dayParts } from '@/features/explore/exploreModel';
import type { CalendarMonth } from '@/shared/ui/calendarGrid';

import {
  type Departure,
  eventFitsDay,
  formatTime,
  HOURS,
  localDate,
  MINUTES,
  NOTES_MAX,
} from './planModel';
import { usePlanEventsQuery } from './plansRepository';
import type { usePlanCalendar } from './usePlanCalendar';

/** Fins on arriba el calendari del pla: un any, com «Tria el dia» d'Explora. */
const CALENDAR_DAYS = 365;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type PlanSheet = 'date' | 'time' | 'event' | 'calendar' | 'point';

export type Action = { label: string; onPress: () => void };

/** El full «Tria el punt» de l'edició (TG-161): els punts publicats, amb cerca. */
export type PointSheetProps = {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  search: { label: string; value: string; onChange: (value: string) => void };
  status: 'loading' | 'error' | 'ok';
  errorMessage: string;
  retryLabel: string;
  retry: () => void;
  emptyMessage: string;
  options: {
    id: string;
    label: string;
    hint: string;
    selected: boolean;
    onPress: () => void;
  }[];
};

/**
 * El formulari comú de «Crea un pla» (TG-157) i «Edita el pla» (TG-161): dia, hora de sortida,
 * fenomen, notes i els seus fulls. `onEdit` es crida a cada canvi (per esborrar l'error de l'enviament).
 */
export function usePlanFormFields(
  initial: { departure: Departure; esdevenimentId: string | null; notes: string },
  onEdit: () => void,
) {
  const { t, i18n } = useTranslation();
  const [departure, setDeparture] = useState<Departure>(initial.departure);
  const [event, setEvent] = useState<Esdeveniment | null>(null);
  // El fenomen inicial només es coneix pel seu id fins que arriba la llista.
  const [pendingEventId, setPendingEventId] = useState(initial.esdevenimentId);
  const [notes, setNotes] = useState(initial.notes);
  const [sheet, setSheet] = useState<PlanSheet | null>(null);
  const [pastError, setPastError] = useState(false);

  const events = usePlanEventsQuery(departure.date);
  const eventList = events.data?.data ?? [];
  const chosenEvent =
    event ?? (pendingEventId ? eventList.find((item) => item.id === pendingEventId) : undefined);
  /** El fenomen del formulari, encara que la llista no hagi arribat (o hagi fallat). */
  const esdevenimentId = event?.id ?? pendingEventId;

  const today = localDate(new Date());
  const weekdays = t('explore.weekdays', { returnObjects: true }) as string[];
  const monthsShort = t('plans.new.monthsShort', { returnObjects: true }) as string[];
  const months = t('explore.calendar.months', { returnObjects: true }) as string[];
  const monthsOf = t('explore.calendar.monthsOf', { returnObjects: true }) as string[];
  const monthOfDate = (date: string) => Number(date.slice(5, 7)) - 1;
  const dayLabel = (date: string) => {
    const { weekday, day } = dayParts(date);
    return t('plans.new.dayValue', {
      weekday: capitalize(weekdays[weekday] ?? ''),
      day,
      month: monthsShort[monthOfDate(date)],
    });
  };
  const eventLabel = (item: Esdeveniment) =>
    t('plans.new.eventValue', {
      type: capitalize(t(`calendar.types.${eventTypeLabelKey(item.tipus)}`)),
      name: item.nom,
    });

  const changeDeparture = (next: Partial<Departure>) => {
    setPastError(false);
    onEdit();
    setDeparture((current) => ({ ...current, ...next }));
  };

  const chooseDay = (date: string) => {
    // Un fenomen que queda fora de la finestra del dia nou es treu.
    setEvent(chosenEvent && eventFitsDay(chosenEvent, date) ? chosenEvent : null);
    setPendingEventId(null);
    changeDeparture({ date });
    setSheet(null);
  };

  const chooseEvent = (item: Esdeveniment | null) => {
    setEvent(item);
    setPendingEventId(null);
    onEdit();
    setSheet(null);
  };

  const changeNotes = (value: string) => {
    onEdit();
    setNotes(value);
  };

  return {
    departure,
    notes,
    chosenEvent,
    esdevenimentId,
    sheet,
    setSheet,
    pastError,
    setPastError,
    today,
    day: {
      label: t('plans.new.day'),
      value: dayLabel(departure.date),
      onPress: () => setSheet('date'),
    },
    time: {
      label: t('plans.new.time'),
      value: formatTime(departure.hour, departure.minute),
      onPress: () => setSheet('time'),
    },
    event: {
      label: t('plans.new.event'),
      value: chosenEvent ? eventLabel(chosenEvent) : t('plans.new.noEvent'),
      icon: chosenEvent ? eventAppearance(chosenEvent).icon : filterIcons.meteor,
      onPress: () => setSheet('event'),
    },
    notesField: {
      label: t('plans.new.notes'),
      placeholder: t('plans.new.notesPlaceholder'),
      value: notes,
      maxLength: NOTES_MAX,
      onChange: changeNotes,
    },
    dateSheet: {
      visible: sheet === 'date',
      title: t('plans.new.dateSheet'),
      closeLabel: t('plans.new.close'),
      onClose: () => setSheet(null),
      value: departure.date,
      today,
      min: today,
      max: addDays(today, CALENDAR_DAYS),
      dimPastDays: true,
      firstDay: (i18n.language === 'en' ? 0 : 1) as 0 | 1,
      weekdayNames: weekdays,
      formatTitle: ({ year, month }: CalendarMonth) =>
        t('explore.calendar.month', { month: months[month], year }),
      dayLabel: (date: string) =>
        t('explore.calendar.day', {
          day: Number(date.slice(8, 10)),
          month: monthsOf[monthOfDate(date)],
        }),
      previousLabel: t('explore.calendar.previous'),
      nextLabel: t('explore.calendar.next'),
      onChange: chooseDay,
    },
    timeSheet: {
      visible: sheet === 'time',
      title: t('plans.new.timeSheet'),
      doneLabel: t('plans.new.done'),
      hourLabel: t('plans.new.hour'),
      minuteLabel: t('plans.new.minute'),
      hours: HOURS,
      minutes: MINUTES,
      hour: departure.hour,
      minute: departure.minute,
      onHourChange: (hour: number) => changeDeparture({ hour }),
      onMinuteChange: (minute: number) => changeDeparture({ minute }),
      onClose: () => setSheet(null),
    },
    eventSheet: {
      visible: sheet === 'event',
      title: t('plans.new.eventSheet'),
      closeLabel: t('plans.new.close'),
      onClose: () => setSheet(null),
      status: (events.isPending ? 'loading' : events.isError ? 'error' : 'ok') as
        'loading' | 'error' | 'ok',
      errorMessage: t('plans.new.eventsError'),
      retryLabel: t('plans.new.retry'),
      retry: () => void events.refetch(),
      emptyMessage: t('plans.new.noEvents'),
      options: [
        {
          id: 'none',
          label: t('plans.new.noEvent'),
          hint: undefined as string | undefined,
          icon: filterIcons.all,
          selected: !chosenEvent,
          onPress: () => chooseEvent(null),
        },
        ...eventList.map((item) => ({
          id: item.id,
          label: eventLabel(item),
          hint: dayLabel(eventDate(item)) as string | undefined,
          icon: eventAppearance(item).icon,
          selected: chosenEvent?.id === item.id,
          onPress: () => chooseEvent(item),
        })),
      ],
    },
  };
}

type PlanCalendar = ReturnType<typeof usePlanCalendar>;

/**
 * L'interruptor «Afegeix-lo al meu calendari» (TG-158) i el full per triar el calendari, comuns a
 * «Crea un pla» i a l'edició d'un pla que encara no hi és (TG-161).
 */
export function usePlanCalendarFields(
  calendar: PlanCalendar,
  form: Pick<ReturnType<typeof usePlanFormFields>, 'sheet' | 'setSheet'>,
  disabled: boolean,
) {
  const { t } = useTranslation();
  const calendarError = !calendar.enabled
    ? null
    : calendar.status === 'denied'
      ? t('plans.calendar.denied')
      : calendar.status === 'error'
        ? t('plans.calendar.loadError')
        : calendar.status === 'ready' && calendar.calendars.length === 0
          ? t('plans.calendar.empty')
          : null;
  const selectedCalendar = calendar.calendars.find((item) => item.id === calendar.selectedId);

  return {
    calendar: {
      label: t('plans.calendar.label'),
      hint: t(calendar.supported ? 'plans.calendar.hint' : 'plans.calendar.unavailable'),
      value: calendar.enabled,
      disabled: !calendar.supported || disabled,
      onChange: calendar.toggle,
      loading: calendar.enabled && calendar.status === 'loading',
      loadingLabel: t('plans.calendar.loading'),
      error: calendarError,
      action:
        calendar.enabled &&
        (calendar.status === 'denied' ||
          calendar.status === 'error' ||
          (calendar.status === 'ready' && calendar.calendars.length === 0))
          ? calendar.status === 'denied' && !calendar.canAskAgain
            ? { label: t('plans.calendar.settings'), onPress: () => void Linking.openSettings() }
            : { label: t('plans.new.retry'), onPress: () => void calendar.setup() }
          : null,
      target:
        calendar.enabled && selectedCalendar && calendar.status === 'ready'
          ? {
              label: t('plans.calendar.target'),
              value: [selectedCalendar.title, selectedCalendar.account].filter(Boolean).join(' · '),
              onPress: () => form.setSheet('calendar'),
            }
          : null,
      /** Amb un esdeveniment ja vinculat (edició), un text en lloc de l'interruptor. */
      linkedHint: null as string | null,
    },
    calendarSheet: {
      visible: form.sheet === 'calendar',
      title: t('plans.calendar.choose'),
      closeLabel: t('plans.new.close'),
      onClose: () => form.setSheet(null),
      options: calendar.calendars.map((item) => ({
        id: item.id,
        label: item.title,
        hint: item.account,
        selected: item.id === calendar.selectedId,
        onPress: () => {
          calendar.select(item.id);
          form.setSheet(null);
        },
      })),
    },
    /** El calendari encara no deixa desar: carregant, sense permís o sense cap calendari triat. */
    blocking: calendar.enabled && (calendar.status !== 'ready' || !calendar.selectedId),
  };
}

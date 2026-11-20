import type { Esdeveniment } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { eventDate } from '@/features/calendar/calendarModel';
import {
  eventAppearance,
  eventTypeLabelKey,
  filterIcons,
} from '@/features/calendar/phenomenonAppearance';
import { addDays, dayParts } from '@/features/explore/exploreModel';
import { usePointDetailQuery } from '@/features/point/pointRepository';
import type { CalendarMonth } from '@/shared/ui/calendarGrid';

import {
  buildNewPlan,
  type Departure,
  departureIso,
  eventFitsDay,
  formatTime,
  HOURS,
  initialDeparture,
  initialDuration,
  isFuture,
  localDate,
  MINUTES,
  NOTES_MAX,
  planErrorKey,
} from './planModel';
import { PLANS_KEY, plansRepository, usePlanEventsQuery } from './plansRepository';

/** Paràmetres de la ruta `/pla/nou`: el punt, i el que la fitxa o un fenomen ja proposen. */
export type NewPlanParams = {
  puntId: string;
  /** Inici de la millor franja de la nit (ISO), per proposar l'hora de sortida. */
  inici?: string;
  /** Final de la millor franja (ISO): el pla en conserva la durada encara que es mogui la sortida. */
  fi?: string;
  /** Fenomen ja triat (el `id` de `/esdeveniments`). */
  esdevenimentId?: string;
};

/** Fins on arriba el calendari del pla: un any, com «Tria el dia» d'Explora. */
const CALENDAR_DAYS = 365;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** «Pla d'observació» (HU12, mockup 06): punt, dia, hora de sortida, fenomen i notes. */
export function useNewPlanViewModel({ puntId, inici, fi, esdevenimentId }: NewPlanParams) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const point = usePointDetailQuery(puntId);

  const [departure, setDeparture] = useState<Departure>(() => initialDeparture(inici));
  // Es calcula un sol cop, amb la sortida inicial: després, el final segueix la sortida.
  const [durationMs] = useState(() => initialDuration(departure, inici, fi));
  const [event, setEvent] = useState<Esdeveniment | null>(null);
  // El fenomen dels paràmetres només es coneix pel seu id fins que arriba la llista.
  const [pendingEventId, setPendingEventId] = useState(esdevenimentId ?? null);
  const [notes, setNotes] = useState('');
  const [sheet, setSheet] = useState<'date' | 'time' | 'event' | null>(null);
  const [pastError, setPastError] = useState(false);
  // `isPending` arriba un render tard: el ref atura el doble toc del mateix instant.
  const sending = useRef(false);

  const events = usePlanEventsQuery(departure.date);
  const eventList = events.data?.data ?? [];
  const chosenEvent =
    event ?? (pendingEventId ? eventList.find((item) => item.id === pendingEventId) : undefined);

  const create = useMutation({
    mutationFn: plansRepository.create,
    onSuccess: async () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      router.back();
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  const today = localDate(new Date());
  const iso = departureIso(departure);
  const past = !isFuture(iso);

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
    create.reset();
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
    create.reset();
    setSheet(null);
  };

  const save = () => {
    if (sending.current || create.isPending) return;
    // L'hora pot haver passat amb la pantalla oberta: es torna a mirar en el moment d'enviar.
    if (!isFuture(departureIso(departure))) {
      setPastError(true);
      return;
    }
    sending.current = true;
    create.mutate(
      buildNewPlan({
        puntId,
        esdevenimentId: chosenEvent?.id ?? null,
        departure,
        durationMs,
        notes,
      }),
    );
  };

  const errorKey = create.isError ? planErrorKey(create.error) : null;
  const pointData = point.data;

  return {
    header: t('plans.new.header'),
    title: t('plans.new.title'),
    backLabel: t('plans.new.back'),
    point: {
      label: t('plans.new.point'),
      loading: !pointData && point.isPending,
      name: pointData?.nom ?? (point.isError ? t('plans.new.pointUnavailable') : ''),
      accessibilityLabel: pointData
        ? t('plans.new.pointA11y', { name: pointData.nom, municipality: pointData.municipi })
        : t('plans.new.point'),
    },
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
    pastMessage: pastError || past ? t('plans.new.past') : undefined,
    event: {
      label: t('plans.new.event'),
      value: chosenEvent ? eventLabel(chosenEvent) : t('plans.new.noEvent'),
      icon: chosenEvent ? eventAppearance(chosenEvent).icon : filterIcons.meteor,
      onPress: () => setSheet('event'),
    },
    notes: {
      label: t('plans.new.notes'),
      placeholder: t('plans.new.notesPlaceholder'),
      value: notes,
      maxLength: NOTES_MAX,
      onChange: setNotes,
    },
    save: {
      label: create.isPending ? t('plans.new.saving') : t('plans.new.save'),
      disabled: create.isPending || past || !puntId.trim(),
      onPress: save,
    },
    error: errorKey ? t(`plans.new.errors.${errorKey}`) : undefined,
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
      status: events.isPending ? 'loading' : events.isError ? 'error' : 'ok',
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

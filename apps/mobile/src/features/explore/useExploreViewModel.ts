import type { ConsultaRecomanacions, ObjectiuObservacio } from '@talaia/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking } from 'react-native';

import type { CalendarMonth } from '@/shared/ui/calendarGrid';

import {
  addDays,
  CALENDAR_DAYS,
  DAY_CHOICES,
  type DayChoice,
  dayParts,
  DEFAULT_RANGE,
  formatHour,
  greetingFor,
  GRID_GOALS,
  HOURS,
  nightOf,
  rangeHours,
  roundCoord,
  SOON_GOALS,
  stepHour,
  TRAVEL,
  travelParts,
} from './exploreModel';
import { useCurrentPlaceQuery } from './locationRepository';

/** «Què vols veure?» (HU01, mockup 02): què, des d'on, quan i fins on. */
export function useExploreViewModel() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const tonight = nightOf(now);

  const [goal, setGoal] = useState<ObjectiuObservacio>('cel_estrellat');
  const [day, setDay] = useState<DayChoice>('tonight');
  const [pickedNight, setPickedNight] = useState(() => addDays(tonight, 2));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [range, setRange] = useState<{ from: number; to: number }>(DEFAULT_RANGE);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [travel, setTravel] = useState<number>(TRAVEL.initial);

  const location = useCurrentPlaceQuery();
  const { refetch } = location;
  const placeReady = location.data?.status === 'ready';

  // La pestanya es queda muntada hores: en tornar a l'app, «aquesta nit» i la salutació es
  // recalculen, i si faltava la ubicació (permís, GPS) es torna a provar.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(new Date());
      if (!placeReady) void refetch();
    });
    return () => subscription.remove();
  }, [placeReady, refetch]);

  // Una nit triada que ja ha passat (l'app ha estat oberta dies) torna a ser aquesta nit.
  const picked = pickedNight < tonight ? tonight : pickedNight;
  const night = day === 'tonight' ? tonight : day === 'tomorrow' ? addDays(tonight, 1) : picked;
  const place = location.data?.status === 'ready' ? location.data.place : null;

  const origin = (() => {
    if (location.isPending) {
      return { state: 'loading' as const, label: t('explore.origin.locating'), hint: '' };
    }
    if (location.isError) {
      return {
        state: 'error' as const,
        label: t('explore.origin.error'),
        hint: t('explore.origin.retry'),
        onPress: () => void refetch(),
      };
    }
    if (location.data.status === 'denied') {
      const { canAskAgain } = location.data;
      return {
        state: 'denied' as const,
        label: t('explore.origin.denied'),
        hint: canAskAgain ? t('explore.origin.allow') : t('explore.origin.settings'),
        // Si el sistema encara ho deixa, es torna a demanar el permís; si no, a la configuració.
        onPress: () => void (canAskAgain ? refetch() : Linking.openSettings()),
      };
    }
    return {
      state: 'ready' as const,
      label: location.data.place.name || t('explore.origin.here'),
      hint: t('explore.origin.current'),
    };
  })();

  const { hours, minutes } = travelParts(travel);
  const travelLabel = !hours
    ? t('explore.travel.minutes', { minutes })
    : minutes
      ? t('explore.travel.hoursMinutes', { hours, minutes })
      : t('explore.travel.hours', { hours });

  const weekdays = t('explore.weekdays', { returnObjects: true }) as string[];
  const months = t('explore.calendar.months', { returnObjects: true }) as string[];
  const monthsShort = t('explore.calendar.monthsShort', { returnObjects: true }) as string[];
  const monthsOf = t('explore.calendar.monthsOf', { returnObjects: true }) as string[];
  const monthOfDate = (date: string) => Number(date.slice(5, 7)) - 1;

  const chooseNight = (date: string) => {
    if (date === tonight) setDay('tonight');
    else if (date === addDays(tonight, 1)) setDay('tomorrow');
    else {
      setPickedNight(date);
      setDay('pick');
    }
    setCalendarOpen(false);
  };

  // La franja dura almenys una hora: si una roda arriba a l'hora de l'altra, és l'altra la que es mou.
  const setRangeEnd = (end: 'from' | 'to', hour: number) =>
    setRange((current) => {
      const other = end === 'from' ? 'to' : 'from';
      const next = { ...current, [end]: hour };
      if (next[other] === hour) next[other] = stepHour(hour, end === 'from' ? 1 : -1);
      return next;
    });

  const search = () => {
    if (!place) return;
    const query: ConsultaRecomanacions = {
      objectiu: goal,
      origen: { lat: roundCoord(place.lat), lon: roundCoord(place.lon) },
      data: night,
      desDe: range.from,
      finsA: range.to,
      tempsMaxim: travel,
    };
    router.push({
      pathname: '/recomanacions',
      params: {
        objectiu: query.objectiu,
        lat: String(query.origen.lat),
        lon: String(query.origen.lon),
        data: query.data,
        desDe: String(query.desDe),
        finsA: String(query.finsA),
        tempsMaxim: String(query.tempsMaxim),
        // Només per a la capçalera del mapa («Des de Girona…»): no va a l'API.
        ...(place.name ? { lloc: place.name } : {}),
      },
    });
  };

  return {
    greeting: t(`explore.greeting.${greetingFor(now)}`),
    title: t('explore.title'),
    goals: GRID_GOALS.map((id) => {
      const soon = SOON_GOALS.includes(id);
      return {
        id,
        label: t(`explore.goals.${id}`),
        badge: soon ? t('explore.soon') : undefined,
        disabled: soon,
        selected: goal === id,
        onPress: () => {
          if (!soon) setGoal(id);
        },
      };
    }),
    constellations: {
      label: t('explore.goals.constellacions'),
      hint: t('explore.constellationsHint'),
      badge: t('explore.new'),
      selected: goal === 'constellacions',
      onPress: () => setGoal('constellacions'),
    },
    originTitle: t('explore.origin.title'),
    origin,
    whenTitle: t('explore.when.title'),
    days: {
      options: DAY_CHOICES.map((choice) => {
        if (choice !== 'pick' || day !== 'pick') return t(`explore.when.${choice}`);
        const { weekday, day: dayOfMonth } = dayParts(picked);
        return t('explore.when.picked', {
          weekday: weekdays[weekday],
          day: dayOfMonth,
          month: monthsShort[monthOfDate(picked)],
        });
      }),
      selectedIndex: DAY_CHOICES.indexOf(day),
      // «Tria el dia» obre el calendari; fins que no se'n tria un, es queda la nit d'abans.
      onChange: (index: number) => {
        const choice = DAY_CHOICES[index] ?? 'tonight';
        if (choice === 'pick') setCalendarOpen(true);
        else setDay(choice);
      },
      onReselect: (index: number) => {
        if (DAY_CHOICES[index] === 'pick') setCalendarOpen(true);
      },
    },
    calendar: {
      visible: calendarOpen,
      title: t('explore.calendar.title'),
      closeLabel: t('explore.calendar.close'),
      value: night,
      today: tonight,
      min: tonight,
      max: addDays(tonight, CALENDAR_DAYS),
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
      onChange: chooseNight,
      onClose: () => setCalendarOpen(false),
    },
    range: {
      label: t('explore.when.range', { from: formatHour(range.from), to: formatHour(range.to) }),
      hint: t('explore.when.rangeHint'),
      onPress: () => setRangeOpen(true),
    },
    rangeSheet: {
      visible: rangeOpen,
      title: t('explore.rangeSheet.title'),
      hours: HOURS,
      format: formatHour,
      wheels: (['from', 'to'] as const).map((end) => ({
        end,
        label: t(`explore.rangeSheet.${end}`),
        value: range[end],
        onChange: (hour: number) => setRangeEnd(end, hour),
      })),
      duration: t('explore.rangeSheet.duration', { count: rangeHours(range.from, range.to) }),
      doneLabel: t('explore.rangeSheet.done'),
      onClose: () => setRangeOpen(false),
    },
    travel: {
      title: t('explore.travel.title'),
      label: travelLabel,
      value: travel,
      min: TRAVEL.min,
      max: TRAVEL.max,
      step: TRAVEL.step,
      minLabel: t('explore.travel.min'),
      maxLabel: t('explore.travel.max'),
      onChange: setTravel,
    },
    cta: { label: t('explore.cta'), disabled: !place, onPress: search },
    // HU06: el mapa s'ha de poder explorar sense cercar, també sense ubicació.
    browse: { label: t('explore.browse'), onPress: () => router.push('/recomanacions') },
  };
}

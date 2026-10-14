import type { ConsultaRecomanacions, ObjectiuObservacio } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import {
  addDays,
  DAY_CHOICES,
  type DayChoice,
  dayParts,
  DEFAULT_RANGE,
  formatHour,
  greetingFor,
  GRID_GOALS,
  nightOf,
  PICKABLE_NIGHTS,
  rangeHours,
  stepHour,
  TRAVEL,
  travelParts,
} from './exploreModel';
import { getCurrentPlace } from './locationRepository';

export const CURRENT_PLACE_KEY = ['ubicacio-actual'] as const;

/** «Què vols veure?» (HU01, mockup 02): què, des d'on, quan i fins on. */
export function useExploreViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const tonight = nightOf(now);

  const [goal, setGoal] = useState<ObjectiuObservacio>('cel_estrellat');
  const [day, setDay] = useState<DayChoice>('tonight');
  const [pickedNight, setPickedNight] = useState(() => addDays(tonight, 2));
  const [range, setRange] = useState<{ from: number; to: number }>(DEFAULT_RANGE);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [travel, setTravel] = useState<number>(TRAVEL.initial);

  const location = useQuery({
    queryKey: CURRENT_PLACE_KEY,
    queryFn: getCurrentPlace,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const night =
    day === 'tonight' ? tonight : day === 'tomorrow' ? addDays(tonight, 1) : pickedNight;
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
        onPress: () => void location.refetch(),
      };
    }
    if (!place) {
      return {
        state: 'denied' as const,
        label: t('explore.origin.denied'),
        hint: t('explore.origin.settings'),
        onPress: () => void Linking.openSettings(),
      };
    }
    return {
      state: 'ready' as const,
      label: place.name || t('explore.origin.here'),
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
  const nightLabel = (date: string) => {
    const { weekday, day: dayOfMonth } = dayParts(date);
    return `${weekdays[weekday]} ${dayOfMonth}`;
  };

  const moveRange = (end: 'from' | 'to', delta: number) =>
    setRange((current) => {
      const next = { ...current, [end]: stepHour(current[end], delta) };
      // La franja dura almenys una hora: si els dos extrems es troben, es passa de llarg.
      if (next.from === next.to) next[end] = stepHour(next[end], delta);
      return next;
    });

  const search = () => {
    if (!place) return;
    const query: ConsultaRecomanacions = {
      objectiu: goal,
      origen: { lat: place.lat, lon: place.lon },
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
      },
    });
  };

  return {
    greeting: t(`explore.greeting.${greetingFor(now)}`),
    title: t('explore.title'),
    goals: GRID_GOALS.map((id) => ({
      id,
      label: t(`explore.goals.${id}`),
      selected: goal === id,
      onPress: () => setGoal(id),
    })),
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
      options: DAY_CHOICES.map((choice) => t(`explore.when.${choice}`)),
      selectedIndex: DAY_CHOICES.indexOf(day),
      onChange: (index: number) => setDay(DAY_CHOICES[index] ?? 'tonight'),
    },
    pickableNights:
      day === 'pick'
        ? Array.from({ length: PICKABLE_NIGHTS }, (_, i) => {
            const date = addDays(tonight, i + 2);
            return {
              date,
              label: nightLabel(date),
              selected: date === pickedNight,
              onPress: () => setPickedNight(date),
            };
          })
        : [],
    range: {
      label: t('explore.when.range', { from: formatHour(range.from), to: formatHour(range.to) }),
      hint: t('explore.when.rangeHint'),
      onPress: () => setRangeOpen(true),
    },
    rangeSheet: {
      visible: rangeOpen,
      title: t('explore.rangeSheet.title'),
      rows: (['from', 'to'] as const).map((end) => ({
        end,
        label: t(`explore.rangeSheet.${end}`),
        value: formatHour(range[end]),
        earlierLabel: t('explore.rangeSheet.earlier'),
        laterLabel: t('explore.rangeSheet.later'),
        onEarlier: () => moveRange(end, -1),
        onLater: () => moveRange(end, 1),
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
  };
}

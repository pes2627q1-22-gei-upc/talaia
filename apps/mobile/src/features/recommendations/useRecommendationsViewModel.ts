import type { FranjaIndex } from '@talaia/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';

import { addDays, dayParts, nightOf, travelParts } from '../explore/exploreModel';
import { EMPTY_MAP_POINTS } from '../map/pointMarkers';

import {
  boundsOf,
  localTime,
  ordinal,
  parseQuery,
  type RecommendationParams,
  toMapPoints,
  VISIBLE_ROWS,
} from './recommendationsModel';
import { useRecommendationsQuery } from './recommendationsRepository';

const LEGEND: readonly FranjaIndex[] = ['ras', 'jus', 'tap'];

/**
 * Rànquing de «Què vols veure?» sobre el mapa (HU01, mockup 03): capçalera amb la cerca, marcadors
 * i full amb els millors punts. `null` si la ruta no porta cap cerca («Mostra el mapa»).
 */
export function useRecommendationsViewModel() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<RecommendationParams>();
  const query = parseQuery(params);
  const result = useRecommendationsQuery(query);
  const [expanded, setExpanded] = useState(false);
  // Plegat, el full només ensenya el títol: el mapa queda gairebé sencer.
  const [collapsed, setCollapsed] = useState(false);
  const data = result.data;
  const points = useMemo(() => (data ? toMapPoints(data.punts) : EMPTY_MAP_POINTS), [data]);
  const originLat = query?.origen.lat;
  const originLon = query?.origen.lon;
  // El mapa s'enquadra als punts del rànquing i a l'origen, perquè es vegi d'on surts.
  const bounds = useMemo(
    () =>
      data?.punts.length && originLat !== undefined && originLon !== undefined
        ? boundsOf([...data.punts, { lat: originLat, lon: originLon }])
        : null,
    [data, originLat, originLon],
  );

  if (!query) return null;

  const duration = (total: number) => {
    const { hours, minutes } = travelParts(total);
    if (!hours) return t('recommendations.duration.minutes', { minutes });
    return minutes
      ? t('recommendations.duration.hoursMinutes', { hours, minutes })
      : t('recommendations.duration.hours', { hours });
  };

  const eventSearch = 'esdevenimentId' in query;
  const date = eventSearch ? data?.data : query.data;
  const tonight = nightOf(new Date());
  const when = (() => {
    if (!date) return params.eventWhen ?? t('event.title');
    if (date === tonight) return t('recommendations.when.tonight');
    if (date === addDays(tonight, 1)) return t('recommendations.when.tomorrow');
    const { weekday, day } = dayParts(date);
    const weekdays = t('explore.weekdays', { returnObjects: true }) as string[];
    const months = t('explore.calendar.monthsShort', { returnObjects: true }) as string[];
    const month = months[Number(date.slice(5, 7)) - 1];
    return t('explore.when.picked', { weekday: weekdays[weekday], day, month });
  })();
  const travel = query.tempsMaxim === undefined ? null : duration(query.tempsMaxim);
  const placeContext = /^[aeiouàèéíïòóúü]/i.test(params.lloc?.trim() ?? '') ? 'vowel' : undefined;
  const pastWindow = result.error instanceof ApiError && result.error.code === 'franja_passada';

  const punts = data?.punts ?? [];
  const rows = (expanded ? punts : punts.slice(0, VISIBLE_ROWS)).map((punt, position) => {
    const { millorHora } = punt;
    const rank = ordinal(position + 1, i18n.language);
    const hour = millorHora ? localTime(millorHora.hora) : null;
    const time = duration(punt.tempsEstimat);
    const distance = eventSearch
      ? t('recommendations.distance', {
          km: new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ca', {
            maximumFractionDigits: 1,
          }).format(punt.distanciaKm),
        })
      : null;
    const index = millorHora
      ? t('index.a11y', {
          value: millorHora.valor,
          level: t(`index.level.${millorHora.franja}`),
        })
      : t('recommendations.noIndex');
    return {
      id: punt.id,
      name: punt.nom,
      index: millorHora,
      hour,
      travel: time,
      distance,
      rank,
      highlighted: position === 0 && data?.avis !== 'sense_previsio',
      accessibilityLabel: [
        `${rank}: ${punt.nom}`,
        index,
        hour && t('recommendations.bestHour', { hour }),
        distance,
        t('recommendations.byCar', { travel: time }),
      ]
        .filter(Boolean)
        .join('. '),
      onPress: () => router.push({ pathname: '/punt/[id]', params: { id: punt.id } }),
    };
  });

  const state =
    result.isPending || (result.isError && result.isFetching)
      ? ('loading' as const)
      : result.isError
        ? ('error' as const)
        : punts.length === 0
          ? ('empty' as const)
          : ('ready' as const);

  return {
    points,
    bounds,
    header: {
      title: eventSearch
        ? (params.eventName ?? t('event.title'))
        : t('recommendations.title', {
            goal: t(`explore.goals.${query.objectiu}`),
            when,
          }),
      eventDate: eventSearch ? when : null,
      subtitle:
        travel === null
          ? params.lloc
            ? t('recommendations.fromUnlimited', { place: params.lloc, context: placeContext })
            : t('recommendations.fromHereUnlimited')
          : params.lloc
            ? t('recommendations.from', { place: params.lloc, travel })
            : t('recommendations.fromHere', { travel }),
      legend: LEGEND.map((franja) => ({ franja, label: t(`index.level.${franja}`) })),
    },
    sheet: {
      title: t(eventSearch ? 'recommendations.eventRanking' : 'recommendations.best', { when }),
      notice:
        data?.avis === 'sense_previsio'
          ? t('recommendations.noEventForecast')
          : eventSearch
            ? t('recommendations.qualityDistanceHint')
            : null,
      state,
      rows,
      loadingLabel: t('recommendations.loading'),
      errorLabel: t(pastWindow ? 'recommendations.pastWindow' : 'recommendations.error'),
      canRetry: !pastWindow,
      retryLabel: t('map.retry'),
      onRetry: () => void result.refetch(),
      emptyTitle: t(travel === null ? 'recommendations.emptyCatalog' : 'recommendations.empty', {
        travel,
      }),
      emptyHint: t(eventSearch ? 'recommendations.emptyEventHint' : 'recommendations.emptyHint'),
      collapsed,
      collapseLabel: t(
        eventSearch
          ? collapsed
            ? 'recommendations.showRanking'
            : 'recommendations.hideRanking'
          : collapsed
            ? 'recommendations.expandSheet'
            : 'recommendations.collapseSheet',
      ),
      onSetCollapsed: setCollapsed,
      onToggleCollapsed: () => setCollapsed((value) => !value),
      toggle:
        punts.length > VISIBLE_ROWS
          ? {
              label: t(expanded ? 'recommendations.showLess' : 'recommendations.showAll'),
              onPress: () => setExpanded((value) => !value),
            }
          : null,
    },
  };
}

export type RecommendationsViewModel = NonNullable<ReturnType<typeof useRecommendationsViewModel>>;

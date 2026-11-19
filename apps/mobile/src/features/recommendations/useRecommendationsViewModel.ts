import type { FranjaIndex } from '@talaia/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';

import { addDays, dayParts, nightOf } from '../explore/exploreModel';
import { EMPTY_MAP_POINTS } from '../map/pointMarkers';

import {
  boundsOf,
  elision,
  formatTravel,
  localTime,
  nearbyOrigin,
  ordinal,
  parseQuery,
  type RecommendationParams,
  toMapPoints,
  VISIBLE_ROWS,
} from './recommendationsModel';
import { useRecommendationsQuery } from './recommendationsRepository';

const LEGEND: readonly FranjaIndex[] = ['ras', 'jus', 'tap'];

/**
 * Rànquing sobre el mapa (mockup 03): capçalera amb la cerca, marcadors i full amb els millors
 * punts. El fa «Què vols veure?» (HU01) o «A prop meu» (HU02). `null` si la ruta no porta cap
 * cerca («Mostra el mapa»).
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

  const duration = (total: number) => formatTravel(t, total);

  const eventSearch = !!query.esdevenimentId;
  const nearby = eventSearch ? null : nearbyOrigin(params);
  const night = query.data ?? data?.data;
  const minutes = query.tempsMaxim ?? data?.tempsMaxim;
  const tonight = nightOf(new Date());
  const when = (() => {
    if (!night) return eventSearch ? (params.eventWhen ?? t('event.title')) : null;
    if (night === tonight) return t('recommendations.when.tonight');
    if (night === addDays(tonight, 1)) return t('recommendations.when.tomorrow');
    const { weekday, day } = dayParts(night);
    const weekdays = t('explore.weekdays', { returnObjects: true }) as string[];
    const months = t('explore.calendar.monthsShort', { returnObjects: true }) as string[];
    const month = months[Number(night.slice(5, 7)) - 1];
    return t('explore.when.picked', { weekday: weekdays[weekday], day, month });
  })();
  const travel = minutes == null ? null : duration(minutes);
  const title = eventSearch
    ? (params.eventName ?? t('event.title'))
    : nearby
      ? when
        ? t('recommendations.nearby.title', { when })
        : t('recommendations.nearby.label')
      : t('recommendations.title', {
          goal: t(`explore.goals.${query.objectiu ?? 'cel_estrellat'}`),
          when,
        });
  const subtitle = (() => {
    const place = params.lloc;
    if (!travel) {
      if (eventSearch)
        return place
          ? t('recommendations.fromUnlimited', { place, context: elision(place) })
          : t('recommendations.fromHereUnlimited');
      if (place) return t('recommendations.nearby.place', { place, context: elision(place) });
      return t(
        nearby === 'triat' ? 'recommendations.nearby.picked' : 'recommendations.nearby.here',
      );
    }
    if (place) return t('recommendations.from', { place, travel, context: elision(place) });
    return t(nearby === 'triat' ? 'recommendations.fromPicked' : 'recommendations.fromHere', {
      travel,
    });
  })();
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
      title,
      eventDate: eventSearch ? when : null,
      subtitle,
      legend: LEGEND.map((franja) => ({ franja, label: t(`index.level.${franja}`) })),
    },
    sheet: {
      title: eventSearch
        ? t('recommendations.eventRanking')
        : when
          ? t('recommendations.best', { when })
          : t('recommendations.nearby.best'),
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
      emptyTitle: travel
        ? t('recommendations.empty', { travel, context: elision(travel) })
        : eventSearch
          ? t('recommendations.emptyCatalog')
          : '',
      emptyHint: t(
        eventSearch
          ? 'recommendations.emptyEventHint'
          : nearby
            ? 'recommendations.nearby.emptyHint'
            : 'recommendations.emptyHint',
      ),
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

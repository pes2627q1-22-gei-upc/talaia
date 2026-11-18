import type { FranjaIndex } from '@talaia/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { addDays, dayParts, nightOf, travelParts } from '../explore/exploreModel';
import { EMPTY_MAP_POINTS } from '../map/pointMarkers';

import {
  boundsOf,
  elision,
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

  const duration = (total: number) => {
    const { hours, minutes } = travelParts(total);
    if (!hours) return t('recommendations.duration.minutes', { minutes });
    return minutes
      ? t('recommendations.duration.hoursMinutes', { hours, minutes })
      : t('recommendations.duration.hours', { hours });
  };

  // «A prop meu» no tria la nit ni la distància: les diu l'API en respondre (TG-133).
  const nearby = nearbyOrigin(params);
  const night = query.data ?? data?.data;
  const minutes = query.tempsMaxim ?? data?.tempsMaxim;
  const tonight = nightOf(new Date());
  const when = (() => {
    if (!night) return null;
    if (night === tonight) return t('recommendations.when.tonight');
    if (night === addDays(tonight, 1)) return t('recommendations.when.tomorrow');
    const { weekday, day } = dayParts(night);
    const weekdays = t('explore.weekdays', { returnObjects: true }) as string[];
    const months = t('explore.calendar.monthsShort', { returnObjects: true }) as string[];
    const month = months[Number(night.slice(5, 7)) - 1];
    return t('explore.when.picked', { weekday: weekdays[weekday], day, month });
  })();
  const travel = minutes === undefined ? null : duration(minutes);
  const title = nearby
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

  const punts = data?.punts ?? [];
  const rows = (expanded ? punts : punts.slice(0, VISIBLE_ROWS)).map((punt, position) => {
    const { millorHora } = punt;
    const rank = ordinal(position + 1, i18n.language);
    const hour = millorHora ? localTime(millorHora.hora) : null;
    const time = duration(punt.tempsEstimat);
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
      rank,
      highlighted: position === 0,
      accessibilityLabel: [
        `${rank}: ${punt.nom}`,
        index,
        hour && t('recommendations.bestHour', { hour }),
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
      subtitle,
      legend: LEGEND.map((franja) => ({ franja, label: t(`index.level.${franja}`) })),
    },
    sheet: {
      title: when ? t('recommendations.best', { when }) : t('recommendations.nearby.best'),
      state,
      rows,
      loadingLabel: t('recommendations.loading'),
      errorLabel: t('recommendations.error'),
      retryLabel: t('map.retry'),
      onRetry: () => void result.refetch(),
      emptyTitle: travel ? t('recommendations.empty', { travel, context: elision(travel) }) : '',
      // «A prop meu» no deixa triar la distància: per anar més lluny, «Què vols veure?».
      emptyHint: t(nearby ? 'recommendations.nearby.emptyHint' : 'recommendations.emptyHint'),
      collapsed,
      collapseLabel: t(collapsed ? 'recommendations.expandSheet' : 'recommendations.collapseSheet'),
      onToggleCollapsed: () => setCollapsed((value) => !value),
      toggle:
        !collapsed && punts.length > VISIBLE_ROWS
          ? {
              label: t(expanded ? 'recommendations.showLess' : 'recommendations.showAll'),
              onPress: () => setExpanded((value) => !value),
            }
          : null,
    },
  };
}

export type RecommendationsViewModel = NonNullable<ReturnType<typeof useRecommendationsViewModel>>;

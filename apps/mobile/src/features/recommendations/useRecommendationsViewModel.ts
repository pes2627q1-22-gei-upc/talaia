import type { FranjaIndex } from '@talaia/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
 * i full amb els millors punts. `null` si la ruta no porta cap cerca («Veure el mapa»).
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

  const tonight = nightOf(new Date());
  const when = (() => {
    if (query.data === tonight) return t('recommendations.when.tonight');
    if (query.data === addDays(tonight, 1)) return t('recommendations.when.tomorrow');
    const { weekday, day } = dayParts(query.data);
    const weekdays = t('explore.weekdays', { returnObjects: true }) as string[];
    const months = t('explore.calendar.monthsShort', { returnObjects: true }) as string[];
    const month = months[Number(query.data.slice(5, 7)) - 1];
    return t('explore.when.picked', { weekday: weekdays[weekday], day, month });
  })();
  const travel = duration(query.tempsMaxim);

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
      title: t('recommendations.title', { goal: t(`explore.goals.${query.objectiu}`), when }),
      subtitle: params.lloc
        ? t('recommendations.from', { place: params.lloc, travel })
        : t('recommendations.fromHere', { travel }),
      legend: LEGEND.map((franja) => ({ franja, label: t(`index.level.${franja}`) })),
    },
    sheet: {
      title: t('recommendations.best', { when }),
      state,
      rows,
      loadingLabel: t('recommendations.loading'),
      errorLabel: t('recommendations.error'),
      retryLabel: t('map.retry'),
      onRetry: () => void result.refetch(),
      emptyTitle: t('recommendations.empty', { travel }),
      emptyHint: t('recommendations.emptyHint'),
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

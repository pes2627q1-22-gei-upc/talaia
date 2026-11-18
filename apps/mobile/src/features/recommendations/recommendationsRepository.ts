import type { RecomanacionsResposta } from '@talaia/shared';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiGet } from '@/core/api/httpClient';

import type { RecommendationQuery } from './recommendationsModel';

const HOUR_MS = 60 * 60 * 1000;

export const recommendationsKeys = {
  list: (query: RecommendationQuery | null, language: string) =>
    ['recommendations', query, language] as const,
};

/** `GET /recomanacions` (TG-100): el rànquing dins del radi, de millor a pitjor. */
export function fetchRecommendations({ origen, ...query }: RecommendationQuery) {
  return apiGet<RecomanacionsResposta>('/recomanacions', {
    ...query,
    lat: origen.lat,
    lon: origen.lon,
  });
}

/** L'índex es recalcula cada hora (TG-99): el rànquing val fins al següent canvi d'hora. */
export function useRecommendationsQuery(query: RecommendationQuery | null) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: recommendationsKeys.list(query, i18n.resolvedLanguage ?? 'ca'),
    queryFn: query ? () => fetchRecommendations(query) : skipToken,
    staleTime: (state) => HOUR_MS - (state.state.dataUpdatedAt % HOUR_MS),
  });
}

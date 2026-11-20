import type { ParametresRecomanacions, RecomanacionsResposta } from '@talaia/shared';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiGet } from '@/core/api/httpClient';

const HOUR_MS = 60 * 60 * 1000;

export const recommendationsKeys = {
  list: (query: ParametresRecomanacions | null, language: string) =>
    ['recommendations', query, language] as const,
};

/**
 * `GET /recomanacions` (TG-100): el rànquing dins del radi, de millor a pitjor. Amb només l'origen
 * («A prop meu», TG-133), l'API tria la nit, la franja i la distància.
 */
export function fetchRecommendations({ origen, ...query }: ParametresRecomanacions) {
  return apiGet<RecomanacionsResposta>('/recomanacions', {
    ...query,
    lat: origen.lat,
    lon: origen.lon,
  });
}

/** L'índex es recalcula cada hora (TG-99): el rànquing val fins al següent canvi d'hora. */
export function useRecommendationsQuery(query: ParametresRecomanacions | null) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: recommendationsKeys.list(query, i18n.resolvedLanguage ?? 'ca'),
    queryFn: query ? () => fetchRecommendations(query) : skipToken,
    staleTime: (state) => HOUR_MS - (state.state.dataUpdatedAt % HOUR_MS),
  });
}

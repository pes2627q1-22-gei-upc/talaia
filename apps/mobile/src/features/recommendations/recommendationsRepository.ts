import type { ConsultaRecomanacions, RecomanacionsResposta } from '@talaia/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

const HOUR_MS = 60 * 60 * 1000;

export const recommendationsKeys = {
  list: (query: ConsultaRecomanacions | null) => ['recommendations', query] as const,
};

/** `GET /recomanacions` (TG-100): el rànquing dins del radi, de millor a pitjor. */
export function fetchRecommendations({ origen, ...query }: ConsultaRecomanacions) {
  return apiGet<RecomanacionsResposta>('/recomanacions', {
    ...query,
    lat: origen.lat,
    lon: origen.lon,
  });
}

/** L'índex es recalcula cada hora (TG-99): el rànquing val fins al següent canvi d'hora. */
export function useRecommendationsQuery(query: ConsultaRecomanacions | null) {
  return useQuery({
    queryKey: recommendationsKeys.list(query),
    queryFn: query ? () => fetchRecommendations(query) : skipToken,
    staleTime: (state) => HOUR_MS - (state.state.dataUpdatedAt % HOUR_MS),
  });
}

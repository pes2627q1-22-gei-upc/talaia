import type { PuntFitxa } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

import type { PointDetailModel } from './pointModel';

export const pointKeys = {
  detail: (pointId: string) => ['punts', 'detail', pointId] as const,
};

/** El worker publica l'índex cada hora al minut 5; deixem 30 s de marge. */
export function millisecondsUntilNextPointRefresh(now = Date.now()) {
  const next = new Date(now);
  next.setUTCMinutes(5, 30, 0);
  if (next.getTime() <= now) next.setUTCHours(next.getUTCHours() + 1);
  return next.getTime() - now;
}

export async function fetchPointDetail(
  pointId: string,
  signal?: AbortSignal,
): Promise<PointDetailModel> {
  const fitxa = await apiGet<PuntFitxa>(`/punts/${encodeURIComponent(pointId)}`, undefined, {
    signal,
  });
  return {
    id: fitxa.id,
    nom: fitxa.nom,
    municipi: fitxa.municipi,
    lat: fitxa.lat,
    lon: fitxa.lon,
    descripcio: fitxa.descripcio,
    altitud: fitxa.altitud,
    sqm: fitxa.sqm,
    horitzoObert: fitxa.horitzoObert,
    accessibilitat: fitxa.accessibilitat,
    indexActual: fitxa.index.actual,
    properesHores: fitxa.index.properesHores,
  };
}

export function usePointDetailQuery(pointId: string) {
  return useQuery({
    queryKey: pointKeys.detail(pointId),
    queryFn: ({ signal }) => fetchPointDetail(pointId, signal),
    enabled: pointId.trim().length > 0,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data ? millisecondsUntilNextPointRefresh() : false),
  });
}

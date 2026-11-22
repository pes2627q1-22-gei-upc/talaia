import type { DesglossamentIndex, PuntFitxa, RutesPunt } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ApiError, apiGet } from '@/core/api/httpClient';

import type { PointDetailModel } from './pointModel';

export const pointKeys = {
  detail: (pointId: string, language: string) => ['punts', 'detail', pointId, language] as const,
  breakdown: (pointId: string) => ['punts', 'breakdown', pointId] as const,
  routes: (pointId: string, lat: number, lon: number, departure?: string) =>
    ['punts', 'routes', pointId, lat.toFixed(3), lon.toFixed(3), departure ?? 'now'] as const,
};

export function usePointRoutesQuery(
  pointId: string,
  origin?: { lat: number; lon: number },
  departure?: string,
) {
  return useQuery({
    queryKey: pointKeys.routes(pointId, origin?.lat ?? 0, origin?.lon ?? 0, departure),
    queryFn: ({ signal }) =>
      apiGet<RutesPunt>(
        `/punts/${encodeURIComponent(pointId)}/rutes`,
        { lat: origin!.lat, lon: origin!.lon, sortida: departure },
        { signal },
      ),
    enabled: pointId.trim().length > 0 && !!origin,
    staleTime: departure ? 5 * 60_000 : 0,
    retry: (count, error) => error instanceof ApiError && error.status === 429 && count < 1,
    retryDelay: 5_000,
  });
}

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
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: pointKeys.detail(pointId, i18n.resolvedLanguage ?? 'ca'),
    queryFn: ({ signal }) => fetchPointDetail(pointId, signal),
    enabled: pointId.trim().length > 0,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data ? millisecondsUntilNextPointRefresh() : false),
  });
}

/** `GET /punts/{id}/index` (TG-104): l'índex d'aquesta nit hora a hora, amb els factors. */
export function fetchPointBreakdown(pointId: string, signal?: AbortSignal) {
  return apiGet<DesglossamentIndex>(`/punts/${encodeURIComponent(pointId)}/index`, undefined, {
    signal,
  });
}

export function usePointBreakdownQuery(pointId: string) {
  return useQuery({
    queryKey: pointKeys.breakdown(pointId),
    queryFn: ({ signal }) => fetchPointBreakdown(pointId, signal),
    enabled: pointId.trim().length > 0,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data ? millisecondsUntilNextPointRefresh() : false),
  });
}

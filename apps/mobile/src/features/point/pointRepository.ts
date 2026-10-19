import type { IndexHora, PuntDetall } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

export const pointKeys = {
  detail: (pointId: string) => ['punts', 'detail', pointId] as const,
};

/** Forma exacta de la resposta de TG-92 fins que `PuntFitxa` arribi a `@talaia/shared`. */
type PuntFitxaResponse = Pick<
  PuntDetall,
  'id' | 'nom' | 'municipi' | 'lat' | 'lon' | 'descripcio' | 'altitud'
> & {
  horitzoObert: NonNullable<PuntDetall['horitzoObert']> | null;
  accessibilitat: string | null;
  sqm: number | null;
  index: { actual: IndexHora | null; properesHores: IndexHora[] };
};

export async function fetchPointDetail(pointId: string, signal?: AbortSignal): Promise<PuntDetall> {
  const fitxa = await apiGet<PuntFitxaResponse>(
    `/punts/${encodeURIComponent(pointId)}`,
    undefined,
    {
      signal,
    },
  );
  return {
    id: fitxa.id,
    nom: fitxa.nom,
    municipi: fitxa.municipi,
    lat: fitxa.lat,
    lon: fitxa.lon,
    descripcio: fitxa.descripcio,
    altitud: fitxa.altitud,
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
    // La fitxa pot quedar oberta mentre canvia l'hora de l'índex.
    refetchInterval: (query) => (query.state.data ? 60_000 : false),
  });
}

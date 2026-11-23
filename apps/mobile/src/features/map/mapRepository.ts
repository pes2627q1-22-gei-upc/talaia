import type { PuntsMapaGeoJson } from '@talaia/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiGet } from '@/core/api/httpClient';

const HOUR_MS = 60 * 60 * 1000;

export const mapKeys = {
  points: (language: string) => ['map', 'points', language] as const,
};

/** Tot el catàleg en una sola petició; moure el mapa no canvia la consulta. */
export function fetchMapPoints(revalidate = false): Promise<PuntsMapaGeoJson> {
  if (revalidate) {
    // Un reintent després d'un catàleg buit també ha de revalidar la memòria cau HTTP.
    return apiGet<PuntsMapaGeoJson>('/punts', undefined, {
      headers: { 'Cache-Control': 'no-cache' },
    });
  }
  return apiGet<PuntsMapaGeoJson>('/punts');
}

/** Reutilitza el GeoJSON fins al següent canvi d'hora (ADR-0012). */
export function useMapPointsQuery(enabled = true) {
  const client = useQueryClient();
  const { i18n } = useTranslation();
  const key = mapKeys.points(i18n.resolvedLanguage ?? 'ca');
  return useQuery({
    enabled,
    queryKey: key,
    queryFn: () =>
      fetchMapPoints(client.getQueryData<PuntsMapaGeoJson>(key)?.features.length === 0),
    // Excepció per al catàleg buit: permet recuperar punts acabats de publicar.
    staleTime: (query) =>
      query.state.data?.features.length === 0
        ? 30_000
        : HOUR_MS - (query.state.dataUpdatedAt % HOUR_MS),
    // Conserva les dades quan l'usuari surt del mapa i hi torna dins de la mateixa hora.
    gcTime: HOUR_MS,
  });
}

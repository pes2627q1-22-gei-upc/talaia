import type { PuntsMapaGeoJson } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

const HOUR_MS = 60 * 60 * 1000;

export const mapKeys = {
  points: ['map', 'points'] as const,
};

/** Tot el catàleg en una sola petició; moure el mapa no canvia la consulta. */
export function fetchMapPoints(): Promise<PuntsMapaGeoJson> {
  return apiGet<PuntsMapaGeoJson>('/punts');
}

/** Reutilitza el GeoJSON fins al següent canvi d'hora (ADR-0012). */
export function useMapPointsQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: mapKeys.points,
    queryFn: fetchMapPoints,
    staleTime: (query) => HOUR_MS - (query.state.dataUpdatedAt % HOUR_MS),
    // Conserva les dades quan l'usuari surt del mapa i hi torna dins de la mateixa hora.
    gcTime: HOUR_MS,
  });
}

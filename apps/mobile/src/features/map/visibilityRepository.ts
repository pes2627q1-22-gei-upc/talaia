import type { VisibilitatUbicacio } from '@talaia/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

const HOUR_MS = 60 * 60 * 1000;
// Marge perquè un rellotge del mòbil una mica avançat no demani encara l'hora anterior.
const HOUR_MARGIN_MS = 30_000;

/** Un lloc triat al mapa. Graus WGS84. */
export type Spot = { lat: number; lon: number };

export const visibilityKeys = {
  spot: (spot: Spot) => ['visibility', spot.lat, spot.lon] as const,
};

/** Fins al canvi d'hora (UTC i Catalunya canvien d'hora alhora), amb el marge. */
export const millisecondsUntilNextHour = (now = Date.now()) =>
  HOUR_MS - (now % HOUR_MS) + HOUR_MARGIN_MS;

/**
 * `GET /visibilitat` (TG-130): l'índex d'un lloc qualsevol de Catalunya per a l'hora en curs. Les
 * coordenades van tal com s'han tocat: l'API mira si són a Catalunya abans d'arrodonir-les a la
 * cel·la de 0,01°, i una cel·la de la costa o de la frontera pot quedar a fora encara que el toc no.
 */
export function fetchVisibility(spot: Spot) {
  return apiGet<VisibilitatUbicacio>('/visibilitat', { lat: spot.lat, lon: spot.lon });
}

/**
 * L'índex del lloc triat, quan es demana (`spot` no nul). Mentre la targeta és oberta, es torna a
 * demanar en canviar d'hora. Sense reintents: cada consulta nova compta per al límit horari de
 * l'API, i el reintent el fa l'usuari.
 */
export function useVisibilityQuery(spot: Spot | null) {
  return useQuery({
    queryKey: spot ? visibilityKeys.spot(spot) : ['visibility', null],
    queryFn: spot ? () => fetchVisibility(spot) : skipToken,
    staleTime: (query) => millisecondsUntilNextHour(query.state.dataUpdatedAt),
    refetchInterval: (query) => (query.state.data ? millisecondsUntilNextHour() : false),
    retry: false,
  });
}

import type { VisibilitatUbicacio } from '@talaia/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

const HOUR_MS = 60 * 60 * 1000;

/** Un lloc triat al mapa. Graus WGS84. */
export type Spot = { lat: number; lon: number };

/** La cel·la de l'API és de 0,01° (~1 km): dos tocs dins de la mateixa cel·la són la mateixa consulta. */
export const cell = (degrees: number) => Math.round(degrees * 100) / 100;

export const visibilityKeys = {
  spot: (spot: Spot) => ['visibility', cell(spot.lat), cell(spot.lon)] as const,
};

/** `GET /visibilitat` (TG-130): l'índex d'un lloc qualsevol de Catalunya per a l'hora en curs. */
export function fetchVisibility(spot: Spot) {
  return apiGet<VisibilitatUbicacio>('/visibilitat', { lat: cell(spot.lat), lon: cell(spot.lon) });
}

/**
 * L'índex del lloc triat, quan es demana (`spot` no nul). El mateix lloc surt de la memòria de
 * l'app fins al canvi d'hora, i després es torna a demanar. Sense reintents: cada consulta nova
 * compta per al límit horari de l'API, i el reintent el fa l'usuari.
 */
export function useVisibilityQuery(spot: Spot | null) {
  return useQuery({
    queryKey: spot ? visibilityKeys.spot(spot) : ['visibility', null],
    queryFn: spot ? () => fetchVisibility(spot) : skipToken,
    staleTime: (state) => HOUR_MS - (state.state.dataUpdatedAt % HOUR_MS),
    retry: false,
  });
}

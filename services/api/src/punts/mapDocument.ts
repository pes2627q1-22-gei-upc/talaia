import type { PuntsMapaGeoJson } from '@talaia/shared';

import type { PuntMapa } from './puntsRepository';

/** Caixa en graus WGS84 (`?bbox=minLon,minLat,maxLon,maxLat`). */
export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** 6 decimals ≈ 10 cm: més precisió no aporta res al mapa i engreixa el document. */
const arrodoneix = (graus: number) => Math.round(graus * 1e6) / 1e6;

/** El GeoJSON del mapa (ADR-0012), amb l'índex de l'hora en curs que ha desat el worker (TG-99). */
export function buildMapDocument(punts: PuntMapa[]): PuntsMapaGeoJson {
  return {
    type: 'FeatureCollection',
    features: punts.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [arrodoneix(p.lon), arrodoneix(p.lat)] },
      properties: { id: p.id, nom: p.nom, municipi: p.municipi, index: p.index },
    })),
  };
}

/** Retalla la col·lecció en memòria; no consulta la base de dades (ADR-0012). */
export function filterByBbox(doc: PuntsMapaGeoJson, bbox: Bbox): PuntsMapaGeoJson {
  return {
    type: 'FeatureCollection',
    features: doc.features.filter(
      ({
        geometry: {
          coordinates: [lon, lat],
        },
      }) => {
        return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
      },
    ),
  };
}

import type { PuntObservacio, PuntsMapaGeoJson } from '@talaia/shared';

/** Caixa en graus WGS84 (`?bbox=minLon,minLat,maxLon,maxLat`). */
export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** 6 decimals ≈ 10 cm: més precisió no aporta res al mapa i engreixa el document. */
const arrodoneix = (graus: number) => Math.round(graus * 1e6) / 1e6;

/** El GeoJSON del mapa (ADR-0012). L'índex és `null` fins que el calculi el worker (TG-98, TG-99). */
export function buildMapDocument(punts: PuntObservacio[]): PuntsMapaGeoJson {
  return {
    type: 'FeatureCollection',
    features: punts.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [arrodoneix(p.lon), arrodoneix(p.lat)] },
      properties: { id: p.id, nom: p.nom, municipi: p.municipi, index: null },
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

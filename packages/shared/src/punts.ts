import type { IndexVisibilitat } from './indexVisibilitat';

/**
 * Punt d'observació del catàleg.
 * Mínim provisional: la resta de metadades (accés, foscor, horitzó…) depenen de P13 (TG-87)
 * i del model de dades de TG-86.
 */
export type PuntObservacio = {
  id: string;
  nom: string;
  municipi: string;
  /** Graus WGS84. */
  lat: number;
  lon: number;
};

/** Propietats de cada punt al GeoJSON del mapa: només el que cal per dibuixar-lo i cercar-lo. */
export type PuntMapaPropietats = Pick<PuntObservacio, 'id' | 'nom' | 'municipi'> & {
  /**
   * Índex de l'hora en curs, de l'última execució del worker (TG-99). `null` = encara no s'ha
   * calculat. L'app pinta el marcador en gris.
   */
  index: IndexVisibilitat | null;
};

export type PuntMapaFeature = {
  type: 'Feature';
  /** GeoJSON posa la longitud primer: `[lon, lat]`. */
  geometry: { type: 'Point'; coordinates: [lon: number, lat: number] };
  properties: PuntMapaPropietats;
};

/** `GET /api/v1/punts`: tots els punts del catàleg en un sol document (ADR-0012). */
export type PuntsMapaGeoJson = {
  type: 'FeatureCollection';
  features: PuntMapaFeature[];
};

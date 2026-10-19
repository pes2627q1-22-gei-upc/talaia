import type { IndexHora, IndexVisibilitat } from './indexVisibilitat';

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
   * Índex actual (l'última execució del worker). `null` = encara no s'ha calculat:
   * la fórmula és TG-98 i el worker horari TG-99. L'app pinta el marcador en gris.
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

/**
 * Model intern de la fitxa a TG-93. El repository adapta la resposta `PuntFitxa`
 * de TG-92 a aquesta forma fins que el tipus compartit arribi a la branca.
 */
export type PuntDetall = PuntObservacio & {
  descripcio: string;
  /** Text d'accés al punt; `null` si no n'hi ha. */
  accessibilitat: string | null;
  /** Direccions amb l'horitzó obert; `null` si no se'n coneixen. */
  horitzoObert: Array<'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'> | null;
  /** Metres sobre el nivell del mar; `null` si el catàleg no en té. */
  altitud: number | null;
  /** `null` fins que hi hagi un càlcul disponible per a l'hora actual. */
  indexActual: IndexHora | null;
  /** Instants ISO 8601 en UTC. Un array buit indica que no hi ha previsió. */
  properesHores: IndexHora[];
};

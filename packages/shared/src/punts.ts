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
 * `GET /api/v1/punts/{id}/index`: l'índex d'un punt una nit, hora a hora i amb els factors que
 * l'expliquen (HU04, TG-104). És el que llegeix el component de desglossament (TG-105).
 */
export type DesglossamentIndex = {
  punt: Pick<PuntObservacio, 'id' | 'nom' | 'municipi'>;
  /** La nit (`YYYY-MM-DD`): el dia del vespre, com a `ConsultaRecomanacions.data`. */
  nit: string;
  /**
   * De les 12:00 locals de `nit` a les 12:00 de l'endemà (hora de Catalunya), en ordre. Només les
   * hores que el worker ha calculat: buit si encara no n'hi ha cap. Les de dia porten
   * `factors.sol = 0`, perquè es vegi a partir de quina hora comença a comptar la nit.
   */
  hores: IndexHora[];
};

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

/** Direccions de l'horitzó (`punts_observacio.horitzo_obert`). */
export type DireccioHoritzo = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** `GET /api/v1/punts/{id}`: la fitxa d'un punt publicat (HU07). */
export type PuntFitxa = PuntObservacio & {
  descripcio: string;
  /** Metres sobre el nivell del mar. */
  altitud: number | null;
  /** Direccions amb l'horitzó obert (aproximat, ADR-0017). `null` si no és clar. */
  horitzoObert: DireccioHoritzo[] | null;
  accessibilitat: string | null;
  /**
   * Foscor del cel: brillantor en mag/arcsec² (SQM, ADR-0020). Com més alta, més fosc.
   * `null` si encara no s'ha calculat per a aquest punt.
   */
  sqm: number | null;
  index: {
    /** L'índex de l'hora en curs (UTC). `null` si el worker encara no l'ha calculat. */
    actual: IndexHora | null;
    /** Les hores següents, en ordre. Buida si no n'hi ha cap de calculada. */
    properesHores: IndexHora[];
  };
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

import type { IndexHora, IndexVisibilitat } from './indexVisibilitat';

/** L'índex de l'hora en curs al mapa. */
export type IndexMapa = IndexVisibilitat & {
  /** El Sol encara no s'ha post (factor `sol` 0): l'índex val 0 per definició, no pel temps. */
  deDia: boolean;
};

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
  index: IndexMapa | null;
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

/** Estat d'un punt al catàleg (`punts_observacio.estat`). Només els `PUBLICAT` surten a l'app. */
export type EstatPunt = 'PENDENT' | 'PUBLICAT' | 'REBUTJAT' | 'DESACTIVAT';

/**
 * Els estats que posa la web d'administració (HU39): `PUBLICAT` o `DESACTIVAT` (retirat). Un punt
 * no s'esborra mai. `PENDENT` i `REBUTJAT` són de la moderació dels punts proposats (HU28, HU40).
 */
export type EstatPuntAdmin = Extract<EstatPunt, 'PUBLICAT' | 'DESACTIVAT'>;

/** `OFICIAL`: el catàleg de l'equip i els punts creats des de l'administració. `COMUNITAT`: HU28. */
export type OrigenPunt = 'OFICIAL' | 'COMUNITAT';

/**
 * Un punt tal com el veu la web d'administració (`/api/v1/admin/punts`, HU39): les metadades de la
 * fitxa sense l'índex, en qualsevol estat. Dates en ISO 8601.
 */
export type PuntAdmin = Omit<PuntFitxa, 'index'> & {
  /** Únic i estable (`kebab-case`). No es pot canviar. */
  slug: string;
  estat: EstatPunt;
  origen: OrigenPunt;
  dataCreacio: string;
  dataActualitzacio: string;
};

/**
 * Cos de `POST /api/v1/admin/punts`: un punt `OFICIAL` nou. Els camps opcionals que falten queden a
 * `null`; sense `sqm`, el punt té la foscor estimada (ADR-0020).
 */
export type PuntAdminNou = {
  slug: string;
  nom: string;
  municipi: string;
  descripcio: string;
  /** Graus WGS84, dins de Catalunya. */
  lat: number;
  lon: number;
  /** Metres sobre el nivell del mar. */
  altitud?: number | null;
  horitzoObert?: DireccioHoritzo[] | null;
  accessibilitat?: string | null;
  /** Foscor del cel en mag/arcsec² (10–23), com al mapa de la Generalitat. */
  sqm?: number | null;
  /** Per defecte, `PUBLICAT`. */
  estat?: EstatPuntAdmin;
};

/**
 * Cos de `PATCH /api/v1/admin/punts/{id}`: els camps que canvien (com a mínim un), sense `slug`.
 * `lat` i `lon` van junts. Per retirar un punt, `{ "estat": "DESACTIVAT" }`; per tornar-lo a
 * publicar, `{ "estat": "PUBLICAT" }`.
 */
export type PuntAdminCanvis = Partial<Omit<PuntAdminNou, 'slug'>>;

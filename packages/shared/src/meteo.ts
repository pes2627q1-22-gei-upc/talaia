import type { PuntObservacio } from './punts';

/** Origen d'una dada meteorològica. Meteocat (XEMA) s'hi afegirà amb TG-115. */
export type FontMeteo = 'open_meteo';

/**
 * Previsió meteorològica d'una hora en un punt, tal com la ingesta el worker d'Open-Meteo (TG-95).
 * Només les variables de l'índex v1: núvols per capes, humitat i visibilitat. La resta
 * (temperatura, vent, precipitació, punt de rosada) arriba amb TG-114.
 * Un `null` vol dir que la font no dóna el valor per a aquella hora.
 */
export type PrevisioMeteoHora = {
  /** Inici de l'hora, ISO 8601 en UTC (`2026-10-12T21:00:00.000Z`). */
  hora: string;
  /** Cobertura total de núvols, en % (0–100). */
  nuvolsTotal: number | null;
  /** Núvols baixos (fins a uns 3 km), en %. */
  nuvolsBaixos: number | null;
  /** Núvols mitjans (entre 3 i 8 km), en %. */
  nuvolsMitjans: number | null;
  /** Núvols alts (més de 8 km), en %. */
  nuvolsAlts: number | null;
  /** Humitat relativa a 2 m, en %. */
  humitat: number | null;
  /** Visibilitat horitzontal, en metres. */
  visibilitat: number | null;
};

/** Previsió horària d'un punt del catàleg: el resultat d'una ingesta. */
export type PrevisioMeteoPunt = {
  puntId: PuntObservacio['id'];
  /** Quan s'ha demanat a la font, ISO 8601 en UTC. */
  obtingudaEl: string;
  font: FontMeteo;
  /** Hores consecutives, de la més propera a la més llunyana. */
  hores: PrevisioMeteoHora[];
};

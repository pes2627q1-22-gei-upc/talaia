import type { PuntObservacio } from './punts';

/** Origen d'una dada meteorològica. Meteocat (XEMA) s'hi afegirà amb TG-115. */
export type FontMeteo = 'open_meteo';

/**
 * Previsió meteorològica d'una hora en un punt, tal com la ingesta el worker d'Open-Meteo
 * (TG-95: núvols per capes, humitat i visibilitat; TG-114: temperatura, vent, precipitació i
 * punt de rosada). Unitats fixes, demanades explícitament a la font: %, m, °C, mm, km/h i graus.
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
  /** Temperatura de l'aire a 2 m, en °C. */
  temperatura: number | null;
  /**
   * Punt de rosada a 2 m, en °C. Com més a prop de la temperatura, més risc de boira i de
   * condensació a l'òptica.
   */
  puntRosada: number | null;
  /** Precipitació acumulada durant l'hora (pluja, neu, calabruix), en mm. */
  precipitacio: number | null;
  /** Probabilitat de precipitació durant l'hora, en %. */
  probabilitatPrecipitacio: number | null;
  /** Velocitat del vent a 10 m, en km/h. */
  ventVelocitat: number | null;
  /** Ràfegues de vent a 10 m, en km/h. */
  ventRafegues: number | null;
  /** Direcció d'on ve el vent a 10 m, en graus (0 = nord, 90 = est). */
  ventDireccio: number | null;
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

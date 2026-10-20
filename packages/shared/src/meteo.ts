import type { PuntObservacio } from './punts';

/** Origen d'una previsió meteorològica. */
export type FontMeteo = 'open_meteo';

/**
 * Previsió meteorològica d'una hora en un punt, tal com la ingesta el worker d'Open-Meteo
 * (TG-95: núvols per capes, humitat i visibilitat; TG-114: temperatura, vent, precipitació i
 * punt de rosada). Unitats fixes, demanades explícitament a la font: %, m, °C, mm, km/h i graus.
 * Un `null` vol dir que la font no dóna el valor per a aquella hora.
 */
export type PrevisioMeteoHora = {
  /**
   * Inici de l'hora, ISO 8601 en UTC (`2026-10-12T21:00:00.000Z`). Els valors instantanis
   * (núvols, humitat, visibilitat, temperatura, punt de rosada, vent) són d'aquest instant;
   * `precipitacio`, `probabilitatPrecipitacio` i `ventRafegues` resumeixen l'hora **anterior**
   * (de `hora` − 1 h a `hora`), tal com les dóna Open-Meteo.
   */
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
  /** Precipitació acumulada a l'hora anterior (de `hora` − 1 h a `hora`; pluja, neu, calabruix), en mm. */
  precipitacio: number | null;
  /** Probabilitat de precipitació a l'hora anterior (de `hora` − 1 h a `hora`), en %. */
  probabilitatPrecipitacio: number | null;
  /** Velocitat del vent a 10 m, en km/h. */
  ventVelocitat: number | null;
  /** Ràfega màxima de vent a 10 m a l'hora anterior (de `hora` − 1 h a `hora`), en km/h. */
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

/**
 * Lectura semihorària d'una estació de la XEMA de Meteocat (TG-115): el que es va mesurar de debò,
 * per contrastar-ho amb la previsió d'Open-Meteo (l'ajust de l'índex és TG-184). La XEMA no mesura
 * els núvols: de dia, la irradiància solar en fa de testimoni. Mateixes unitats que
 * `PrevisioMeteoHora` (el vent, passat de m/s a km/h). `null` = l'estació no ho mesura o no hi ha
 * lectura.
 */
export type LecturaXema = {
  /** Codi de l'estació (`CC`, `UG`…). */
  estacio: string;
  /**
   * Inici de la mitja hora que resumeix la lectura, ISO 8601 en UTC. La XEMA etiqueta per davant:
   * la de les 11:00Z cobreix de 11:00 a 11:30. Compte en contrastar-ho amb Open-Meteo, que
   * etiqueta per darrere els valors acumulats (la precipitació de les 12:00 és la de 11:00 a 12:00).
   */
  data: string;
  /** Temperatura de l'aire, en °C. */
  temperatura: number | null;
  /** Humitat relativa, en %. */
  humitat: number | null;
  /** Precipitació de la mitja hora que comença a `data`, en mm. */
  precipitacio: number | null;
  /** Velocitat del vent a 10 m, en km/h. */
  ventVelocitat: number | null;
  /** Direcció d'on ve el vent a 10 m, en graus. */
  ventDireccio: number | null;
  /** Irradiància solar global, en W/m². */
  irradiancia: number | null;
  /**
   * Tots els valors de la fila estan validats per Meteocat (estat «V»). Meteocat valida amb dies de
   * retard: a les lectures d'ahir, que són les que baixa el worker, sol ser `false`. Les invàlides
   * (estat «N») i les de fora de rang no hi arriben.
   */
  validada: boolean;
};

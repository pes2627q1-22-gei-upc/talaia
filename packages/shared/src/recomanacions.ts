/**
 * El que l'usuari vol veure (pantalla «Què vols veure?», mockup 02, HU01). No és el `tipus` dels
 * esdeveniments del calendari (P14): aquí es tria un objectiu d'observació, i n'hi ha que no
 * són esdeveniments (la Via Làctia o el cel estrellat es poden veure qualsevol nit fosca).
 */
export type ObjectiuObservacio =
  | 'pluja_estels'
  | 'eclipsi'
  | 'via_lactia'
  | 'posta_sol'
  | 'sortida_sol'
  | 'cel_estrellat'
  | 'constellacions';

/** Consulta de recomanacions que surt de «Què vols veure?» (`GET /api/v1/recomanacions`, TG-100). */
export type ConsultaRecomanacions = {
  objectiu: ObjectiuObservacio;
  /** D'on surt l'usuari, en graus WGS84. */
  origen: { lat: number; lon: number };
  /** Nit de l'observació (`YYYY-MM-DD`): el dia del vespre, encara que la franja passi de mitjanit. */
  data: string;
  /** Franja horària en hores locals de Catalunya (0–23). Si `finsA` < `desDe`, acaba l'endemà. */
  desDe: number;
  finsA: number;
  /**
   * Temps màxim de desplaçament en cotxe, en minuts. Fins que hi hagi el servei de rutes de
   * Mobilicat, l'API el converteix en un radi aproximat.
   */
  tempsMaxim: number;
};

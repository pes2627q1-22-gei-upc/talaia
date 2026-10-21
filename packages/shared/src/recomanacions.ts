import type { IndexHora } from './indexVisibilitat';
import type { PuntObservacio } from './punts';

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
  /**
   * Franja horària en hores locals de Catalunya (0–23). Si `finsA` < `desDe`, acaba l'endemà.
   * L'app la calcula amb l'hora del mòbil: es dona per fet que és a `Europe/Madrid`.
   */
  desDe: number;
  finsA: number;
  /**
   * Temps màxim de desplaçament en cotxe, en minuts. Fins que hi hagi el servei de rutes de
   * Mobilicat, l'API el converteix en un radi aproximat.
   */
  tempsMaxim: number;
};

/** Un punt del rànquing de `GET /api/v1/recomanacions`. */
export type Recomanacio = PuntObservacio & {
  /** Distància en línia recta des de l'origen, en km (1 decimal). */
  distanciaKm: number;
  /** Temps aproximat en cotxe, en minuts, fins que hi hagi el servei de rutes de Mobilicat. */
  tempsEstimat: number;
  /** L'hora de la franja amb l'índex més alt (la primera si n'hi ha d'empatades). `null` sense índex. */
  millorHora: IndexHora | null;
  /** Mitjana de l'índex de les hores de la franja que tenen índex, arrodonida. `null` sense índex. */
  mitjana: number | null;
};

/** `GET /api/v1/recomanacions`: el rànquing de punts per a una consulta (HU01). */
export type RecomanacionsResposta = {
  /** Radi en línia recta que s'ha fet servir per a `tempsMaxim`, en km (1 decimal). */
  radiKm: number;
  /**
   * Hores de la franja que entren al rànquing, `[desDe, finsA)` en ISO 8601 UTC. Si la franja ja
   * ha començat, `desDe` és l'hora en curs.
   */
  franja: { desDe: string; finsA: string };
  /**
   * Punts publicats dins del radi, de millor a pitjor: per `millorHora`, després per `mitjana` i
   * després per distància. Els que no tenen índex (més enllà de la previsió) van al final.
   */
  punts: Recomanacio[];
};

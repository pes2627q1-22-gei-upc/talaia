/**
 * Ajust de la humitat amb la XEMA (TG-184, ADR-0036): el biaix sistemàtic de la humitat d'Open-Meteo
 * a cada estació, mesurat de nit amb les observacions dels últims dies. El que és aquí és pur
 * (sense base de dades ni xarxa), com la fórmula de l'índex; la persistència i la crida a Open-Meteo
 * són a `ajustaHumitatXema`, que rep els ports per paràmetre.
 */
import { efemeridesHores, type OpenMeteoClient } from '@talaia/index';
import type { PrevisioMeteoHora } from '@talaia/shared';

/** Dies de lectures que es miren per mesurar el biaix (ADR-0036). */
export const DIES_BIAIX = 14;
/** Parelles de nit mínimes per confiar-hi: unes 4 nits a l'hivern i 6 a l'estiu. */
export const PARELLES_MINIMES = 48;
/** Límit del biaix, en punts d'humitat relativa: més que això és un sensor dolent, no un model. */
export const BIAIX_MAXIM = 15;
/** Un biaix més vell que això no s'aplica a cap punt. */
export const DIES_BIAIX_VALID = 7;
/** Distància màxima entre el punt i l'estació del biaix, en km. */
export const DISTANCIA_MAXIMA_KM = 25;
/** Diferència d'altitud màxima entre el punt i l'estació del biaix, en metres. */
export const DIFERENCIA_ALTITUD_MAXIMA_M = 350;
/** De nit, a l'estació, el Sol és per sota d'aquesta alçada geomètrica (crepuscle civil). */
export const SOL_DE_NIT_MAX = -6;

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const RADI_TERRA_KM = 6371;

/** Una estació amb el seu biaix, tal com el desa `estacions_xema` (ADR-0036). */
export type EstacioAmbBiaix = {
  lat: number;
  lon: number;
  altitud: number | null;
  /** `null` si no n'hi ha prou mostres o si encara no s'ha calculat. */
  biaixHumitat: number | null;
  biaixCalculatEl: Date | null;
};

/** Una hora de la humitat mesurada a l'estació (XEMA): `data` és l'inici de la mitja hora. */
export type LecturaHumitat = { data: string; humitat: number | null };

/** Una parella per mesurar el biaix: la XEMA i Open-Meteo en la mateixa hora de nit. */
export type ParellaHumitat = { xema: number; previsio: number };

const mediana = (valors: number[]): number => {
  const ordenats = [...valors].sort((a, b) => a - b);
  const i = ordenats.length >> 1;
  return ordenats.length % 2
    ? (ordenats[i] as number)
    : ((ordenats[i - 1] as number) + (ordenats[i] as number)) / 2;
};

/**
 * El biaix de la humitat: la mediana de (XEMA − Open-Meteo), retallada a ±15 i arrodonida a la
 * dècima. `null` si hi ha menys de 48 parelles. La mediana no la mou una lectura dolenta ni un
 * vespre de pluja.
 */
export function biaixHumitat(parelles: ParellaHumitat[]): number | null {
  if (parelles.length < PARELLES_MINIMES) return null;
  const diferencia = mediana(parelles.map((p) => p.xema - p.previsio));
  const retallat = Math.min(BIAIX_MAXIM, Math.max(-BIAIX_MAXIM, diferencia));
  return Math.round(retallat * 10) / 10;
}

/** Distància en km entre dos punts (fórmula de l'haversine). */
export function distanciaKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * RADI_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Les parelles de nit: per a cada hora de la previsió amb humitat, la mitjana de les dues lectures
 * de la XEMA etiquetades `h − 30 min` i `h` (que cobreixen de `h − 30` a `h + 30`). Si en falta
 * alguna, l'hora no compta. Són de nit quan el Sol, a l'estació, és per sota de `SOL_DE_NIT_MAX`.
 */
export function parellesHumitat(
  previsio: PrevisioMeteoHora[],
  lectures: LecturaHumitat[],
  estacio: { lat: number; lon: number; altitud: number | null },
): ParellaHumitat[] {
  const perInstant = new Map<number, number>();
  for (const l of lectures) {
    if (l.humitat !== null) perInstant.set(Date.parse(l.data), l.humitat);
  }
  const aparellades = previsio.flatMap((h) => {
    if (h.humitat === null) return [];
    const t = Date.parse(h.hora);
    const abans = perInstant.get(t - HORA_MS / 2);
    const despres = perInstant.get(t);
    if (abans === undefined || despres === undefined) return [];
    return [{ hora: h.hora, previsio: h.humitat, xema: (abans + despres) / 2 }];
  });
  if (aparellades.length === 0) return [];
  const efemerides = efemeridesHores(
    estacio,
    aparellades.map((p) => p.hora),
  );
  return aparellades.flatMap((p, i) =>
    (efemerides[i]?.sol.alcada ?? 0) < SOL_DE_NIT_MAX
      ? [{ xema: p.xema, previsio: p.previsio }]
      : [],
  );
}

/**
 * El biaix que s'aplica a un punt, o `null`. Cal que l'estació tingui un biaix calculat fa 7 dies
 * com a molt, que estigui a menys de 25 km i que, amb les dues altituds conegudes, no n'hi hagi
 * més de 350 m de diferència. Sense altitud no es pot comprovar: no s'aplica.
 */
export function biaixAplicable(
  punt: { lat: number; lon: number; altitud: number | null },
  estacio: EstacioAmbBiaix | null | undefined,
  ara: Date,
): number | null {
  if (!estacio || estacio.biaixHumitat === null || estacio.biaixCalculatEl === null) return null;
  if (ara.getTime() - estacio.biaixCalculatEl.getTime() > DIES_BIAIX_VALID * DIA_MS) return null;
  if (distanciaKm(punt, estacio) > DISTANCIA_MAXIMA_KM) return null;
  if (punt.altitud === null || estacio.altitud === null) return null;
  if (Math.abs(punt.altitud - estacio.altitud) > DIFERENCIA_ALTITUD_MAXIMA_M) return null;
  return estacio.biaixHumitat;
}

/** Les estacions que els punts fan servir, i on es desa el biaix (`estacions_xema`). */
export type AjustHumitatRepository = {
  /** Les estacions assignades a algun punt, amb coordenades i el biaix que tenen ara. */
  estacionsAssignades(): Promise<Array<EstacioAmbBiaix & { codi: string }>>;
  /** Lectures de la humitat d'una estació entre dos instants (inclusius). */
  lecturesHumitat(codi: string, desDe: Date, fins: Date): Promise<LecturaHumitat[]>;
  /** Desa el biaix d'una estació (`null` si no n'hi ha prou mostres). */
  desaBiaix(
    codi: string,
    biaix: { biaix: number | null; mostres: number; calculatEl: Date },
  ): Promise<void>;
  /** L'instant del darrer biaix calculat, o `null` si encara no n'hi ha cap. */
  ultimCalcul(): Promise<Date | null>;
};

export type ResumAjustHumitat = {
  /** `false` si ja s'havia calculat avui (no es torna a fer). */
  calculat: boolean;
  estacions: number;
  /** Estacions amb biaix (les altres tenen menys mostres de les que calen). */
  amb: number;
};

const mateixDia = (a: Date, b: Date) =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/**
 * Calcula el biaix de totes les estacions assignades a un punt, un cop al dia (ADR-0036). Demana a
 * Open-Meteo, a les coordenades de cada estació, els últims `DIES_BIAIX` dies (`past_days`, sense
 * previsió). Si Open-Meteo falla, no s'escriu res i el biaix anterior es manté fins que caduca.
 */
export async function ajustaHumitatXema({
  meteo,
  repository,
  ara = new Date(),
}: {
  /** Open-Meteo amb `diesPassats: DIES_BIAIX` i `diesPrevisio: 0`. */
  meteo: OpenMeteoClient;
  repository: AjustHumitatRepository;
  ara?: Date;
}): Promise<ResumAjustHumitat> {
  const ultim = await repository.ultimCalcul();
  if (ultim && mateixDia(ultim, ara)) return { calculat: false, estacions: 0, amb: 0 };

  const estacions = await repository.estacionsAssignades();
  if (estacions.length === 0) return { calculat: true, estacions: 0, amb: 0 };

  const previsions = await meteo.previsio(estacions.map(({ lat, lon }) => ({ lat, lon })));
  const desDe = new Date(ara.getTime() - DIES_BIAIX * DIA_MS - HORA_MS / 2);
  let amb = 0;
  for (const [i, estacio] of estacions.entries()) {
    const parelles = parellesHumitat(
      previsions[i] ?? [],
      await repository.lecturesHumitat(estacio.codi, desDe, ara),
      estacio,
    );
    const biaix = biaixHumitat(parelles);
    if (biaix !== null) amb += 1;
    await repository.desaBiaix(estacio.codi, { biaix, mostres: parelles.length, calculatEl: ara });
  }
  return { calculat: true, estacions: estacions.length, amb };
}

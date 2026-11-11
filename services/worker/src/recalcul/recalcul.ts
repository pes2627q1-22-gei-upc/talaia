import type { PuntObservacio } from '@talaia/shared';

import { efemeridesHores } from '../astronomia/astronomia';
import { calculaIndexHores } from '../index/formula';
import type { IndexRepository } from '../index/repository';
import { OpenMeteoError, type OpenMeteoClient } from '../meteo/openMeteo';

/** El que el recàlcul necessita d'un punt: on és i quina foscor té. */
export type PuntPerRecalcul = Pick<PuntObservacio, 'id' | 'lat' | 'lon'> & {
  altitud: number | null;
  /** SQM del mapa de contaminació lumínica (ADR-0020), o `null` si no en té. */
  sqm: number | null;
};

export type ExecucioWorker = {
  iniciadaEl: Date;
  acabadaEl: Date;
  /** El de l'índex: un error de les alertes no el canvia (ADR-0033). */
  estat: 'ok' | 'error';
  punts: number;
  hores: number;
  error?: string;
  /** Notificacions d'alertes noves (TG-153). No hi és si no s'han avaluat o si ha fallat. */
  notificacions?: number;
  /** L'error del pas d'alertes, si n'hi ha hagut. */
  errorAlertes?: string;
};

/** El que torna el pas d'alertes (TG-153): les notificacions noves que ha desat. */
export type ResumAlertes = { notificacions: number };

/** Ports del recàlcul: la base de dades als repositoris de Kysely, la memòria als tests. */
export type RecalculDeps = {
  punts: { listPublicats(): Promise<PuntPerRecalcul[]> };
  meteo: OpenMeteoClient;
  indexs: IndexRepository & {
    /** Esborra les hores anteriors a `abans`: l'índex passat no el llegeix ningú. */
    esborraAnteriors(abans: Date): Promise<void>;
  };
  execucions: { registra(execucio: ExecucioWorker): Promise<void> };
  /**
   * Les alertes (TG-153, ADR-0033): s'avaluen amb l'índex ja desat, si l'execució n'ha desat
   * algun punt. Un error aquí no fa fallar el recàlcul: queda al log i a `execucions_worker`.
   * Opcional: sense, el recàlcul no en sap res.
   */
  alertes?: (ara: Date) => Promise<ResumAlertes>;
  /** Si s'activa (aturada del procés), no es comença cap lot més. */
  senyal?: AbortSignal;
  /** Rellotge i espera entre intents, injectables als tests. */
  ara?: () => Date;
  espera?: (ms: number) => Promise<void>;
};

export type ResumRecalcul = Omit<ExecucioWorker, 'error'>;

const HORA_MS = 3_600_000;
/** Es guarda l'hora en curs i les següents; les anteriors a aquest marge s'esborren. */
export const HORES_PASSADES_GUARDADES = 24;
/**
 * Punts per petició a Open-Meteo. Amb lots petits, un 503 o un timeout només fa perdre aquell
 * lot, i la resta de punts tenen l'índex al dia.
 */
export const PUNTS_PER_LOT = 10;
/** Intents per lot: el primer i un reintent si l'error és transitori. */
export const INTENTS_PER_LOT = 2;
export const ESPERA_REINTENT_MS = 5_000;

/** Inici de l'hora en curs, en UTC (les hores de la previsió i de l'índex comencen en punt). */
export const iniciHora = (data: Date): Date =>
  new Date(Math.floor(data.getTime() / HORA_MS) * HORA_MS);

/** Xarxa, timeout, 429 o 5xx: val la pena tornar-ho a provar. Un cos mal format, no. */
const esTransitori = (error: unknown) =>
  error instanceof OpenMeteoError &&
  (error.status === undefined || error.status === 429 || error.status >= 500);

const missatge = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Una execució del worker (ADR-0024): per lots de punts publicats, previsió d'Open-Meteo,
 * efemèrides de cada hora, índex v1 (ADR-0018) i persistència a `index_visibilitat`.
 * Un lot que falla no atura els altres. Després, amb l'índex desat, s'avaluen les alertes
 * (ADR-0033). En acabar, en deixa constància a `execucions_worker` (`ok` només si tots els lots
 * han anat bé). L'API fa servir com a versió del document del mapa l'última execució que ha desat
 * algun punt (ADR-0012).
 */
export async function recalculaIndex({
  punts,
  meteo,
  indexs,
  execucions,
  alertes,
  senyal,
  ara = () => new Date(),
  espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: RecalculDeps): Promise<ResumRecalcul> {
  const iniciadaEl = ara();
  const desDe = iniciHora(iniciadaEl).getTime();
  const resum = { punts: 0, hores: 0 };
  const errors: string[] = [];

  /** Si el registre falla, es mostra al log i no amaga l'error de l'execució. */
  const registra = async (execucio: ExecucioWorker) => {
    try {
      await execucions.registra(execucio);
    } catch (error) {
      console.error("[worker] no s'ha pogut desar l'execució a execucions_worker", error);
    }
  };

  const previsioAmbReintent = async (lot: PuntPerRecalcul[]) => {
    for (let intent = 1; ; intent++) {
      try {
        return await meteo.previsio(lot.map(({ lat, lon }) => ({ lat, lon })));
      } catch (error) {
        if (intent >= INTENTS_PER_LOT || !esTransitori(error)) throw error;
        await espera(ESPERA_REINTENT_MS);
      }
    }
  };

  const recalculaLot = async (lot: PuntPerRecalcul[]) => {
    const previsions = await previsioAmbReintent(lot);
    for (const [i, punt] of lot.entries()) {
      const previsio = previsions[i];
      if (!previsio) throw new Error(`Falta la previsió del punt ${punt.id} (posició ${i})`);
      const hores = previsio.filter((h) => Date.parse(h.hora) >= desDe);
      const efemerides = efemeridesHores(
        { lat: punt.lat, lon: punt.lon, altitud: punt.altitud },
        hores.map((h) => h.hora),
      );
      const index = calculaIndexHores(hores, efemerides, punt.sqm);
      await indexs.desaIndexs(punt.id, index);
      resum.punts += 1;
      resum.hores += index.length;
    }
  };

  try {
    const publicats = await punts.listPublicats();
    for (let inici = 0; inici < publicats.length; inici += PUNTS_PER_LOT) {
      if (senyal?.aborted) {
        errors.push(`aturat abans d'acabar (${publicats.length - inici} punts sense recalcular)`);
        break;
      }
      const lot = publicats.slice(inici, inici + PUNTS_PER_LOT);
      try {
        await recalculaLot(lot);
      } catch (error) {
        errors.push(`punts ${inici + 1}–${inici + lot.length}: ${missatge(error)}`);
      }
    }
    await indexs.esborraAnteriors(new Date(desDe - HORES_PASSADES_GUARDADES * HORA_MS));
  } catch (error) {
    errors.push(missatge(error));
  }

  // Les alertes, amb l'índex ja desat: també si ha fallat algun lot, perquè la resta de punts
  // tenen l'índex nou (el mateix criteri que fa servir l'API per al mapa). Si el procés s'atura,
  // es deixen per a l'execució següent.
  let resumAlertes: Pick<ExecucioWorker, 'notificacions' | 'errorAlertes'> = {};
  if (alertes && resum.punts > 0 && !senyal?.aborted) {
    try {
      resumAlertes = { notificacions: (await alertes(ara())).notificacions };
    } catch (error) {
      console.error("[worker] l'avaluació de les alertes ha fallat", error);
      resumAlertes = { errorAlertes: missatge(error) };
    }
  }

  const execucio: ExecucioWorker = {
    iniciadaEl,
    acabadaEl: ara(),
    estat: errors.length ? 'error' : 'ok',
    ...resum,
    ...(errors.length ? { error: errors.join('; ') } : {}),
    ...resumAlertes,
  };
  await registra(execucio);
  if (execucio.error !== undefined) throw new Error(execucio.error);
  return execucio;
}

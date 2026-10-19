import type { PuntObservacio } from '@talaia/shared';

import { efemeridesHores } from '../astronomia/astronomia';
import { calculaIndexHores } from '../index/formula';
import type { IndexRepository } from '../index/repository';
import type { OpenMeteoClient } from '../meteo/openMeteo';

/** El que el recàlcul necessita d'un punt: on és i quina foscor té. */
export type PuntPerRecalcul = Pick<PuntObservacio, 'id' | 'lat' | 'lon'> & {
  altitud: number | null;
  /** SQM del mapa de contaminació lumínica (ADR-0020), o `null` si no en té. */
  sqm: number | null;
};

export type ExecucioWorker = {
  iniciadaEl: Date;
  acabadaEl: Date;
  estat: 'ok' | 'error';
  punts: number;
  hores: number;
  error?: string;
};

/** Ports del recàlcul: la base de dades als repositoris de Kysely, la memòria als tests. */
export type RecalculDeps = {
  punts: { listPublicats(): Promise<PuntPerRecalcul[]> };
  meteo: OpenMeteoClient;
  indexs: IndexRepository & {
    /** Esborra les hores anteriors a `abans`: l'índex passat no el llegeix ningú. */
    esborraAnteriors(abans: Date): Promise<void>;
  };
  execucions: { registra(execucio: ExecucioWorker): Promise<void> };
  /** Rellotge injectable als tests. */
  ara?: () => Date;
};

export type ResumRecalcul = Omit<ExecucioWorker, 'error'>;

const HORA_MS = 3_600_000;
/** Es guarda l'hora en curs i les següents; les anteriors a aquest marge s'esborren. */
export const HORES_PASSADES_GUARDADES = 24;

/** Inici de l'hora en curs, en UTC (les hores de la previsió i de l'índex comencen en punt). */
export const iniciHora = (data: Date): Date =>
  new Date(Math.floor(data.getTime() / HORA_MS) * HORA_MS);

/**
 * Una execució del worker (ADR-0024): previsió d'Open-Meteo de tots els punts publicats,
 * efemèrides de cada hora, índex v1 (ADR-0018) i persistència a `index_visibilitat`.
 * En acabar, bé o malament, en deixa constància a `execucions_worker`: l'API fa servir l'última
 * correcta com a versió del document del mapa (ADR-0012).
 */
export async function recalculaIndex({
  punts,
  meteo,
  indexs,
  execucions,
  ara = () => new Date(),
}: RecalculDeps): Promise<ResumRecalcul> {
  const iniciadaEl = ara();
  const desDe = iniciHora(iniciadaEl).getTime();
  let resum = { punts: 0, hores: 0 };

  try {
    const publicats = await punts.listPublicats();
    const previsions = publicats.length
      ? await meteo.previsio(publicats.map(({ lat, lon }) => ({ lat, lon })))
      : [];

    for (const [i, punt] of publicats.entries()) {
      const previsio = previsions[i];
      if (!previsio) throw new Error(`Falta la previsió del punt ${punt.id} (posició ${i})`);
      const hores = previsio.filter((h) => Date.parse(h.hora) >= desDe);
      const efemerides = efemeridesHores(
        { lat: punt.lat, lon: punt.lon, altitud: punt.altitud },
        hores.map((h) => h.hora),
      );
      const index = calculaIndexHores(hores, efemerides, punt.sqm);
      await indexs.desaIndexs(punt.id, index);
      resum = { punts: resum.punts + 1, hores: resum.hores + index.length };
    }

    await indexs.esborraAnteriors(new Date(desDe - HORES_PASSADES_GUARDADES * HORA_MS));
  } catch (error) {
    await execucions.registra({
      iniciadaEl,
      acabadaEl: ara(),
      estat: 'error',
      ...resum,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const execucio = { iniciadaEl, acabadaEl: ara(), estat: 'ok' as const, ...resum };
  await execucions.registra(execucio);
  return execucio;
}

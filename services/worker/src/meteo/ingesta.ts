import type { PrevisioMeteoPunt, PuntObservacio } from '@talaia/shared';

import type { OpenMeteoClient } from './openMeteo';
import type { PrevisioMeteoRepository } from './repository';

/** El que la ingesta necessita d'un punt: on és i com identificar-ne la previsió. */
export type PuntPerIngesta = Pick<PuntObservacio, 'id' | 'lat' | 'lon'>;

export type IngestaPrevisioMeteoDeps = {
  client: OpenMeteoClient;
  repository: PrevisioMeteoRepository;
  /** Rellotge injectable als tests. */
  ara?: () => Date;
};

export type ResumIngesta = {
  punts: number;
  /** Total d'hores desades, sumant tots els punts. */
  hores: number;
  obtingudaEl: string;
};

/**
 * Demana a Open-Meteo la previsió de tots els punts i la desa al repositori.
 * El worker horari (TG-99) la crida abans de recalcular l'índex (TG-98).
 */
export async function ingestaPrevisioMeteo(
  punts: PuntPerIngesta[],
  { client, repository, ara = () => new Date() }: IngestaPrevisioMeteoDeps,
): Promise<ResumIngesta> {
  const obtingudaEl = ara().toISOString();
  if (punts.length === 0) return { punts: 0, hores: 0, obtingudaEl };

  const previsions = await client.previsio(punts.map(({ lat, lon }) => ({ lat, lon })));

  const resultat: PrevisioMeteoPunt[] = punts.map((punt, i) => {
    const hores = previsions[i];
    if (!hores) throw new Error(`Falta la previsió del punt ${punt.id} (posició ${i})`);
    return { puntId: punt.id, obtingudaEl, font: 'open_meteo', hores };
  });

  await repository.desaPrevisions(resultat);

  return {
    punts: resultat.length,
    hores: resultat.reduce((total, previsio) => total + previsio.hores.length, 0),
    obtingudaEl,
  };
}

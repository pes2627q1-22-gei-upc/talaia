import type { PrevisioMeteoHora } from '@talaia/shared';

import { createInMemoryIndexRepository } from '../../index/repository';
import type { OpenMeteoClient } from '../../meteo/openMeteo';
import {
  HORES_PASSADES_GUARDADES,
  iniciHora,
  recalculaIndex,
  type ExecucioWorker,
  type PuntPerRecalcul,
  type RecalculDeps,
} from '../recalcul';

// 21:20 UTC del 16/10: de nit a Catalunya. L'hora en curs comença a les 21:00.
const ARA = new Date('2026-10-16T21:20:00.000Z');
const HORA_MS = 3_600_000;

const meteo = (hora: string, nuvolsTotal = 0): PrevisioMeteoHora => ({
  hora,
  nuvolsTotal,
  nuvolsBaixos: nuvolsTotal,
  nuvolsMitjans: 0,
  nuvolsAlts: 0,
  humitat: 60,
  visibilitat: 30_000,
  temperatura: 8,
  puntRosada: 2,
  precipitacio: 0,
  probabilitatPrecipitacio: 0,
  ventVelocitat: 5,
  ventRafegues: 10,
  ventDireccio: 0,
});

/** Previsió de -2 a +2 hores al voltant de l'hora en curs. */
const previsio = (nuvolsTotal = 0) =>
  [-2, -1, 0, 1, 2].map((d) =>
    meteo(new Date(iniciHora(ARA).getTime() + d * HORA_MS).toISOString(), nuvolsTotal),
  );

const PUNTS: PuntPerRecalcul[] = [
  { id: 'montsec', lat: 42.0294, lon: 0.7112, altitud: 1570, sqm: 21.6 },
  { id: 'ciutat', lat: 41.3874, lon: 2.1686, altitud: 12, sqm: null },
];

function setup({
  punts = PUNTS,
  previsions = [previsio(0), previsio(100)],
  meteoFalla,
}: {
  punts?: PuntPerRecalcul[];
  previsions?: PrevisioMeteoHora[][];
  meteoFalla?: Error;
} = {}) {
  const indexs = { ...createInMemoryIndexRepository(), esborraAnteriors: jest.fn(async () => {}) };
  const execucions: ExecucioWorker[] = [];
  const client: OpenMeteoClient = {
    previsio: jest.fn(async () => {
      if (meteoFalla) throw meteoFalla;
      return previsions;
    }),
  };
  const deps: RecalculDeps = {
    punts: { listPublicats: async () => punts },
    meteo: client,
    indexs,
    execucions: { registra: async (e) => void execucions.push(e) },
    ara: () => ARA,
  };
  return { deps, indexs, execucions, client };
}

describe('recalculaIndex', () => {
  it("desa l'índex de cada punt des de l'hora en curs i registra l'execució", async () => {
    const { deps, indexs, execucions } = setup();

    const resum = await recalculaIndex(deps);

    expect(resum).toMatchObject({ estat: 'ok', punts: 2, hores: 6 });
    const montsec = await indexs.indexsDe('montsec');
    expect(montsec.map((h) => h.hora)).toEqual([
      '2026-10-16T21:00:00.000Z',
      '2026-10-16T22:00:00.000Z',
      '2026-10-16T23:00:00.000Z',
    ]);
    // Cel ras de nit amb SQM, contra cel tapat a la ciutat.
    expect(montsec[0]?.foscorEstimada).toBe(false);
    expect((await indexs.indexsDe('ciutat'))[0]).toMatchObject({ valor: 0, foscorEstimada: true });
    expect(execucions).toEqual([
      { iniciadaEl: ARA, acabadaEl: ARA, estat: 'ok', punts: 2, hores: 6 },
    ]);
  });

  it(`esborra l'índex de fa més de ${HORES_PASSADES_GUARDADES} hores`, async () => {
    const { deps, indexs } = setup();
    await recalculaIndex(deps);
    expect(indexs.esborraAnteriors).toHaveBeenCalledWith(new Date('2026-10-15T21:00:00.000Z'));
  });

  it('sense punts publicats no crida Open-Meteo i registra una execució buida', async () => {
    const { deps, client, execucions } = setup({ punts: [] });
    await expect(recalculaIndex(deps)).resolves.toMatchObject({ estat: 'ok', punts: 0, hores: 0 });
    expect(client.previsio).not.toHaveBeenCalled();
    expect(execucions).toHaveLength(1);
  });

  it("si Open-Meteo falla, registra l'error i el torna a llançar", async () => {
    const { deps, execucions } = setup({ meteoFalla: new Error('Open-Meteo 502') });
    await expect(recalculaIndex(deps)).rejects.toThrow('Open-Meteo 502');
    expect(execucions).toEqual([
      expect.objectContaining({ estat: 'error', punts: 0, error: 'Open-Meteo 502' }),
    ]);
  });

  it("si falta la previsió d'un punt, l'error compta els punts ja desats", async () => {
    const { deps, execucions } = setup({ previsions: [previsio()] });
    await expect(recalculaIndex(deps)).rejects.toThrow('Falta la previsió del punt ciutat');
    expect(execucions[0]).toMatchObject({ estat: 'error', punts: 1, hores: 3 });
  });
});

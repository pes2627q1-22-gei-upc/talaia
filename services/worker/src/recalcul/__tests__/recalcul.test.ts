import type { PrevisioMeteoHora } from '@talaia/shared';

import { createInMemoryIndexRepository } from '../../index/repository';
import { OpenMeteoError, type Coordenades, type OpenMeteoClient } from '../../meteo/openMeteo';
import {
  HORES_PASSADES_GUARDADES,
  INTENTS_PER_LOT,
  PUNTS_PER_LOT,
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

/** Previsió de -2 a +2 hores al voltant de l'hora en curs: 3 hores des de l'hora en curs. */
const previsio = (nuvolsTotal = 0) =>
  [-2, -1, 0, 1, 2].map((d) =>
    meteo(new Date(iniciHora(ARA).getTime() + d * HORA_MS).toISOString(), nuvolsTotal),
  );

const punt = (id: string, sqm: number | null = null): PuntPerRecalcul => ({
  id,
  lat: 41.5,
  lon: 1.5,
  altitud: 500,
  sqm,
});

const PUNTS = [punt('montsec', 21.6), punt('ciutat')];

/** Open-Meteo fals: una previsió per lloc (cel tapat als llocs amb `lat` 41.4), o un error. */
const clientAmb = (respon: (llocs: Coordenades[], crida: number) => PrevisioMeteoHora[][]) => {
  let crida = 0;
  const client: OpenMeteoClient = {
    previsio: jest.fn(async (llocs: Coordenades[]) => respon(llocs, ++crida)),
  };
  return client;
};
const clientBo = () => clientAmb((llocs) => llocs.map(() => previsio(0)));

function setup({
  punts = PUNTS,
  client = clientBo(),
  registraFalla = false,
}: { punts?: PuntPerRecalcul[]; client?: OpenMeteoClient; registraFalla?: boolean } = {}) {
  const indexs = { ...createInMemoryIndexRepository(), esborraAnteriors: jest.fn(async () => {}) };
  const execucions: ExecucioWorker[] = [];
  const espera = jest.fn(async () => {});
  const deps: RecalculDeps = {
    punts: { listPublicats: async () => punts },
    meteo: client,
    indexs,
    execucions: {
      registra: async (e) => {
        if (registraFalla) throw new Error('BD caiguda en registrar');
        execucions.push(e);
      },
    },
    ara: () => ARA,
    espera,
  };
  return { deps, indexs, execucions, client, espera };
}

describe('recalculaIndex', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

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
    expect(montsec[0]?.foscorEstimada).toBe(false);
    expect((await indexs.indexsDe('ciutat'))[0]?.foscorEstimada).toBe(true);
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

  it(`demana Open-Meteo per lots de ${PUNTS_PER_LOT} punts`, async () => {
    const punts = Array.from({ length: 25 }, (_, i) => punt(`p${i}`));
    const { deps, client } = setup({ punts });
    await expect(recalculaIndex(deps)).resolves.toMatchObject({ punts: 25 });
    expect(jest.mocked(client.previsio).mock.calls.map(([llocs]) => llocs.length)).toEqual([
      10, 10, 5,
    ]);
  });

  it("si un lot falla, desa els altres i registra l'error amb els punts del lot", async () => {
    const punts = Array.from({ length: 25 }, (_, i) => punt(`p${i}`));
    const client = clientAmb((llocs, crida) => {
      // Un cos mal format arriba amb status 200: no es torna a provar.
      if (crida === 2) throw new OpenMeteoError('Open-Meteo: cos inesperat', 200);
      return llocs.map(() => previsio());
    });
    const { deps, indexs, execucions } = setup({ punts, client });

    await expect(recalculaIndex(deps)).rejects.toThrow('punts 11–20: Open-Meteo: cos inesperat');

    expect(execucions[0]).toMatchObject({ estat: 'error', punts: 15, hores: 45 });
    expect(await indexs.indexsDe('p0')).toHaveLength(3);
    expect(await indexs.indexsDe('p10')).toHaveLength(0);
    expect(await indexs.indexsDe('p24')).toHaveLength(3);
  });

  it.each([
    ['un timeout', new OpenMeteoError('Open-Meteo: timeout')],
    ['un 503', new OpenMeteoError('Open-Meteo: overloaded', 503)],
    ['un 429', new OpenMeteoError('Open-Meteo: massa peticions', 429)],
  ])('torna a provar un lot després de %s', async (_cas, error) => {
    const client = clientAmb((llocs, crida) => {
      if (crida === 1) throw error;
      return llocs.map(() => previsio());
    });
    const { deps, espera } = setup({ client });
    await expect(recalculaIndex(deps)).resolves.toMatchObject({ estat: 'ok', punts: 2 });
    expect(client.previsio).toHaveBeenCalledTimes(2);
    expect(espera).toHaveBeenCalledTimes(1);
  });

  it(`deixa el lot després de ${INTENTS_PER_LOT} intents`, async () => {
    const client = clientAmb(() => {
      throw new OpenMeteoError('Open-Meteo: overloaded', 503);
    });
    const { deps, execucions } = setup({ client });
    await expect(recalculaIndex(deps)).rejects.toThrow('overloaded');
    expect(client.previsio).toHaveBeenCalledTimes(INTENTS_PER_LOT);
    expect(execucions[0]).toMatchObject({ estat: 'error', punts: 0 });
  });

  it('no torna a provar un error que no és transitori (un 400)', async () => {
    const client = clientAmb(() => {
      throw new OpenMeteoError('Open-Meteo: petició incorrecta', 400);
    });
    const { deps } = setup({ client });
    await expect(recalculaIndex(deps)).rejects.toThrow('petició incorrecta');
    expect(client.previsio).toHaveBeenCalledTimes(1);
  });

  it("si falta la previsió d'un punt, l'error compta els punts ja desats", async () => {
    const client = clientAmb(() => [previsio()]);
    const { deps, execucions } = setup({ client });
    await expect(recalculaIndex(deps)).rejects.toThrow('Falta la previsió del punt ciutat');
    expect(execucions[0]).toMatchObject({ estat: 'error', punts: 1, hores: 3 });
  });

  it("si no es pot registrar l'execució, es manté l'error original", async () => {
    const client = clientAmb(() => {
      throw new OpenMeteoError('Open-Meteo: cos inesperat', 200);
    });
    const { deps } = setup({ client, registraFalla: true });
    await expect(recalculaIndex(deps)).rejects.toThrow('Open-Meteo: cos inesperat');
  });

  it("si no es pot registrar una execució correcta, el resultat continua sent 'ok'", async () => {
    const { deps, indexs } = setup({ registraFalla: true });
    await expect(recalculaIndex(deps)).resolves.toMatchObject({ estat: 'ok', punts: 2 });
    expect(await indexs.indexsDe('montsec')).toHaveLength(3);
  });

  it("amb el senyal d'aturada, no comença cap lot més", async () => {
    const aturada = new AbortController();
    const punts = Array.from({ length: 25 }, (_, i) => punt(`p${i}`));
    const client = clientAmb((llocs) => {
      aturada.abort();
      return llocs.map(() => previsio());
    });
    const { deps, execucions } = setup({ punts, client });

    await expect(recalculaIndex({ ...deps, senyal: aturada.signal })).rejects.toThrow(
      "aturat abans d'acabar (15 punts sense recalcular)",
    );
    expect(client.previsio).toHaveBeenCalledTimes(1);
    expect(execucions[0]).toMatchObject({ estat: 'error', punts: 10 });
  });
});

import { DIES_RECUPERATS_MAXIM, diesPendentsXema } from '../ingesta';
import { PLANIFICACIO_ESTACIONS, PLANIFICACIO_LECTURES, planificaXema } from '../planificacio';
import { createInMemoryXemaRepository } from '../repository';
import { XemaError, type EstacioXema, type XemaClient } from '../xema';

/** Un node-cron fals: desa les tasques per poder-les llançar des del test. */
function programaFals() {
  const tasques = new Map<string, () => void>();
  const stop = jest.fn();
  const programa = jest.fn((expressio: string, tasca: () => void) => {
    tasques.set(expressio, tasca);
    return { stop };
  });
  return { programa, tasques, stop };
}

const ESTACIO: EstacioXema = { codi: 'CC', nom: 'Orís', lat: 42.07, lon: 2.21, altitud: 626 };

function clientFals(lectures: XemaClient['lectures'] = async () => []): jest.Mocked<XemaClient> {
  return {
    estacionsOperatives: jest.fn(async (_data: string) => [ESTACIO]),
    lectures: jest.fn(lectures),
  };
}

/** Deixa córrer les promeses pendents (la tasca d'arrencada no s'espera des de fora). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('planificaXema', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('sense clau no planifica res i ho avisa al log', async () => {
    const { programa } = programaFals();

    const planificacio = planificaXema({ programa });

    expect(programa).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('METEOCAT_API_KEY'));
    await expect(planificacio.atura()).resolves.toBeUndefined();
  });

  it('amb clau planifica les estacions i les lectures en UTC', async () => {
    const { programa } = programaFals();
    const client = clientFals();
    const repository = createInMemoryXemaRepository();

    planificaXema({ xema: { client, repository, hiHaEstacions: async () => true }, programa });
    await flush();

    expect(programa).toHaveBeenCalledTimes(2);
    expect(programa).toHaveBeenCalledWith(PLANIFICACIO_LECTURES, expect.any(Function), {
      name: 'xema-lectures',
      timezone: 'UTC',
    });
    expect(programa).toHaveBeenCalledWith(PLANIFICACIO_ESTACIONS, expect.any(Function), {
      name: 'xema-estacions',
      timezone: 'UTC',
    });
    expect(PLANIFICACIO_LECTURES).toBe('15 6 * * *');
    expect(PLANIFICACIO_ESTACIONS).toMatch(/^\d+ \d+ 1 \* \*$/);
    // Ja hi ha estacions: en arrencar no es gasta cap consulta.
    expect(client.estacionsOperatives).not.toHaveBeenCalled();
  });

  it('en arrencar actualitza les estacions si la taula és buida', async () => {
    const { programa } = programaFals();
    const client = clientFals();
    const repository = createInMemoryXemaRepository({ punts: [{ id: 'p1', lat: 42, lon: 2.2 }] });

    planificaXema({ xema: { client, repository, hiHaEstacions: async () => false }, programa });
    await flush();

    expect(client.estacionsOperatives).toHaveBeenCalledTimes(1);
    expect(repository.estacioDe('p1')).toBe('CC');
  });

  it('cada tasca planificada crida la ingesta que li toca', async () => {
    const { programa, tasques } = programaFals();
    const client = clientFals();
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    planificaXema({ xema: { client, repository, hiHaEstacions: async () => true }, programa });
    await flush();
    // En arrencar, sense cap lectura desada, ja baixa ahir: una petició per variable.
    expect(client.lectures).toHaveBeenCalledTimes(6);

    tasques.get(PLANIFICACIO_LECTURES)?.();
    await flush();
    expect(client.lectures).toHaveBeenCalledTimes(12);

    tasques.get(PLANIFICACIO_ESTACIONS)?.();
    await flush();
    expect(client.estacionsOperatives).toHaveBeenCalledTimes(1);
  });

  it('mostra al log els errors del resum de la ingesta', async () => {
    const { programa, tasques } = programaFals();
    const client = clientFals(async (variable) => {
      if (variable === 'irradiancia') throw new Error('timeout');
      return [];
    });
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    planificaXema({ xema: { client, repository, hiHaEstacions: async () => true }, programa });
    await flush();

    tasques.get(PLANIFICACIO_LECTURES)?.();
    await flush();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('irradiancia: timeout'));
  });

  it("un error no s'escapa i la tasca següent torna a funcionar", async () => {
    const { programa, tasques } = programaFals();
    const client = clientFals(async () => {
      throw new XemaError('quota exhaurida', 429);
    });
    client.estacionsOperatives.mockRejectedValueOnce(new Error('xarxa'));
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    const hiHaEstacions = jest.fn(async () => {
      throw new Error('BD caiguda');
    });
    planificaXema({ xema: { client, repository, hiHaEstacions }, programa });
    await flush();

    tasques.get(PLANIFICACIO_LECTURES)?.();
    await flush();
    tasques.get(PLANIFICACIO_ESTACIONS)?.();
    await flush();
    tasques.get(PLANIFICACIO_ESTACIONS)?.();
    await flush();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('arrencada'),
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('lectures'),
      expect.any(XemaError),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('estacions'),
      expect.any(Error),
    );
    expect(client.estacionsOperatives).toHaveBeenCalledTimes(2);
  });

  it('no solapa les tasques i en aturar-se para els crons i espera la que està en curs', async () => {
    const { programa, tasques, stop } = programaFals();
    let acaba!: () => void;
    const client = clientFals();
    client.estacionsOperatives.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acaba = () => resolve([ESTACIO]);
        }),
    );
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    const planificacio = planificaXema({
      xema: { client, repository, hiHaEstacions: async () => false },
      programa,
    });
    await flush();

    tasques.get(PLANIFICACIO_LECTURES)?.();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('se salta'));
    expect(client.lectures).not.toHaveBeenCalled();

    let aturada = false;
    const atura = planificacio.atura().then(() => {
      aturada = true;
    });
    await flush();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(aturada).toBe(false);

    acaba();
    await atura;
    tasques.get(PLANIFICACIO_LECTURES)?.();
    await flush();
    expect(client.lectures).not.toHaveBeenCalled();
  });
});

describe('recuperació dels dies que falten', () => {
  const ARA = new Date('2026-10-21T06:15:00.000Z');

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it.each<[string, string | null, string[]]>([
    ['sense cap lectura, només ahir', null, ['2026-10-20']],
    ['amb ahir ja desat, cap', '2026-10-20T23:30:00.000Z', []],
    ["amb l'últim de abans-d'ahir, ahir", '2026-10-19T23:30:00.000Z', ['2026-10-20']],
    [
      'després de tres dies sense ingerir, els tres',
      '2026-10-17T23:30:00.000Z',
      ['2026-10-18', '2026-10-19', '2026-10-20'],
    ],
    [
      `com a molt els ${DIES_RECUPERATS_MAXIM} darrers`,
      '2026-10-01T23:30:00.000Z',
      ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'],
    ],
  ])('%s', (_cas, ultima, dies) => {
    expect(diesPendentsXema(ultima, ARA)).toEqual(dies);
  });

  it.each<[string, string, string | null, string[]]>([
    [
      'a les 02:59 UTC, ahir encara no es dona per sencer',
      '2026-10-21T02:59:00.000Z',
      '2026-10-19T23:30:00.000Z',
      [],
    ],
    ['a les 03:00 UTC, sí', '2026-10-21T03:00:00.000Z', '2026-10-19T23:30:00.000Z', ['2026-10-20']],
    [
      "sense lectures, de matinada baixa el dia d'abans d'ahir",
      '2026-10-21T01:00:00.000Z',
      null,
      ['2026-10-19'],
    ],
  ])('%s', (_cas, ara, ultima, dies) => {
    expect(diesPendentsXema(ultima, new Date(ara))).toEqual(dies);
  });

  it('en arrencar, baixa els dies que falten del més antic al més recent', async () => {
    const { programa } = programaFals();
    const client = clientFals();
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    jest.spyOn(repository, 'ultimaLectura').mockResolvedValue('2026-10-18T23:30:00.000Z');

    planificaXema({
      xema: { client, repository, hiHaEstacions: async () => true },
      programa,
      ara: () => ARA,
    });
    await flush();

    const dies = [...new Set(client.lectures.mock.calls.map(([, dia]) => dia))];
    expect(dies).toEqual(['2026-10-19', '2026-10-20']);
  });

  it('un 429 en un dia atura la recuperació i no demana els dies següents', async () => {
    const { programa } = programaFals();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const client = clientFals(async () => {
      throw new XemaError('La XEMA ha respost 429', 429);
    });
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    jest.spyOn(repository, 'ultimaLectura').mockResolvedValue('2026-10-17T23:30:00.000Z');

    planificaXema({
      xema: { client, repository, hiHaEstacions: async () => true },
      programa,
      ara: () => ARA,
    });
    await flush();

    expect(client.lectures).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      '[worker] xema arrencada: ha fallat',
      expect.any(XemaError),
    );
  });
});

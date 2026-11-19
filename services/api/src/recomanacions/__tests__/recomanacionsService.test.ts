import type { ConsultaRecomanacions, IndexHora } from '@talaia/shared';

import type { FilaEsdeveniment } from '../../esdeveniments/esdevenimentsRepository';
import { ApiError } from '../../middleware/errors';
import type {
  IndexHoraPunt,
  PuntCandidat,
  RecomanacionsRepository,
} from '../recomanacionsRepository';
import {
  compareEventRecommendations,
  createRecomanacionsService,
  type EsdevenimentsFont,
  LIMIT_PER_DEFECTE,
  resolConsulta,
  resumeix,
  TEMPS_MAXIM_PER_DEFECTE,
} from '../recomanacionsService';

const HORA_MS = 3_600_000;

const hora = (iso: string, valor: number): IndexHora => ({
  hora: iso,
  valor,
  franja: valor >= 70 ? 'ras' : valor >= 40 ? 'jus' : 'tap',
  factors: { nuvols: 1, sol: 1, foscor: 0.6, lluna: 1 },
  foscorEstimada: false,
});

const punt = (id: string, distanciaM: number): PuntCandidat => ({
  id,
  nom: `Punt ${id}`,
  municipi: 'Municipi',
  lat: 42,
  lon: 1.5,
  distanciaM,
});

// Nit del 15 al 16 de desembre de 2026 (CET): de 22 a 6 locals = de 21:00 a 05:00 UTC.
const CONSULTA: ConsultaRecomanacions = {
  objectiu: 'cel_estrellat',
  origen: { lat: 41.3874, lon: 2.1686 },
  data: '2026-12-15',
  desDe: 22,
  finsA: 6,
  tempsMaxim: 150,
};
const ABANS = new Date('2026-12-15T10:20:00Z');
const H = (n: number) => new Date(Date.parse('2026-12-15T21:00:00Z') + n * HORA_MS).toISOString();

function fakeRepository(punts: PuntCandidat[], index: IndexHoraPunt[], error?: Error) {
  const crides: { radi?: number | null; origen?: unknown; rang?: [string[], Date, Date] } = {};
  const repository: RecomanacionsRepository = {
    async puntsDinsRadi(origen, metres) {
      if (error) throw error;
      crides.origen = origen;
      crides.radi = metres;
      return punts;
    },
    async indexHores(ids, desDe, finsA) {
      crides.rang = [ids, desDe, finsA];
      return index.filter(
        (i) =>
          ids.includes(i.puntId) && Date.parse(i.hora) >= +desDe && Date.parse(i.hora) < +finsA,
      );
    },
  };
  return { repository, crides };
}

describe('resumeix', () => {
  it('sense hores, millorHora i mitjana són null', () => {
    expect(resumeix([])).toEqual({ millorHora: null, mitjana: null, horesAmbIndex: 0 });
  });

  it("la millor hora és la de l'índex més alt; si n'hi ha d'empatades, la primera", () => {
    const hores = [hora(H(0), 40), hora(H(1), 81), hora(H(2), 81), hora(H(3), 20)];
    const { millorHora, mitjana, horesAmbIndex } = resumeix(hores);
    expect(millorHora?.hora).toBe(H(1));
    expect(mitjana).toBe(56); // 222 / 4 = 55,5
    expect(horesAmbIndex).toBe(4);
  });
});

describe('resolConsulta («A prop meu», TG-133)', () => {
  const ORIGEN = { origen: CONSULTA.origen };

  it('només amb l’origen: cel estrellat, 60 min, 20 punts i la nit sencera en curs', () => {
    // 21:30 locals (CET) del 15 de desembre: la nit és la del 15.
    const res = resolConsulta(ORIGEN, new Date('2026-12-15T20:30:00Z'));
    expect(res).toEqual({
      objectiu: 'cel_estrellat',
      data: '2026-12-15',
      tempsMaxim: TEMPS_MAXIM_PER_DEFECTE,
      limit: LIMIT_PER_DEFECTE,
      // De les 12:00 locals del 15 a les 12:00 del 16 (CET = UTC+1).
      franja: {
        desDe: new Date('2026-12-15T11:00:00Z'),
        finsA: new Date('2026-12-16T11:00:00Z'),
      },
    });
    expect(TEMPS_MAXIM_PER_DEFECTE).toBe(60);
  });

  it.each([
    ['de matinada, la nit que s’acaba', '2026-12-16T03:00:00Z', '2026-12-15'],
    ['a les 05:59, encara la nit que s’acaba', '2026-12-16T04:59:00Z', '2026-12-15'],
    ['a partir de les 06:00, la nit que ve', '2026-12-16T05:00:00Z', '2026-12-16'],
    [
      'al matí, la nit que ve (la que s’acaba només té hores de dia)',
      '2026-12-16T10:59:00Z',
      '2026-12-16',
    ],
    ['a l’estiu (CEST), a les 06:00, la nit que ve', '2027-07-02T04:00:00Z', '2027-07-02'],
  ])('sense data, %s', (_cas, ara, nit) => {
    expect(resolConsulta(ORIGEN, new Date(ara)).data).toBe(nit);
  });

  it('amb data i sense franja: la nit sencera d’aquella data (a l’estiu, CEST)', () => {
    const { franja } = resolConsulta({ ...ORIGEN, data: '2027-07-01' }, ABANS);
    expect(franja).toEqual({
      desDe: new Date('2027-07-01T10:00:00Z'),
      finsA: new Date('2027-07-02T10:00:00Z'),
    });
  });

  it('respecta tot el que porta la consulta', () => {
    const res = resolConsulta({ ...CONSULTA, objectiu: 'via_lactia', limit: 5 }, ABANS);
    expect(res).toEqual({
      objectiu: 'via_lactia',
      data: '2026-12-15',
      tempsMaxim: 150,
      limit: 5,
      franja: { desDe: new Date(H(0)), finsA: new Date(H(8)) },
    });
  });
});

describe('recomanacionsService.getRecomanacions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('demana els punts dins del radi de tempsMaxim i l’índex de la franja en UTC', async () => {
    const { repository, crides } = fakeRepository([punt('a', 10_000)], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);

    expect(res.radiKm).toBe(115.4);
    expect(res.data).toBe('2026-12-15');
    expect(res.tempsMaxim).toBe(150);
    expect(crides.radi).toBe(115_400);
    expect(crides.origen).toEqual(CONSULTA.origen);
    expect(res.franja).toEqual({ desDe: H(0), finsA: H(8) });
    expect(crides.rang).toEqual([['a'], new Date(H(0)), new Date(H(8))]);
  });

  it('«A prop meu»: només amb l’origen, el radi de 60 min i la nit en curs des de l’hora actual', async () => {
    const { repository, crides } = fakeRepository([punt('a', 10_000)], []);
    const ara = new Date('2026-12-15T21:40:00Z'); // 22:40 locals
    const res = await createRecomanacionsService(repository).getRecomanacions(
      { origen: CONSULTA.origen },
      ara,
    );

    expect(res.data).toBe('2026-12-15');
    expect(res.tempsMaxim).toBe(60);
    expect(res.radiKm).toBe(46.2);
    expect(crides.radi).toBe(46_200);
    expect(crides.origen).toEqual(CONSULTA.origen);
    expect(res.franja).toEqual({
      desDe: '2026-12-15T21:00:00.000Z',
      finsA: '2026-12-16T11:00:00.000Z',
    });
  });

  it('ordena per la millor hora, després per la mitjana i després per la distància', async () => {
    const { repository } = fakeRepository(
      [punt('a', 5_000), punt('b', 20_000), punt('c', 30_000), punt('d', 40_000), punt('e', 1_000)],
      [
        // a: millor 60
        { puntId: 'a', ...hora(H(0), 60) },
        // b: millor 90, mitjana 60
        { puntId: 'b', ...hora(H(0), 90) },
        { puntId: 'b', ...hora(H(1), 30) },
        // c: millor 90, mitjana 90
        { puntId: 'c', ...hora(H(3), 90) },
        // d: millor 90, mitjana 90, més lluny que c
        { puntId: 'd', ...hora(H(2), 90) },
        // e: sense índex
      ],
    );
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);

    expect(res.punts.map((p) => p.id)).toEqual(['c', 'd', 'b', 'a', 'e']);
    expect(res.punts[0]).toMatchObject({
      distanciaKm: 30,
      tempsEstimat: 39,
      mitjana: 90,
      horesAmbIndex: 1,
      millorHora: { hora: H(3), valor: 90, franja: 'ras' },
    });
    expect(res.punts[4]).toMatchObject({
      id: 'e',
      millorHora: null,
      mitjana: null,
      horesAmbIndex: 0,
    });
    expect(res.punts[0]).not.toHaveProperty('distanciaM');
  });

  it('sense índex per a la nit (més enllà de la previsió): tots els punts per distància', async () => {
    const { repository } = fakeRepository([punt('a', 9_000), punt('b', 2_000)], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    expect(res.punts.map((p) => [p.id, p.millorHora])).toEqual([
      ['b', null],
      ['a', null],
    ]);
  });

  it('retorna 20 punts per defecte, o els de limit, i el total dins del radi', async () => {
    const punts = Array.from({ length: 30 }, (_, k) => punt(`p${k}`, 1_000 * (k + 1)));
    const { repository } = fakeRepository(punts, []);
    const servei = createRecomanacionsService(repository);

    const perDefecte = await servei.getRecomanacions(CONSULTA, ABANS);
    expect(perDefecte.total).toBe(30);
    expect(perDefecte.punts).toHaveLength(20);

    const cinc = await servei.getRecomanacions({ ...CONSULTA, limit: 5 }, ABANS);
    expect(cinc.total).toBe(30);
    expect(cinc.punts.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  it('el límit es fa després d’ordenar: el millor punt hi és encara que sigui el més llunyà', async () => {
    const punts = Array.from({ length: 30 }, (_, k) => punt(`p${k}`, 1_000 * (k + 1)));
    const { repository } = fakeRepository(punts, [{ puntId: 'p29', ...hora(H(0), 70) }]);
    const res = await createRecomanacionsService(repository).getRecomanacions(
      { ...CONSULTA, limit: 1 },
      ABANS,
    );
    expect(res.punts.map((p) => p.id)).toEqual(['p29']);
  });

  it('arrodoneix la distància a 1 decimal', async () => {
    const { repository } = fakeRepository([punt('a', 12_345)], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    expect(res.punts[0]?.distanciaKm).toBe(12.3);
  });

  it("si la franja ja ha començat, només compten les hores des de l'hora en curs", async () => {
    const { repository, crides } = fakeRepository(
      [punt('a', 1_000)],
      [
        { puntId: 'a', ...hora(H(0), 95) },
        { puntId: 'a', ...hora(H(3), 50) },
      ],
    );
    const now = new Date(Date.parse(H(2)) + 25 * 60_000);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, now);

    expect(res.franja.desDe).toBe(H(2));
    expect(crides.rang?.[1]).toEqual(new Date(H(2)));
    expect(res.punts[0]?.millorHora?.valor).toBe(50);
  });

  it('si la franja ja ha acabat → 400 franja_passada, sense tocar la base de dades', async () => {
    const { repository, crides } = fakeRepository([punt('a', 1_000)], []);
    const promesa = createRecomanacionsService(repository).getRecomanacions(
      CONSULTA,
      new Date(H(8)),
    );
    await expect(promesa).rejects.toMatchObject({ status: 400, code: 'franja_passada' });
    expect(crides.radi).toBeUndefined();
  });

  it('cap punt dins del radi: llista buida', async () => {
    const { repository } = fakeRepository([], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    expect(res.punts).toEqual([]);
  });

  it('un error de la base de dades → 503 database_unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { repository } = fakeRepository([], [], new Error('connexió tancada'));
    const promesa = createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    await expect(promesa).rejects.toBeInstanceOf(ApiError);
    await expect(promesa).rejects.toMatchObject({ status: 503, code: 'database_unavailable' });
  });
});

describe('recomanacionsService.getRecomanacions amb esdevenimentId (TG-140)', () => {
  afterEach(() => jest.restoreAllMocks());

  // Leònides 2026: activitat del 6 al 30/11, màxim el 17/11 a les 23:45 UTC (precisió de dia).
  const LEONIDES: FilaEsdeveniment = {
    codi: 'leonids-2026',
    tipus: 'pluja_estels',
    inici: new Date('2026-11-06T00:00:00Z'),
    fi: new Date('2026-11-30T23:59:59Z'),
    maxim: new Date('2026-11-17T23:45:00Z'),
    precisio: { inici: 'dia', fi: 'dia', maxim: 'minut' },
    textosFenomen: {},
    textosEsdeveniment: {},
    organitzacio: 'IMO',
    metodeCalcul: null,
  };
  // Conjunció Lluna–Júpiter: de 05:30 a 06:30 UTC del 30/11.
  const CONJUNCIO: FilaEsdeveniment = {
    ...LEONIDES,
    codi: 'conjuncio-lluna-jupiter-2026-11-30',
    tipus: 'conjuncio',
    inici: new Date('2026-11-30T05:30:00Z'),
    fi: new Date('2026-11-30T06:30:00Z'),
    maxim: new Date('2026-11-30T06:00:00Z'),
    precisio: { inici: 'hora', fi: 'hora', maxim: 'hora' },
  };
  const ARA = new Date('2026-11-16T10:00:00Z');
  const ORIGEN = { origen: CONSULTA.origen };
  // De 18:00 UTC del 17/11 en endavant: dins de la nit del màxim.
  const N = (n: number) => new Date(Date.parse('2026-11-17T18:00:00Z') + n * HORA_MS).toISOString();

  function font(fila?: FilaEsdeveniment, error?: Error) {
    const ids: string[] = [];
    const esdeveniments: EsdevenimentsFont = {
      async findPublicById(id) {
        ids.push(id);
        if (error) throw error;
        return fila;
      },
    };
    return { esdeveniments, ids };
  }

  it('la franja és la nit del màxim i el rànquing va per l’índex màxim de la finestra', async () => {
    const { repository, crides } = fakeRepository(
      [punt('a', 5_000), punt('b', 20_000), punt('c', 1_000)],
      [
        // a: un pic de 92 dins de la finestra
        { puntId: 'a', ...hora(N(0), 30) },
        { puntId: 'a', ...hora(N(5), 92) },
        // b: 75 tota la nit (mitjana més alta, però màxim més baix)
        { puntId: 'b', ...hora(N(0), 75) },
        { puntId: 'b', ...hora(N(5), 75) },
        // c: fora de la finestra (el migdia del 18/11) no compta
        { puntId: 'c', ...hora('2026-11-18T12:00:00.000Z', 99) },
      ],
    );
    const { esdeveniments, ids } = font(LEONIDES);
    const res = await createRecomanacionsService(
      repository,
      undefined,
      esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: 'leonids-2026' }, ARA);

    expect(ids).toEqual(['leonids-2026']);
    expect(res.data).toBe('2026-11-17');
    expect(res.franja).toEqual({
      desDe: '2026-11-17T11:00:00.000Z',
      finsA: '2026-11-18T11:00:00.000Z',
    });
    expect(crides.rang?.slice(1)).toEqual([
      new Date('2026-11-17T11:00:00Z'),
      new Date('2026-11-18T11:00:00Z'),
    ]);
    expect(res.punts.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(res.punts[0]?.millorHora).toMatchObject({ hora: N(5), valor: 92 });
    expect(res.esdeveniment).toEqual({
      id: 'leonids-2026',
      inici: '2026-11-06T00:00:00.000Z',
      maxim: '2026-11-17T23:45:00.000Z',
      fi: '2026-11-30T23:59:59.000Z',
    });
    expect(res).not.toHaveProperty('avis');
  });

  it('sense tempsMaxim considera tot el catàleg i prioritza la proximitat entre índexs semblants', async () => {
    const { repository, crides } = fakeRepository(
      [punt('lluny', 150_000), punt('prop', 20_000), punt('sense-index', 1_000)],
      [
        { puntId: 'lluny', ...hora(N(0), 87) },
        { puntId: 'prop', ...hora(N(0), 85) },
      ],
    );
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: LEONIDES.codi }, ARA);
    expect(crides.radi).toBeNull();
    expect(crides.rang?.[0]).toEqual(['lluny', 'prop', 'sense-index']);
    expect(res.tempsMaxim).toBeNull();
    expect(res.radiKm).toBeNull();
    expect(res.punts.map((p) => p.id)).toEqual(['prop', 'lluny', 'sense-index']);
    expect(res.punts[0]?.distanciaKm).toBe(20);
    expect(res.punts[1]?.distanciaKm).toBe(150);
  });

  it('manté la prioritat de qualitat entre franges i aplica limit després de combinar índex i distància', async () => {
    const { repository } = fakeRepository(
      [
        punt('baix-prop', 100),
        punt('bo-prop', 20_000),
        punt('bo-lluny', 150_000),
        punt('millor', 300_000),
      ],
      [
        { puntId: 'baix-prop', ...hora(N(0), 39) },
        { puntId: 'bo-prop', ...hora(N(0), 85) },
        { puntId: 'bo-lluny', ...hora(N(0), 87) },
        { puntId: 'millor', ...hora(N(0), 95) },
      ],
    );
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: LEONIDES.codi, limit: 2 }, ARA);
    expect(res.total).toBe(4);
    expect(res.punts.map((p) => p.id)).toEqual(['millor', 'bo-prop']);
  });

  it('amb 30 km per punt, el 100 a 150 km guanya el 95 a 20 km i conserva els índexs reals', async () => {
    const { repository } = fakeRepository(
      [punt('cent', 150_000), punt('noranta-cinc', 20_000)],
      [
        { puntId: 'cent', ...hora(N(0), 100) },
        { puntId: 'noranta-cinc', ...hora(N(0), 95) },
      ],
    );
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: LEONIDES.codi }, ARA);
    expect(res.punts.map((p) => [p.id, p.millorHora?.valor])).toEqual([
      ['cent', 100],
      ['noranta-cinc', 95],
    ]);
  });

  it('respecta el radi de tempsMaxim i el limit', async () => {
    const punts = Array.from({ length: 5 }, (_, k) => punt(`p${k}`, 1_000 * (k + 1)));
    const { repository, crides } = fakeRepository(punts, [{ puntId: 'p0', ...hora(N(0), 50) }]);
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions(
      { ...ORIGEN, esdevenimentId: 'leonids-2026', tempsMaxim: 150, limit: 2 },
      ARA,
    );
    expect(crides.radi).toBe(115_400);
    expect(res.total).toBe(5);
    expect(res.punts).toHaveLength(2);
  });

  it('hores conegudes: [inici, fi] ampliada a les hores senceres', async () => {
    const { repository } = fakeRepository([punt('a', 1_000)], []);
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(CONJUNCIO).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: CONJUNCIO.codi }, ARA);
    expect(res.franja).toEqual({
      desDe: '2026-11-30T05:00:00.000Z',
      finsA: '2026-11-30T06:30:00.000Z',
    });
  });

  it('una pluja amb el màxim passat però encara activa: la nit que toca, des de l’hora en curs', async () => {
    const { repository } = fakeRepository([punt('a', 1_000)], []);
    const ara = new Date('2026-11-20T21:20:00Z'); // 22:20 locals del 20/11
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: 'leonids-2026' }, ara);
    expect(res.data).toBe('2026-11-20');
    expect(res.franja).toEqual({
      desDe: '2026-11-20T21:00:00.000Z',
      finsA: '2026-11-21T11:00:00.000Z',
    });
  });

  it('sense índex a la finestra: avis sense_previsio i els punts per distància', async () => {
    const { repository } = fakeRepository(
      [punt('lluny', 40_000), punt('prop', 2_000), punt('mig', 15_000)],
      [],
    );
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: 'leonids-2026' }, ARA);
    expect(res.avis).toBe('sense_previsio');
    expect(res.punts.map((p) => [p.id, p.distanciaKm, p.millorHora, p.horesAmbIndex])).toEqual([
      ['prop', 2, null, 0],
      ['mig', 15, null, 0],
      ['lluny', 40, null, 0],
    ]);
  });

  it('cap punt dins del radi: llista buida i sense avis (no és un problema de previsió)', async () => {
    const { repository } = fakeRepository([], []);
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: 'leonids-2026' }, ARA);
    expect(res.punts).toEqual([]);
    expect(res).not.toHaveProperty('avis');
  });

  it('un esdeveniment que no existeix → 404 event_not_found, sense tocar els punts', async () => {
    const { repository, crides } = fakeRepository([punt('a', 1_000)], []);
    const promesa = createRecomanacionsService(
      repository,
      undefined,
      font(undefined).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: 'no-existeix' }, ARA);
    await expect(promesa).rejects.toMatchObject({ status: 404, code: 'event_not_found' });
    expect(crides.radi).toBeUndefined();
  });

  it('un esdeveniment ja acabat → 400 franja_passada', async () => {
    const { repository } = fakeRepository([punt('a', 1_000)], []);
    const promesa = createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions(
      { ...ORIGEN, esdevenimentId: 'leonids-2026' },
      new Date('2026-12-01T00:00:00Z'),
    );
    await expect(promesa).rejects.toMatchObject({ status: 400, code: 'franja_passada' });
  });

  it('un error en llegir l’esdeveniment → 503 database_unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { repository } = fakeRepository([], []);
    const promesa = createRecomanacionsService(
      repository,
      undefined,
      font(undefined, new Error('connexió tancada')).esdeveniments,
    ).getRecomanacions({ ...ORIGEN, esdevenimentId: 'leonids-2026' }, ARA);
    await expect(promesa).rejects.toMatchObject({ status: 503, code: 'database_unavailable' });
  });

  it('sense font d’esdeveniments → 503 database_unavailable', async () => {
    const { repository } = fakeRepository([], []);
    const promesa = createRecomanacionsService(repository).getRecomanacions(
      { ...ORIGEN, esdevenimentId: 'leonids-2026' },
      ARA,
    );
    await expect(promesa).rejects.toMatchObject({ status: 503, code: 'database_unavailable' });
  });

  it('sense esdevenimentId, la resposta no porta esdeveniment ni avis', async () => {
    const { repository } = fakeRepository([punt('a', 1_000)], []);
    const res = await createRecomanacionsService(
      repository,
      undefined,
      font(LEONIDES).esdeveniments,
    ).getRecomanacions(CONSULTA, ABANS);
    expect(res).not.toHaveProperty('esdeveniment');
    expect(res).not.toHaveProperty('avis');
  });
});

describe('ordre estable del rànquing d’esdeveniments', () => {
  const recommendation = (id: string, value: number | null, distance: number) => ({
    ...punt(id, distance * 1000),
    distanciaKm: distance,
    tempsEstimat: 20,
    millorHora: value === null ? null : hora(H(0), value),
    mitjana: value,
    horesAmbIndex: value === null ? 0 : 1,
  });

  it('la puntuació contínua i els desempats donen el mateix ordre amb entrades diferents', () => {
    const points = [
      recommendation('a', 87, 150),
      recommendation('b', 85, 20),
      recommendation('c', 83, 1),
      recommendation('d', 87, 20),
      recommendation('e', 87, 20),
      recommendation('f', null, 1),
      recommendation('g', null, 2),
      recommendation('h', 100, 300),
      recommendation('i', 0, 2),
    ];
    const expected = ['h', 'd', 'e', 'b', 'c', 'a', 'i', 'f', 'g'];
    for (const input of [
      points,
      [...points].reverse(),
      [...points.slice(3), ...points.slice(0, 3)],
    ]) {
      expect([...input].sort(compareEventRecommendations).map((p) => p.id)).toEqual(expected);
    }
  });

  it.each([
    [39, 40],
    [69, 70],
  ])('el %i proper no avança el %i de la franja superior', (low, high) => {
    expect(
      compareEventRecommendations(
        recommendation('prop', low, 1),
        recommendation('lluny', high, 300),
      ),
    ).toBeGreaterThan(0);
  });

  it.each([
    [89, 90],
    [99, 100],
    [84, 85],
  ])(
    'el %i a 20 km avança el %i a 150 km, sense salts artificials entre índexs semblants',
    (near, far) => {
      expect(
        compareEventRecommendations(
          recommendation('prop', near, 20),
          recommendation('lluny', far, 150),
        ),
      ).toBeLessThan(0);
    },
  );

  it('limita la penalització a 10 punts perquè una diferència gran d’índex continuï pesant', () => {
    expect(
      compareEventRecommendations(recommendation('bo', 100, 1000), recommendation('prop', 89, 0)),
    ).toBeLessThan(0);
  });

  it('amb la mateixa puntuació ajustada prioritza la distància', () => {
    expect(
      compareEventRecommendations(recommendation('prop', 93, 60), recommendation('lluny', 95, 120)),
    ).toBeLessThan(0);
  });

  it('dona una mica més de pes a l’índex en una comparació ajustada', () => {
    expect(
      compareEventRecommendations(
        recommendation('millor-index', 95, 65),
        recommendation('mes-prop', 93, 20),
      ),
    ).toBeLessThan(0);
  });

  it('el 100 a 102,8 km guanya el 92 a 63 km amb el pes acordat', () => {
    expect(
      compareEventRecommendations(
        recommendation('cent', 100, 102.8),
        recommendation('noranta-dos', 92, 63),
      ),
    ).toBeLessThan(0);
  });
});

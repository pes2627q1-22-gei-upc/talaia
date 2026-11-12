import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  OpenMeteoError,
  calculaIndex,
  efemeridesHora,
  type Coordenades,
  type OpenMeteoClient,
} from '@talaia/index';
import type { PrevisioMeteoHora } from '@talaia/shared';

import { ApiError } from '../../middleware/errors';
import {
  HORES_CONSULTABLES,
  MAX_ANTIGUITAT_STALE_MS,
  RADI_SQM_M,
  cellaDe,
  createVisibilitatService,
  properaActualitzacio,
  type SqmProper,
  type VisibilitatDeps,
} from '../visibilitatService';

const HORA_MS = 3_600_000;
/** Una nit d'hivern: a les 21:20 UTC el Sol és molt sota l'horitzó a tot Catalunya. */
const ARA = Date.parse('2026-12-15T21:20:00Z');
const HORA_ACTUAL = '2026-12-15T21:00:00.000Z';
/** El Mirador de Solsona, una ubicació qualsevol (no és al catàleg). */
const LLOC = { lat: 41.9522, lon: 1.5237 };

/** Una hora de previsió amb el cel ras, o amb els canvis que es diguin. */
const hora = (iso: string, canvis: Partial<PrevisioMeteoHora> = {}): PrevisioMeteoHora => ({
  hora: iso,
  nuvolsTotal: 0,
  nuvolsBaixos: 0,
  nuvolsMitjans: 0,
  nuvolsAlts: 0,
  humitat: 70,
  visibilitat: 30_000,
  temperatura: 3,
  puntRosada: -2,
  precipitacio: 0,
  probabilitatPrecipitacio: 0,
  ventVelocitat: 5,
  ventRafegues: 10,
  ventDireccio: 0,
  ...canvis,
});

/** 4 dies de previsió des de les 00:00 UTC del dia de `t`, com la d'Open-Meteo. */
function previsioDe(t: number, canvis: Partial<PrevisioMeteoHora> = {}): PrevisioMeteoHora[] {
  const inici = Math.floor(t / 86_400_000) * 86_400_000;
  return Array.from({ length: 96 }, (_, i) =>
    hora(new Date(inici + i * HORA_MS).toISOString(), canvis),
  );
}

/** Rellotge fals i client d'Open-Meteo fals, que compta les crides i guarda els llocs demanats. */
function entorn(deps: Partial<VisibilitatDeps> = {}) {
  let t = ARA;
  const llocs: Coordenades[][] = [];
  const meteo: OpenMeteoClient = {
    previsio: jest.fn(async (demanats: Coordenades[]) => {
      llocs.push(demanats);
      return demanats.map(() => previsioDe(t));
    }),
  };
  const service = createVisibilitatService({ meteo, now: () => t, ...deps });
  return {
    service,
    meteo,
    llocs,
    crides: () => (meteo.previsio as jest.Mock).mock.calls.length,
    avanca: (ms: number) => (t += ms),
  };
}

/** L'error controlat que llança la promesa (status i code). */
async function errorDe(promesa: Promise<unknown>): Promise<Pick<ApiError, 'status' | 'code'>> {
  const err = await promesa.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(err instanceof ApiError)) throw new Error(`S'esperava un ApiError i ha arribat ${err}`);
  return { status: err.status, code: err.code };
}

/** Els punts del catàleg amb SQM, per fer un `sqmProper` com el de la base de dades. */
const CATALEG = (
  JSON.parse(
    readFileSync(resolve(__dirname, '../../../../../data/punts_observacio.geojson'), 'utf8'),
  ) as {
    features: { geometry: { coordinates: [number, number] }; properties: { sqm: number | null } }[];
  }
).features.flatMap(
  ({
    geometry: {
      coordinates: [lon, lat],
    },
    properties: { sqm },
  }) => (sqm === null ? [] : [{ lat, lon, sqm }]),
);

/** Distància en metres sobre l'esfera (com `st_distance` sobre `geography`, a uns metres). */
function distanciaM(a: Coordenades, b: Coordenades): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}

/** La consulta de `sqmRepository` sobre el catàleg: el punt amb SQM més proper dins del radi. */
const sqmDelCataleg = jest.fn<ReturnType<SqmProper>, Parameters<SqmProper>>(
  async (lloc, metres) => {
    const proper = CATALEG.map((p) => ({ p, d: distanciaM(lloc, p) }))
      .filter(({ d }) => d <= metres)
      .sort((x, y) => x.d - y.d)[0];
    return proper ? proper.p : null;
  },
);

/** El Cortalet (Aiguamolls de l'Empordà), al catàleg amb SQM 20,58, a la cel·la (42,22, 3,09). */
const CORTALET = { lat: 42.224568, lon: 3.092703 };

beforeEach(() => {
  sqmDelCataleg.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('cellaDe', () => {
  it('arrodoneix les coordenades a 0,01°', () => {
    expect(cellaDe(41.9522, 1.5237)).toEqual({ lat: 41.95, lon: 1.52 });
    expect(cellaDe(41.955, 1.5251)).toEqual({ lat: 41.96, lon: 1.53 });
    expect(cellaDe(42.0294, 0.7112)).toEqual({ lat: 42.03, lon: 0.71 });
  });
});

describe('properaActualitzacio', () => {
  it('és el minut 5 següent (UTC), quan el worker torna a demanar la previsió', () => {
    expect(properaActualitzacio(Date.parse('2026-12-15T21:20:00Z'))).toBe(
      Date.parse('2026-12-15T22:05:00Z'),
    );
    expect(properaActualitzacio(Date.parse('2026-12-15T21:04:59Z'))).toBe(
      Date.parse('2026-12-15T21:05:00Z'),
    );
    expect(properaActualitzacio(Date.parse('2026-12-15T21:05:00Z'))).toBe(
      Date.parse('2026-12-15T22:05:00Z'),
    );
  });
});

describe('createVisibilitatService', () => {
  it("calcula l'índex de l'hora en curs a la cel·la amb la fórmula de @talaia/index", async () => {
    const { service, llocs } = entorn();

    const { resposta, cache } = await service.getVisibilitat(LLOC);

    const cella = { lat: 41.95, lon: 1.52 };
    const esperat = calculaIndex({
      meteo: hora(HORA_ACTUAL),
      efemerides: efemeridesHora(cella, HORA_ACTUAL),
      sqm: null,
    });
    expect(llocs).toEqual([[cella]]);
    expect(cache).toBe('MISS');
    expect(resposta).toEqual({ ...cella, sqm: null, index: esperat, deDia: false });
    expect(resposta.index.hora).toBe(HORA_ACTUAL);
    expect(resposta.index.foscorEstimada).toBe(true);
    expect(resposta.index.factors.sol).toBe(1);
  });

  it("compta l'hora que conté `hora`, també amb una zona que no és UTC", async () => {
    const { service } = entorn();

    const { resposta } = await service.getVisibilitat({
      ...LLOC,
      hora: '2026-12-16T03:59:59+01:00',
    });

    expect(resposta.index.hora).toBe('2026-12-16T02:00:00.000Z');
  });

  it('de dia, deDia és cert i el valor és 0', async () => {
    const { service } = entorn();

    const { resposta } = await service.getVisibilitat({ ...LLOC, hora: '2026-12-16T12:00:00Z' });

    expect(resposta.deDia).toBe(true);
    expect(resposta.index.valor).toBe(0);
  });

  describe('memòria cau', () => {
    it('una segona consulta del mateix lloc i hora surt de la memòria cau', async () => {
      const { service, crides } = entorn();

      const primera = await service.getVisibilitat(LLOC);
      const segona = await service.getVisibilitat(LLOC);

      expect(primera.cache).toBe('MISS');
      expect(segona.cache).toBe('HIT');
      expect(segona.resposta).toEqual(primera.resposta);
      expect(crides()).toBe(1);
    });

    it('una altra hora o un altre lloc de la mateixa cel·la tampoc no criden Open-Meteo', async () => {
      const { service, crides } = entorn();
      await service.getVisibilitat(LLOC);

      const altraHora = await service.getVisibilitat({ ...LLOC, hora: '2026-12-17T23:00:00Z' });
      const aProp = await service.getVisibilitat({ lat: 41.9549, lon: 1.5151 });

      expect([altraHora.cache, aProp.cache]).toEqual(['HIT', 'HIT']);
      expect(crides()).toBe(1);
    });

    it('una altra cel·la demana la seva previsió', async () => {
      const { service, crides } = entorn();
      await service.getVisibilitat(LLOC);

      const { cache } = await service.getVisibilitat({ lat: 41.96, lon: 1.5237 });

      expect(cache).toBe('MISS');
      expect(crides()).toBe(2);
    });

    it("caduca al minut 5 de l'hora següent", async () => {
      const { service, crides, avanca } = entorn();
      await service.getVisibilitat(LLOC); // 21:20

      avanca(44 * 60_000); // 22:04
      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'HIT' });
      avanca(60_000); // 22:05
      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'MISS' });
      expect(crides()).toBe(2);
    });

    it("si la previsió desada no arriba a l'hora demanada, la torna a demanar", async () => {
      // 23:30: la previsió acaba a les 23:00 de d'aquí a 3 dies, just 72 h endavant.
      const { service, crides, avanca } = entorn();
      avanca(2 * HORA_MS + 10 * 60_000);
      await service.getVisibilitat(LLOC);

      avanca(32 * 60_000); // 00:02: encara no ha caducat, però +72 h ja és l'endemà.
      const { resposta, cache } = await service.getVisibilitat({
        ...LLOC,
        hora: '2026-12-19T00:00:00Z',
      });

      expect(cache).toBe('MISS');
      expect(resposta.index.hora).toBe('2026-12-19T00:00:00.000Z');
      expect(crides()).toBe(2);
    });

    it('les consultes simultànies de la mateixa cel·la fan una sola crida, i les que esperen són un HIT', async () => {
      const { service, crides } = entorn();

      const respostes = await Promise.all([
        service.getVisibilitat(LLOC),
        service.getVisibilitat(LLOC),
        service.getVisibilitat({ ...LLOC, hora: '2026-12-16T01:00:00Z' }),
      ]);

      expect(crides()).toBe(1);
      expect(respostes.map((r) => r.resposta.index.hora)).toEqual([
        HORA_ACTUAL,
        HORA_ACTUAL,
        '2026-12-16T01:00:00.000Z',
      ]);
      // Només la primera ha cridat Open-Meteo: les altres l'han esperada, i són un HIT.
      expect(respostes.map((r) => r.cache)).toEqual(['MISS', 'HIT', 'HIT']);
    });

    it('guarda com a molt `maxCelles` cel·les', async () => {
      const { service, crides } = entorn({ maxCelles: 1 });
      await service.getVisibilitat(LLOC);
      await service.getVisibilitat({ lat: 41.39, lon: 2.17 });

      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'MISS' });
      expect(crides()).toBe(3);
    });
  });

  describe('foscor', () => {
    it("amb un punt del catàleg a la mateixa cel·la, l'SQM és mesurat", async () => {
      const { service } = entorn({ sqmProper: sqmDelCataleg });

      const { resposta } = await service.getVisibilitat({ lat: 42.2236, lon: 3.0912 });

      expect(sqmDelCataleg).toHaveBeenCalledWith({ lat: 42.22, lon: 3.09 }, RADI_SQM_M);
      expect(resposta.sqm).toBe(20.58);
      expect(resposta.index.foscorEstimada).toBe(false);
      expect(resposta.index.factors.foscor).toBe(0.77);
    });

    it("l'SQM d'un punt d'una cel·la veïna es fa servir, però la foscor és estimada", async () => {
      const { service } = entorn({ sqmProper: sqmDelCataleg });

      // La cel·la (42,23, 3,09) és a uns 640 m del Cortalet, dins del radi.
      const { resposta } = await service.getVisibilitat({ lat: 42.2306, lon: 3.0927 });

      expect(distanciaM({ lat: 42.23, lon: 3.09 }, CORTALET)).toBeLessThan(RADI_SQM_M);
      expect(resposta.sqm).toBe(20.58);
      expect(resposta.index.factors.foscor).toBe(0.77);
      expect(resposta.index.foscorEstimada).toBe(true);
    });

    it("Empuriabrava no pren l'SQM del Cortalet, a 3,6 km: la foscor és estimada", async () => {
      const { service } = entorn({ sqmProper: sqmDelCataleg });

      const { resposta } = await service.getVisibilitat({ lat: 42.25, lon: 3.12 });

      expect(distanciaM({ lat: 42.25, lon: 3.12 }, CORTALET)).toBeGreaterThan(3_500);
      expect(resposta.sqm).toBeNull();
      expect(resposta.index.foscorEstimada).toBe(true);
      expect(resposta.index.factors.foscor).toBe(0.6);
    });

    it("l'SQM també es desa a la memòria cau", async () => {
      const { service } = entorn({ sqmProper: sqmDelCataleg });

      await service.getVisibilitat(CORTALET);
      await service.getVisibilitat(CORTALET);

      expect(sqmDelCataleg).toHaveBeenCalledTimes(1);
    });

    it('si la base de dades falla, la foscor és estimada, no es desa i es torna a provar', async () => {
      let falla = true;
      const sqmProper = jest.fn<ReturnType<SqmProper>, Parameters<SqmProper>>(async (...args) => {
        if (falla) throw new Error('connexió tancada');
        return sqmDelCataleg(...args);
      });
      const { service, crides } = entorn({ sqmProper });

      const primera = await service.getVisibilitat(CORTALET);
      falla = false;
      const segona = await service.getVisibilitat(CORTALET);

      expect(primera.resposta.sqm).toBeNull();
      expect(primera.resposta.index.foscorEstimada).toBe(true);
      expect(segona.resposta.sqm).toBe(20.58);
      expect(segona.resposta.index.foscorEstimada).toBe(false);
      expect(sqmProper).toHaveBeenCalledTimes(2);
      // La previsió sí que s'ha desat: la segona no crida Open-Meteo.
      expect(segona.cache).toBe('HIT');
      expect(crides()).toBe(1);
    });

    it('una base de dades lenta no fa esperar la resposta més que el timeout', async () => {
      const lenta = jest.fn<ReturnType<SqmProper>, Parameters<SqmProper>>(
        () => new Promise((resolve) => setTimeout(() => resolve({ ...CORTALET, sqm: 20.58 }), 300)),
      );
      const { service } = entorn({ sqmProper: lenta, timeoutSqmMs: 20 });

      const inici = Date.now();
      const { resposta } = await service.getVisibilitat(CORTALET);

      expect(Date.now() - inici).toBeLessThan(250);
      expect(resposta.sqm).toBeNull();
      expect(resposta.index.foscorEstimada).toBe(true);
      // El timeout tampoc no es desa.
      await service.getVisibilitat(CORTALET);
      expect(lenta).toHaveBeenCalledTimes(2);
    });
  });

  describe('errors', () => {
    it('fora de Catalunya: 422 fora_de_catalunya, sense cridar Open-Meteo', async () => {
      const { service, crides } = entorn();

      await expect(errorDe(service.getVisibilitat({ lat: 42.5063, lon: 1.5218 }))).resolves.toEqual(
        { status: 422, code: 'fora_de_catalunya' },
      );
      await expect(
        errorDe(service.getVisibilitat({ lat: 40.4168, lon: -3.7038 })),
      ).resolves.toEqual({ status: 422, code: 'fora_de_catalunya' });
      expect(crides()).toBe(0);
    });

    it(`una hora passada o de més de ${HORES_CONSULTABLES} h endavant: 422 hora_sense_previsio`, async () => {
      const { service, crides } = entorn();
      const fins = new Date(Date.parse(HORA_ACTUAL) + HORES_CONSULTABLES * HORA_MS).toISOString();

      await expect(
        errorDe(service.getVisibilitat({ ...LLOC, hora: '2026-12-15T20:59:59Z' })),
      ).resolves.toEqual({ status: 422, code: 'hora_sense_previsio' });
      await expect(
        errorDe(
          service.getVisibilitat({
            ...LLOC,
            hora: new Date(Date.parse(fins) + HORA_MS).toISOString(),
          }),
        ),
      ).resolves.toEqual({ status: 422, code: 'hora_sense_previsio' });
      expect(crides()).toBe(0);
      // El límit, inclòs.
      await expect(service.getVisibilitat({ ...LLOC, hora: fins })).resolves.toBeDefined();
    });

    it("si Open-Meteo no torna l'hora, 422 hora_sense_previsio", async () => {
      const meteo: OpenMeteoClient = { previsio: async () => [previsioDe(ARA).slice(0, 24)] };
      const { service } = entorn({ meteo });

      await expect(
        errorDe(service.getVisibilitat({ ...LLOC, hora: '2026-12-17T10:00:00Z' })),
      ).resolves.toEqual({ status: 422, code: 'hora_sense_previsio' });
    });

    it('si Open-Meteo falla: 503 meteo_unavailable, i no es desa a la memòria cau', async () => {
      let falla = true;
      const meteo: OpenMeteoClient = {
        previsio: jest.fn(async (llocs: Coordenades[]) => {
          if (falla) throw new OpenMeteoError('Open-Meteo ha respost 502: Bad Gateway', 502);
          return llocs.map(() => previsioDe(ARA));
        }),
      };
      const { service } = entorn({ meteo });

      await expect(errorDe(service.getVisibilitat(LLOC))).resolves.toEqual({
        status: 503,
        code: 'meteo_unavailable',
      });
      falla = false;
      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'MISS' });
      expect(meteo.previsio).toHaveBeenCalledTimes(2);
    });

    it('no posa les coordenades al log quan Open-Meteo falla', async () => {
      const meteo: OpenMeteoClient = {
        previsio: async () => {
          throw new OpenMeteoError("No s'ha pogut contactar amb Open-Meteo: timeout");
        },
      };
      const { service } = entorn({ meteo });

      await errorDe(service.getVisibilitat(LLOC));

      const log = (console.error as jest.Mock).mock.calls.flat().join(' ');
      expect(log).toContain('Open-Meteo');
      expect(log).not.toMatch(/41\.95|1\.52/);
    });

    it('passat el sostre de consultes per hora: 503, però les cel·les desades es continuen servint', async () => {
      const { service, crides, avanca } = entorn({ maxPrevisionsPerHora: 2 });
      await service.getVisibilitat(LLOC);
      await service.getVisibilitat({ lat: 41.39, lon: 2.17 });

      await expect(errorDe(service.getVisibilitat({ lat: 41.98, lon: 2.82 }))).resolves.toEqual({
        status: 503,
        code: 'meteo_unavailable',
      });
      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'HIT' });
      expect(crides()).toBe(2);
      expect(console.warn).toHaveBeenCalledTimes(1);

      avanca(40 * 60_000); // 22:00: hora nova, el comptador torna a zero.
      await expect(service.getVisibilitat({ lat: 41.98, lon: 2.82 })).resolves.toMatchObject({
        cache: 'MISS',
      });
    });
  });

  describe('previsió caducada (STALE)', () => {
    /** Open-Meteo que respon fins que `falla` és cert. */
    function meteoQueFalla() {
      const estat = { falla: false, t: ARA };
      const meteo: OpenMeteoClient = {
        previsio: jest.fn(async (llocs: Coordenades[]) => {
          if (estat.falla) throw new OpenMeteoError('Open-Meteo ha respost 503: overloaded', 503);
          return llocs.map(() => previsioDe(estat.t));
        }),
      };
      return { meteo, estat };
    }

    it('si Open-Meteo falla, serveix la previsió caducada de la cel·la amb X-Cache: STALE', async () => {
      const { meteo, estat } = meteoQueFalla();
      const { service, avanca } = entorn({ meteo });
      await service.getVisibilitat(LLOC); // 21:20, caduca a les 22:05

      avanca(HORA_MS); // 22:20
      estat.falla = true;
      const { resposta, cache } = await service.getVisibilitat(LLOC);

      expect(cache).toBe('STALE');
      expect(resposta.index.hora).toBe('2026-12-15T22:00:00.000Z');
      expect(meteo.previsio).toHaveBeenCalledTimes(2);
    });

    it(`una previsió caducada fa més de ${MAX_ANTIGUITAT_STALE_MS / HORA_MS} h ja no es fa servir: 503`, async () => {
      const { meteo, estat } = meteoQueFalla();
      const { service, avanca } = entorn({ meteo });
      await service.getVisibilitat(LLOC); // caduca a les 22:05

      avanca(45 * 60_000 + MAX_ANTIGUITAT_STALE_MS - 60_000); // 04:04: encara no
      estat.falla = true;
      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'STALE' });
      avanca(60_000); // 04:05
      await expect(errorDe(service.getVisibilitat(LLOC))).resolves.toEqual({
        status: 503,
        code: 'meteo_unavailable',
      });
    });

    it('passat el sostre global, una cel·la caducada també surt com a STALE', async () => {
      const { service, avanca } = entorn({ maxPrevisionsPerHora: 1 });
      await service.getVisibilitat(LLOC); // 21:20, la primera de l'hora

      avanca(50 * 60_000); // 22:10: ha caducat i és una hora nova
      await service.getVisibilitat({ lat: 41.39, lon: 2.17 }); // gasta la de les 22
      await expect(service.getVisibilitat(LLOC)).resolves.toMatchObject({ cache: 'STALE' });
    });
  });

  describe('límit per client', () => {
    it('un client pot fer com a molt `maxPrevisionsPerClient` consultes noves per hora: 429', async () => {
      const { service, crides } = entorn({ maxPrevisionsPerClient: 2 });
      await service.getVisibilitat(LLOC, '203.0.113.7');
      await service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '203.0.113.7');

      const err = await service
        .getVisibilitat({ lat: 41.98, lon: 2.82 }, '203.0.113.7')
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ status: 429, code: 'too_many_requests' });
      // 21:20: falten 40 minuts per a l'hora següent.
      expect((err as ApiError).headers).toEqual({ 'Retry-After': String(40 * 60) });
      expect(crides()).toBe(2);
    });

    it('les cel·les ja desades i les dels altres clients no hi compten', async () => {
      const { service, crides } = entorn({ maxPrevisionsPerClient: 1 });
      await service.getVisibilitat(LLOC, '203.0.113.7');

      // El mateix client torna a la mateixa cel·la: HIT, no és una consulta nova.
      await expect(service.getVisibilitat(LLOC, '203.0.113.7')).resolves.toMatchObject({
        cache: 'HIT',
      });
      // Un altre client pot fer la seva consulta nova.
      await expect(
        service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '198.51.100.4'),
      ).resolves.toMatchObject({ cache: 'MISS' });
      // I el primer, la cel·la que ha portat l'altre.
      await expect(
        service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '203.0.113.7'),
      ).resolves.toMatchObject({ cache: 'HIT' });
      expect(crides()).toBe(2);
    });

    it("esperar la càrrega d'un altre client no compta com a consulta nova", async () => {
      const { service } = entorn({ maxPrevisionsPerClient: 1 });
      await Promise.all([
        service.getVisibilitat(LLOC, '198.51.100.4'),
        service.getVisibilitat(LLOC, '203.0.113.7'),
      ]);

      await expect(
        service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '203.0.113.7'),
      ).resolves.toMatchObject({ cache: 'MISS' });
    });

    it("a l'hora següent es torna a començar", async () => {
      const { service, avanca } = entorn({ maxPrevisionsPerClient: 1 });
      await service.getVisibilitat(LLOC, '203.0.113.7');
      await expect(
        errorDe(service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '203.0.113.7')),
      ).resolves.toEqual({ status: 429, code: 'too_many_requests' });

      avanca(40 * 60_000); // 22:00
      await expect(
        service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '203.0.113.7'),
      ).resolves.toMatchObject({ cache: 'MISS' });
    });

    it('un 429 no gasta cap consulta del sostre global', async () => {
      const { service } = entorn({ maxPrevisionsPerClient: 1, maxPrevisionsPerHora: 2 });
      await service.getVisibilitat(LLOC, '203.0.113.7');
      for (const lon of [2.17, 2.18, 2.19]) {
        await expect(
          errorDe(service.getVisibilitat({ lat: 41.39, lon }, '203.0.113.7')),
        ).resolves.toMatchObject({ status: 429 });
      }

      await expect(
        service.getVisibilitat({ lat: 41.39, lon: 2.17 }, '198.51.100.4'),
      ).resolves.toMatchObject({ cache: 'MISS' });
    });
  });
});

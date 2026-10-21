import request from 'supertest';

import { createApp } from '../app';
import type { PuntMapa, PuntsRepository } from '../punts/puntsRepository';
import { createDefaultPuntsService } from '../punts/puntsService';
import { matchesIfNoneMatch, secondsToNextHour } from '../routes/punts';

const PUNTS: PuntMapa[] = [
  {
    id: 'a',
    nom: 'Cap de Creus',
    municipi: 'Cadaqués',
    lon: 3.3158674321,
    lat: 42.3189126543,
    index: null,
  },
  {
    id: 'b',
    nom: 'Mont Caro',
    municipi: 'Roquetes',
    lon: 0.3509,
    lat: 40.8035,
    index: { valor: 82, franja: 'ras' },
  },
  {
    id: 'c',
    nom: 'Port de la Bonaigua',
    municipi: 'Alt Àneu',
    lon: 1.0028,
    lat: 42.6633,
    index: null,
  },
];

/** Repositori fals: retorna el que retornaria la consulta (només punts publicats). */
function fakeRepository(punts = PUNTS) {
  const repository: PuntsRepository & { calls: number; version: string | null } = {
    calls: 0,
    version: '2026-10-19T10:05:02.000Z',
    async listPublished() {
      repository.calls += 1;
      return punts;
    },
    async indexVersion() {
      return repository.version;
    },
    findPublished: async () => undefined,
    indexHores: async () => [],
  };
  return repository;
}

const appWith = (repository: PuntsRepository = fakeRepository()) =>
  createApp({ punts: createDefaultPuntsService(repository) });

describe('GET /api/v1/punts', () => {
  afterEach(() => jest.restoreAllMocks());

  it('respon 200 amb un FeatureCollection vàlid', async () => {
    const res = await request(appWith()).get('/api/v1/punts');
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/json');
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features).toHaveLength(3);
    expect(res.body.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [3.315867, 42.318913] },
      properties: { id: 'a', nom: 'Cap de Creus', municipi: 'Cadaqués', index: null },
    });
    expect(res.body.features[1].properties.index).toEqual({ valor: 82, franja: 'ras' });
  });

  it('porta ETag entre cometes i Cache-Control fins a la propera hora', async () => {
    const res = await request(appWith()).get('/api/v1/punts');
    expect(res.headers.etag).toMatch(/^"[\w-]+"$/);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers['cache-control'] ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it("respon 304 sense cos amb If-None-Match igual a l'ETag (també feble)", async () => {
    const app = appWith();
    const { headers } = await request(app).get('/api/v1/punts');
    const etag = headers.etag as string;
    for (const value of [etag, `W/${etag}`, `"un-altre", ${etag}`]) {
      const res = await request(app).get('/api/v1/punts').set('If-None-Match', value);
      expect(res.status).toBe(304);
      expect(res.text).toBe('');
      expect(res.headers.etag).toBe(etag);
    }
  });

  it('respon 200 si If-None-Match no coincideix', async () => {
    const res = await request(appWith()).get('/api/v1/punts').set('If-None-Match', '"vell"');
    expect(res.status).toBe(200);
  });

  it('només retorna el que dona el repositori (els punts publicats)', async () => {
    const res = await request(appWith(fakeRepository(PUNTS.slice(0, 1)))).get('/api/v1/punts');
    expect(res.body.features.map((f: { properties: { id: string } }) => f.properties.id)).toEqual([
      'a',
    ]);
  });

  it('bbox vàlid retalla la col·lecció sense tornar a consultar el repositori', async () => {
    const repository = fakeRepository();
    const app = appWith(repository);
    await request(app).get('/api/v1/punts');
    const res = await request(app).get('/api/v1/punts').query({ bbox: '0.15,40.5,1.5,42.9' });
    expect(res.status).toBe(200);
    expect(res.body.features.map((f: { properties: { id: string } }) => f.properties.id)).toEqual([
      'b',
      'c',
    ]);
    expect(repository.calls).toBe(1);
  });

  it.each([
    ['tres números', '0,40,3'],
    ['text', 'a,b,c,d'],
    ['valor buit', '0,,3,42'],
    ['mínim més gran que el màxim', '3,40,0,42'],
    ['latitud fora de rang', '0,-95,3,42'],
  ])('bbox invàlid (%s) → 400 validation_error', async (_cas, bbox) => {
    const res = await request(appWith()).get('/api/v1/punts').query({ bbox });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'validation_error', message: expect.any(String) } });
  });

  it('sense base de dades → 503 database_unavailable, i /health continua funcionant', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    const res = await request(app).get('/api/v1/punts');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'database_unavailable', message: expect.any(String) },
    });
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });

  it('si la base de dades falla i no hi ha cap document → 503', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(
      appWith({
        ...fakeRepository(),
        listPublished: () => Promise.reject(new Error('connexió tancada')),
        indexVersion: () => Promise.reject(new Error('connexió tancada')),
      }),
    ).get('/api/v1/punts');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });
});

describe('versió del worker (ADR-0012)', () => {
  const HORA = Date.UTC(2026, 9, 19, 10, 10);

  it('regenera el document quan el worker acaba una execució, sense esperar els 5 minuts', async () => {
    let t = HORA;
    const repository = fakeRepository();
    const service = createDefaultPuntsService(repository, () => t);
    await service.getMapDocument();

    t += 30_000;
    repository.version = '2026-10-19T11:05:00.000Z';
    await service.getMapDocument();
    expect(repository.calls).toBe(1); // la versió es mira com a molt cada minut

    t += 30_000;
    await service.getMapDocument();
    expect(repository.calls).toBe(2);
  });

  it("regenera el document en canviar l'hora, encara que fa menys d'un minut que ha mirat la versió", async () => {
    let t = Date.UTC(2026, 9, 19, 10, 59, 50);
    const repository = fakeRepository();
    const listPublished = jest.spyOn(repository, 'listPublished');
    const service = createDefaultPuntsService(repository, () => t);
    await service.getMapDocument();

    t = Date.UTC(2026, 9, 19, 11, 0, 10);
    await service.getMapDocument();
    expect(listPublished.mock.calls.map(([hora]) => hora.toISOString())).toEqual([
      '2026-10-19T10:00:00.000Z',
      '2026-10-19T11:00:00.000Z',
    ]);
  });

  it('sense cap canvi, no consulta el catàleg fins als 5 minuts', async () => {
    let t = HORA;
    const repository = fakeRepository();
    const service = createDefaultPuntsService(repository, () => t);
    await service.getMapDocument();
    t += 4 * 60_000;
    await service.getMapDocument();
    expect(repository.calls).toBe(1);
  });
});

describe('matchesIfNoneMatch', () => {
  it('accepta *, ETag feble i llistes', () => {
    expect(matchesIfNoneMatch('*', '"x"')).toBe(true);
    expect(matchesIfNoneMatch('W/"x"', '"x"')).toBe(true);
    expect(matchesIfNoneMatch('"y", "x"', '"x"')).toBe(true);
    expect(matchesIfNoneMatch('"y"', '"x"')).toBe(false);
    expect(matchesIfNoneMatch(undefined, '"x"')).toBe(false);
  });
});

describe('secondsToNextHour', () => {
  it('compta fins a la propera hora en punt', () => {
    expect(secondsToNextHour(Date.UTC(2026, 9, 14, 10, 0, 0))).toBe(3600);
    expect(secondsToNextHour(Date.UTC(2026, 9, 14, 10, 59, 30))).toBe(30);
  });
});

describe('ETag i 304 entre execucions del worker (TG-91)', () => {
  const HORA = Date.UTC(2026, 9, 19, 10, 10);

  /** App amb rellotge controlat i un catàleg que el test pot canviar entre peticions. */
  function appAmbRellotge() {
    const estat = { t: HORA, punts: [...PUNTS] };
    const repository = fakeRepository();
    repository.listPublished = async () => {
      repository.calls += 1;
      return estat.punts;
    };
    jest.spyOn(Date, 'now').mockImplementation(() => estat.t);
    const app = createApp({ punts: createDefaultPuntsService(repository, () => estat.t) });
    const etagActual = async () => (await request(app).get('/api/v1/punts')).headers.etag as string;
    return { app, estat, repository, etagActual };
  }

  afterEach(() => jest.restoreAllMocks());

  it("si el worker canvia l'índex, l'ETag vell rep 200 amb el document i l'ETag nous", async () => {
    const { app, estat, repository, etagActual } = appAmbRellotge();
    const vell = await etagActual();

    estat.t += 61_000;
    repository.version = '2026-10-19T11:05:00.000Z';
    estat.punts = PUNTS.map((p) =>
      p.id === 'a' ? { ...p, index: { valor: 35, franja: 'tap' } } : p,
    );

    const res = await request(app).get('/api/v1/punts').set('If-None-Match', vell);
    expect(res.status).toBe(200);
    expect(res.headers.etag).not.toBe(vell);
    expect(res.body.features[0].properties.index).toEqual({ valor: 35, franja: 'tap' });
    expect(repository.calls).toBe(2);
  });

  it("si el worker acaba però les dades són iguals, l'ETag no canvia i continua sent 304", async () => {
    const { app, estat, repository, etagActual } = appAmbRellotge();
    const etag = await etagActual();

    estat.t += 61_000;
    repository.version = '2026-10-19T11:05:00.000Z';

    const res = await request(app).get('/api/v1/punts').set('If-None-Match', etag);
    expect(repository.calls).toBe(2); // s'ha regenerat…
    expect(res.status).toBe(304); // …però l'ETag és del contingut, no de la data
    expect(res.headers.etag).toBe(etag);
  });

  it("en canviar l'hora amb les mateixes dades, l'ETag es manté", async () => {
    const { app, estat, repository, etagActual } = appAmbRellotge();
    const etag = await etagActual();

    estat.t = Date.UTC(2026, 9, 19, 11, 0, 5);

    const res = await request(app).get('/api/v1/punts').set('If-None-Match', etag);
    expect(repository.calls).toBe(2);
    expect(res.status).toBe(304);
  });

  it('el 304 també porta Cache-Control fins a la propera hora', async () => {
    const { app, estat, etagActual } = appAmbRellotge();
    const etag = await etagActual();
    estat.t = Date.UTC(2026, 9, 19, 10, 45, 0);

    const res = await request(app).get('/api/v1/punts').set('If-None-Match', etag);
    expect(res.status).toBe(304);
    expect(res.headers['cache-control']).toBe('public, max-age=900');
  });

  it('If-None-Match: * respon 304', async () => {
    const { app } = appAmbRellotge();
    const res = await request(app).get('/api/v1/punts').set('If-None-Match', '*');
    expect(res.status).toBe(304);
    expect(res.text).toBe('');
  });

  it("amb bbox, l'ETag és el de la col·lecció sencera i el 304 també funciona", async () => {
    const { app, etagActual } = appAmbRellotge();
    const etag = await etagActual();
    const bbox = '0.15,40.5,1.5,42.9';

    const filtrat = await request(app).get('/api/v1/punts').query({ bbox });
    expect(filtrat.status).toBe(200);
    expect(filtrat.headers.etag).toBe(etag);

    const res = await request(app).get('/api/v1/punts').query({ bbox }).set('If-None-Match', etag);
    expect(res.status).toBe(304);
  });

  it('un bbox invàlid respon 400 encara que If-None-Match coincideixi', async () => {
    const { app, etagActual } = appAmbRellotge();
    const etag = await etagActual();
    const res = await request(app)
      .get('/api/v1/punts')
      .query({ bbox: '3,40,0,42' })
      .set('If-None-Match', etag);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('sense base de dades respon 503 encara que el client enviï If-None-Match', async () => {
    const res = await request(createApp()).get('/api/v1/punts').set('If-None-Match', '*');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });
});

describe('OpenAPI de GET /punts', () => {
  it('documenta 200, 304, 400 i 503, amb ETag i Cache-Control i el paràmetre bbox', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const get = res.body.paths['/punts'].get;
    expect(Object.keys(get.responses).sort()).toEqual(['200', '304', '400', '503']);
    expect(Object.keys(get.responses['200'].headers).sort()).toEqual(['Cache-Control', 'ETag']);
    expect(get.responses['304'].content).toBeUndefined();
    expect(get.parameters.map((p: { name: string }) => p.name).sort()).toEqual([
      'If-None-Match',
      'bbox',
    ]);
  });
});

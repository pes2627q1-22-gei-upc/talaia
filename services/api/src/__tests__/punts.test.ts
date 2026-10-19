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

  it("regenera el document quan canvia l'hora, encara que el worker no hagi corregut", async () => {
    let t = HORA + 49 * 60_000; // 10:59 UTC
    const repository = fakeRepository();
    const service = createDefaultPuntsService(repository, () => t);
    await service.getMapDocument();

    t += 2 * 60_000; // 11:01 UTC
    await service.getMapDocument();
    expect(repository.calls).toBe(2);
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

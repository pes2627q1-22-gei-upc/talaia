import type { IndexHora } from '@talaia/shared';
import request from 'supertest';

import { createApp } from '../app';
import type { PuntDetall, PuntsRepository } from '../punts/puntsRepository';
import { createDefaultPuntsService } from '../punts/puntsService';

const ID = '7d3f2c1a-5b4e-4f6a-9c8d-1e2f3a4b5c6d';
const HORA_MS = 3_600_000;

const PUNT: PuntDetall = {
  id: ID,
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  descripcio: 'Parc Astronòmic del Montsec, destinació Starlight.',
  altitud: 800,
  horitzoObert: ['S', 'SW'],
  accessibilitat: 'Aparcament al costat',
  sqm: 21.4,
  lat: 42.0244,
  lon: 0.7364,
};

const indexA = (hora: Date, valor: number): IndexHora => ({
  hora: hora.toISOString(),
  valor,
  franja: valor >= 70 ? 'ras' : valor >= 40 ? 'jus' : 'tap',
  factors: { nuvols: 1, sol: 1, foscor: 0.6, lluna: 0.8 },
  foscorEstimada: true,
});

type FakeOptions = { punt?: PuntDetall; horesCalculades?: number; error?: Error };

/**
 * Repositori fals. `indexHores` fa com la taula: hi ha `horesCalculades` hores des de `desDe`
 * (l'hora en curs que demana el servei), i només retorna les de `[desDe, finsA)`.
 */
function fakeRepository({ punt = PUNT, horesCalculades = 60, error }: FakeOptions = {}) {
  const repository: PuntsRepository & { rangs: Array<[Date, Date]> } = {
    rangs: [],
    listPublished: async () => [],
    async findPublished(id) {
      if (error) throw error;
      return id === punt.id ? punt : undefined;
    },
    async indexHores(_id, desDe, finsA) {
      if (error) throw error;
      repository.rangs.push([desDe, finsA]);
      return Array.from(
        { length: horesCalculades },
        (_, k) => new Date(desDe.getTime() + k * HORA_MS),
      )
        .filter((hora) => hora < finsA)
        .map((hora, k) => indexA(hora, 90 - k));
    },
  };
  return repository;
}

const appWith = (repository: PuntsRepository = fakeRepository()) =>
  createApp({ punts: createDefaultPuntsService(repository) });

describe('GET /api/v1/punts/{id}', () => {
  afterEach(() => jest.restoreAllMocks());

  it("respon 200 amb la fitxa, la foscor i l'índex actual i de les 24 hores següents", async () => {
    const res = await request(appWith()).get(`/api/v1/punts/${ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...PUNT });
    expect(res.body.sqm).toBe(21.4);
    expect(res.body.index.actual).toMatchObject({ valor: 90, franja: 'ras', foscorEstimada: true });
    expect(res.body.index.actual.factors).toEqual({ nuvols: 1, sol: 1, foscor: 0.6, lluna: 0.8 });
    expect(res.body.index.properesHores).toHaveLength(24);
  });

  it("l'hora actual és l'inici de l'hora en curs i les següents van en ordre, d'hora en hora", async () => {
    const res = await request(appWith()).get(`/api/v1/punts/${ID}`);
    const actual = Date.parse(res.body.index.actual.hora);
    expect(actual % HORA_MS).toBe(0);
    expect(actual).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - actual).toBeLessThan(HORA_MS);
    const hores = res.body.index.properesHores.map((h: IndexHora) => Date.parse(h.hora));
    expect(hores).toEqual(hores.map((_: number, k: number) => actual + (k + 1) * HORA_MS));
  });

  it('demana a la base de dades només les hores que retorna', async () => {
    const repository = fakeRepository();
    await request(appWith(repository)).get(`/api/v1/punts/${ID}`).query({ hores: 6 });
    const [[desDe, finsA]] = repository.rangs as [[Date, Date]];
    expect(finsA.getTime() - desDe.getTime()).toBe(7 * HORA_MS);
  });

  it.each([
    [1, 1],
    [48, 48],
  ])('?hores=%i → %i hores següents', async (hores, esperades) => {
    const res = await request(appWith()).get(`/api/v1/punts/${ID}`).query({ hores });
    expect(res.status).toBe(200);
    expect(res.body.index.properesHores).toHaveLength(esperades);
  });

  it('si el worker ha calculat menys hores de les demanades, retorna les que hi ha', async () => {
    const res = await request(appWith(fakeRepository({ horesCalculades: 4 }))).get(
      `/api/v1/punts/${ID}`,
    );
    expect(res.body.index.properesHores).toHaveLength(3);
  });

  it('sense índex calculat: actual és null i properesHores és buida', async () => {
    const res = await request(appWith(fakeRepository({ horesCalculades: 0 }))).get(
      `/api/v1/punts/${ID}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.index).toEqual({ actual: null, properesHores: [] });
  });

  it('sense foscor calculada ni metadades opcionals: sqm, altitud i horitzoObert són null', async () => {
    const punt = { ...PUNT, sqm: null, altitud: null, horitzoObert: null, accessibilitat: null };
    const res = await request(appWith(fakeRepository({ punt }))).get(`/api/v1/punts/${ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sqm: null,
      altitud: null,
      horitzoObert: null,
      accessibilitat: null,
    });
  });

  it('porta Cache-Control fins a la propera hora', async () => {
    const res = await request(appWith()).get(`/api/v1/punts/${ID}`);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers['cache-control'] ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it('un punt que no existeix o no és publicat → 404 punt_not_found', async () => {
    const res = await request(appWith()).get('/api/v1/punts/0b8e6f5a-1c2d-4e3f-8a9b-0c1d2e3f4a5b');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'punt_not_found', message: expect.any(String) } });
  });

  it.each([
    ['id que no és un UUID', '/api/v1/punts/cap-de-creus', undefined],
    ['hores = 0', `/api/v1/punts/${ID}`, { hores: 0 }],
    ['hores > 48', `/api/v1/punts/${ID}`, { hores: 49 }],
    ['hores no enter', `/api/v1/punts/${ID}`, { hores: '2.5' }],
    ['hores text', `/api/v1/punts/${ID}`, { hores: 'moltes' }],
  ])('%s → 400 validation_error', async (_cas, url, query) => {
    const res = await request(appWith())
      .get(url)
      .query(query ?? {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'validation_error', message: expect.any(String) } });
  });

  it('sense base de dades → 503 database_unavailable', async () => {
    const res = await request(createApp()).get(`/api/v1/punts/${ID}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });

  it('si la base de dades falla → 503 database_unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(
      appWith(fakeRepository({ error: new Error('connexió tancada') })),
    ).get(`/api/v1/punts/${ID}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });

  it("surt a l'OpenAPI amb l'esquema PuntFitxa", async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const ruta = res.body.paths['/punts/{id}'];
    expect(Object.keys(ruta.get.responses)).toEqual(['200', '400', '404', '503']);
    expect(res.body.components.schemas.PuntFitxa.required).toEqual(
      expect.arrayContaining(['sqm', 'index', 'descripcio']),
    );
  });
});

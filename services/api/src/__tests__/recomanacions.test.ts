import request from 'supertest';

import { createApp } from '../app';
import type { RecomanacionsRepository } from '../recomanacions/recomanacionsRepository';
import { createRecomanacionsService } from '../recomanacions/recomanacionsService';

// Una nit llunyana: la franja no ha passat mai, i a l'hivern (CET) 22 h locals = 21 h UTC.
const QUERY = {
  objectiu: 'cel_estrellat',
  lat: '41.3874',
  lon: '2.1686',
  data: '2099-12-15',
  desDe: '22',
  finsA: '6',
  tempsMaxim: '150',
};

const repository: RecomanacionsRepository = {
  puntsDinsRadi: async () => [
    { id: 'a', nom: 'Montsec', municipi: 'Àger', lat: 42.02, lon: 0.73, distanciaM: 150_000 },
    { id: 'b', nom: 'Montseny', municipi: 'Fogars', lat: 41.77, lon: 2.44, distanciaM: 45_000 },
  ],
  indexHores: async () => [
    {
      puntId: 'a',
      hora: '2099-12-15T23:00:00.000Z',
      valor: 88,
      franja: 'ras',
      factors: { nuvols: 1, sol: 1, foscor: 0.98, lluna: 0.7 },
      foscorEstimada: false,
    },
  ],
};

const appWith = (repo: RecomanacionsRepository = repository) =>
  createApp({ recomanacions: createRecomanacionsService(repo) });

describe('GET /api/v1/recomanacions', () => {
  it('respon 200 amb el radi, la franja en UTC i el rànquing', async () => {
    const res = await request(appWith()).get('/api/v1/recomanacions').query(QUERY);

    expect(res.status).toBe(200);
    expect(res.body.radiKm).toBe(115.4);
    expect(res.body.franja).toEqual({
      desDe: '2099-12-15T21:00:00.000Z',
      finsA: '2099-12-16T05:00:00.000Z',
    });
    expect(res.body.punts.map((p: { id: string }) => p.id)).toEqual(['a', 'b']);
    expect(res.body.punts[0]).toEqual({
      id: 'a',
      nom: 'Montsec',
      municipi: 'Àger',
      lat: 42.02,
      lon: 0.73,
      distanciaKm: 150,
      tempsEstimat: 195,
      mitjana: 88,
      horesAmbIndex: 1,
      millorHora: {
        hora: '2099-12-15T23:00:00.000Z',
        valor: 88,
        franja: 'ras',
        factors: { nuvols: 1, sol: 1, foscor: 0.98, lluna: 0.7 },
        foscorEstimada: false,
      },
    });
    expect(res.body.punts[1]).toMatchObject({ id: 'b', millorHora: null, mitjana: null });
    expect(res.body.total).toBe(2);
  });

  it('una franja de matinada (01–05) és la de després del vespre de data', async () => {
    const res = await request(appWith())
      .get('/api/v1/recomanacions')
      .query({ ...QUERY, desDe: '1', finsA: '5' });
    expect(res.status).toBe(200);
    expect(res.body.franja).toEqual({
      desDe: '2099-12-16T00:00:00.000Z',
      finsA: '2099-12-16T04:00:00.000Z',
    });
  });

  it('?limit= retalla el rànquing', async () => {
    const res = await request(appWith())
      .get('/api/v1/recomanacions')
      .query({ ...QUERY, limit: '1' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.punts.map((p: { id: string }) => p.id)).toEqual(['a']);
  });

  it.each([
    ['lat', { lat: '91' }, 'lat ha de ser un número entre -90 i 90'],
    ['desDe', { desDe: '24' }, 'desDe ha de ser una hora entera de 0 a 23'],
    [
      'tempsMaxim',
      { tempsMaxim: '601' },
      'tempsMaxim ha de ser un nombre enter de minuts de 1 a 600',
    ],
    ['limit', { limit: '101' }, 'limit ha de ser un nombre enter de 1 a 100'],
  ])('el missatge de %s fora de rang és en català', async (_camp, canvis, missatge) => {
    const res = await request(appWith())
      .get('/api/v1/recomanacions')
      .query({ ...QUERY, ...canvis });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(missatge);
  });

  it('porta Cache-Control fins a la propera hora', async () => {
    const res = await request(appWith()).get('/api/v1/recomanacions').query(QUERY);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers['cache-control'] ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it.each([
    ['sense objectiu', { objectiu: undefined }],
    ['objectiu desconegut', { objectiu: 'aurora_boreal' }],
    ['sense lat', { lat: undefined }],
    ['lat buida', { lat: '' }],
    ['lat fora de rang', { lat: '91' }],
    ['lon text', { lon: 'est' }],
    ['data mal formada', { data: '15/12/2099' }],
    ['data que no existeix', { data: '2099-02-30' }],
    ['data després del 2100', { data: '9999-12-31' }],
    ['data abans del 2000', { data: '1999-12-31' }],
    ['desDe > 23', { desDe: '24' }],
    ['finsA no enter', { finsA: '5.5' }],
    ['desDe = finsA', { desDe: '22', finsA: '22' }],
    ['tempsMaxim 0', { tempsMaxim: '0' }],
    ['tempsMaxim massa gran', { tempsMaxim: '601' }],
    ['tempsMaxim buit', { tempsMaxim: '' }],
    ['limit 0', { limit: '0' }],
    ['limit massa gran', { limit: '101' }],
  ])('%s → 400 validation_error', async (_cas, canvis) => {
    const query = Object.fromEntries(
      Object.entries({ ...QUERY, ...canvis }).filter(([, v]) => v !== undefined),
    );
    const res = await request(appWith()).get('/api/v1/recomanacions').query(query);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'validation_error', message: expect.any(String) } });
  });

  it('una nit que ja ha passat → 400 franja_passada', async () => {
    const res = await request(appWith())
      .get('/api/v1/recomanacions')
      .query({ ...QUERY, data: '2020-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('franja_passada');
  });

  it('sense base de dades → 503 database_unavailable', async () => {
    const res = await request(createApp()).get('/api/v1/recomanacions').query(QUERY);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });

  it('si la base de dades falla → 503 database_unavailable', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(
      appWith({
        ...repository,
        puntsDinsRadi: async () => {
          throw new Error('connexió tancada');
        },
      }),
    )
      .get('/api/v1/recomanacions')
      .query(QUERY);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
    spy.mockRestore();
  });

  it("surt a l'OpenAPI amb l'esquema Recomanacions", async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const ruta = res.body.paths['/recomanacions'];
    expect(Object.keys(ruta.get.responses)).toEqual(['200', '400', '503']);
    // Els paràmetres es documenten amb la mateixa definició que els valida: tipus, rangs i format.
    const params = Object.fromEntries(
      ruta.get.parameters.map((p: { name: string; required: boolean; schema: object }) => [
        p.name,
        { required: p.required, ...p.schema },
      ]),
    );
    expect(Object.keys(params)).toEqual([
      'objectiu',
      'lat',
      'lon',
      'data',
      'desDe',
      'finsA',
      'tempsMaxim',
      'limit',
    ]);
    expect(params.lat).toMatchObject({ required: true, type: 'number', minimum: -90, maximum: 90 });
    expect(params.data).toMatchObject({ required: true, type: 'string', format: 'date' });
    expect(params.desDe).toMatchObject({
      required: true,
      type: 'integer',
      minimum: 0,
      maximum: 23,
    });
    expect(params.limit).toMatchObject({ required: false, type: 'integer', maximum: 100 });
    const recomanacions = res.body.components.schemas.Recomanacions;
    expect(recomanacions.required).toEqual(
      expect.arrayContaining(['radiKm', 'franja', 'total', 'punts']),
    );
    expect(recomanacions.properties.punts.items.properties.millorHora.allOf[0].$ref).toBe(
      '#/components/schemas/IndexHora',
    );
  });
});

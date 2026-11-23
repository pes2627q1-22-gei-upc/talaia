import request from 'supertest';

import { createApp } from '../app';
import type { FilaEsdeveniment } from '../esdeveniments/esdevenimentsRepository';
import type { RecomanacionsRepository } from '../recomanacions/recomanacionsRepository';
import {
  createRecomanacionsService,
  type EsdevenimentsFont,
} from '../recomanacions/recomanacionsService';

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
    expect(res.body.data).toBe('2099-12-15');
    expect(res.body.tempsMaxim).toBe(150);
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

  it('«A prop meu»: només amb lat i lon, el radi per defecte i la nit en curs', async () => {
    const res = await request(appWith())
      .get('/api/v1/recomanacions')
      .query({ lat: QUERY.lat, lon: QUERY.lon });

    expect(res.status).toBe(200);
    expect(res.body.tempsMaxim).toBe(60);
    expect(res.body.radiKm).toBe(46.2);
    expect(res.body.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // La franja acaba a les 12:00 locals de l'endemà de la nit (10:00 o 11:00 UTC).
    expect(res.body.franja.finsA).toMatch(/T1[01]:00:00\.000Z$/);
    expect(res.body.total).toBe(2);
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

  it('ordena el rànquing HTTP per índex i deixa els punts sense previsió al final', async () => {
    const res = await request(
      appWith({
        ...repository,
        puntsDinsRadi: async () => [
          { id: 'a', nom: 'A', municipi: 'Àger', lat: 42, lon: 1, distanciaM: 1_000 },
          { id: 'c', nom: 'C', municipi: 'Àger', lat: 42, lon: 1, distanciaM: 500 },
          { id: 'b', nom: 'B', municipi: 'Àger', lat: 42, lon: 1, distanciaM: 10_000 },
        ],
        indexHores: async () => [
          {
            puntId: 'a',
            hora: '2099-12-15T22:00:00.000Z',
            valor: 88,
            franja: 'ras',
            factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 0.7 },
            foscorEstimada: false,
          },
          {
            puntId: 'b',
            hora: '2099-12-15T22:00:00.000Z',
            valor: 95,
            franja: 'ras',
            factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 0.9 },
            foscorEstimada: false,
          },
          {
            puntId: 'b',
            hora: '2099-12-15T23:00:00.000Z',
            valor: 40,
            franja: 'jus',
            factors: { nuvols: 0.5, sol: 1, foscor: 1, lluna: 0.9 },
            foscorEstimada: false,
          },
        ],
      }),
    )
      .get('/api/v1/recomanacions')
      .query(QUERY);

    expect(res.status).toBe(200);
    expect(res.body.punts.map((p: { id: string }) => p.id)).toEqual(['b', 'a', 'c']);
    expect(res.body.punts.map((p: { mitjana: number | null }) => p.mitjana)).toEqual([
      68,
      88,
      null,
    ]);
    expect(res.body.punts[0].millorHora).toMatchObject({ valor: 95, franja: 'ras' });
    expect(res.body.punts.map((p: { horesAmbIndex: number }) => p.horesAmbIndex)).toEqual([
      2, 1, 0,
    ]);
    expect(res.body.punts[2].millorHora).toBeNull();
    expect(res.body.total).toBe(3);
  });

  it('porta Cache-Control privat fins a la propera hora (la query té la ubicació)', async () => {
    const res = await request(appWith()).get('/api/v1/recomanacions').query(QUERY);
    expect(res.headers['cache-control']).toMatch(/^private, /);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers['cache-control'] ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it('passa al servei els paràmetres validats amb coordenades i hores numèriques', async () => {
    const getRecomanacions = jest.fn().mockResolvedValue({
      radiKm: 0,
      franja: { desDe: '2099-12-15T21:00:00.000Z', finsA: '2099-12-16T05:00:00.000Z' },
      total: 0,
      punts: [],
    });
    const res = await request(createApp({ recomanacions: { getRecomanacions } }))
      .get('/api/v1/recomanacions')
      .query({ ...QUERY, limit: '3' });

    expect(res.status).toBe(200);
    expect(res.body.punts).toEqual([]);
    expect(getRecomanacions).toHaveBeenCalledTimes(1);
    expect(getRecomanacions).toHaveBeenCalledWith(
      {
        objectiu: 'cel_estrellat',
        origen: { lat: 41.3874, lon: 2.1686 },
        data: '2099-12-15',
        desDe: 22,
        finsA: 6,
        tempsMaxim: 150,
        limit: 3,
      },
      undefined,
      undefined,
    );
  });

  it('sense la resta de paràmetres, al servei només hi arriba l’origen', async () => {
    const getRecomanacions = jest.fn().mockResolvedValue({
      data: '2099-12-15',
      tempsMaxim: 60,
      radiKm: 46.2,
      franja: { desDe: '2099-12-15T21:00:00.000Z', finsA: '2099-12-16T11:00:00.000Z' },
      total: 0,
      punts: [],
    });
    const res = await request(createApp({ recomanacions: { getRecomanacions } }))
      .get('/api/v1/recomanacions')
      .query({ lat: QUERY.lat, lon: QUERY.lon, tempsMaxim: '' });

    expect(res.status).toBe(200);
    expect(getRecomanacions.mock.calls[0][0]).toStrictEqual({
      origen: { lat: 41.3874, lon: 2.1686 },
    });
  });

  it.each([
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
    ['desDe sense finsA', { finsA: undefined }],
    ['finsA sense desDe', { desDe: undefined }],
    ['sense lon', { lon: undefined }],
    ['tempsMaxim 0', { tempsMaxim: '0' }],
    ['tempsMaxim massa gran', { tempsMaxim: '601' }],
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

  it('rebutja la query invàlida abans de consultar el servei', async () => {
    const getRecomanacions = jest.fn();
    const res = await request(createApp({ recomanacions: { getRecomanacions } }))
      .get('/api/v1/recomanacions')
      .query({ ...QUERY, lat: '91' });

    expect(res.status).toBe(400);
    expect(getRecomanacions).not.toHaveBeenCalled();
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

  it('si falla la consulta de l’índex → 503 database_unavailable', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(
        appWith({
          ...repository,
          indexHores: async () => {
            throw new Error('índex no disponible');
          },
        }),
      )
        .get('/api/v1/recomanacions')
        .query(QUERY);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('database_unavailable');
    } finally {
      spy.mockRestore();
    }
  });

  it("surt a l'OpenAPI amb l'esquema Recomanacions", async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const ruta = res.body.paths['/recomanacions'];
    expect(Object.keys(ruta.get.responses)).toEqual(['200', '400', '404', '503']);
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
      'esdevenimentId',
      'limit',
    ]);
    expect(params.lat).toMatchObject({ required: true, type: 'number', minimum: -90, maximum: 90 });
    expect(params.lon).toMatchObject({ required: true });
    // «A prop meu» (TG-133): fora de l'origen, tot és opcional.
    for (const nom of ['objectiu', 'data', 'desDe', 'finsA', 'tempsMaxim']) {
      expect(params[nom]).toMatchObject({ required: false });
    }
    expect(params.data).toMatchObject({ type: 'string', format: 'date' });
    expect(params.desDe).toMatchObject({
      type: 'integer',
      minimum: 0,
      maximum: 23,
    });
    expect(params.limit).toMatchObject({ required: false, type: 'integer', maximum: 100 });
    const recomanacions = res.body.components.schemas.Recomanacions;
    expect(recomanacions.required).toEqual(
      expect.arrayContaining(['data', 'tempsMaxim', 'radiKm', 'franja', 'total', 'punts']),
    );
    expect(recomanacions.properties.punts.items.properties.millorHora.allOf[0].$ref).toBe(
      '#/components/schemas/IndexHora',
    );
    // TG-140: camps opcionals, no trenquen el contracte.
    expect(recomanacions.required).not.toContain('esdeveniment');
    expect(recomanacions.required).not.toContain('avis');
    expect(recomanacions.properties.avis.enum).toEqual(['sense_previsio']);
    expect(params.esdevenimentId).toMatchObject({ required: false, type: 'string' });
    expect(res.body.paths['/recomanacions'].get.responses['404']).toBeDefined();
  });
});

describe('GET /api/v1/recomanacions?esdevenimentId= (TG-140)', () => {
  // Un eclipsi llunyà amb hores conegudes: la finestra no ha passat mai.
  const ECLIPSI: FilaEsdeveniment = {
    codi: 'eclipsi-lunar-2099-12-15',
    tipus: 'eclipsi_llunar',
    inici: new Date('2099-12-15T22:12:00Z'),
    fi: new Date('2099-12-16T01:13:00Z'),
    maxim: new Date('2099-12-15T23:13:00Z'),
    precisio: { inici: 'minut', fi: 'minut', maxim: 'minut' },
    textosFenomen: {},
    textosEsdeveniment: {},
    organitzacio: 'NASA',
    metodeCalcul: null,
  };
  const esdeveniments: EsdevenimentsFont = {
    findPublicById: async (id) => (id === ECLIPSI.codi ? ECLIPSI : undefined),
  };
  const app = (repo: RecomanacionsRepository = repository) =>
    createApp({ recomanacions: createRecomanacionsService(repo, undefined, esdeveniments) });
  const ORIGEN = { lat: QUERY.lat, lon: QUERY.lon };

  it("respon 200 amb la finestra de l'esdeveniment i l'esdeveniment", async () => {
    const res = await request(app())
      .get('/api/v1/recomanacions')
      .query({ ...ORIGEN, esdevenimentId: ECLIPSI.codi });

    expect(res.status).toBe(200);
    expect(res.body.data).toBe('2099-12-15');
    expect(res.body.franja).toEqual({
      desDe: '2099-12-15T22:00:00.000Z',
      finsA: '2099-12-16T01:13:00.000Z',
    });
    expect(res.body.esdeveniment).toEqual({
      id: ECLIPSI.codi,
      inici: '2099-12-15T22:12:00.000Z',
      maxim: '2099-12-15T23:13:00.000Z',
      fi: '2099-12-16T01:13:00.000Z',
    });
    // La millor hora de cada punt cau dins de la finestra.
    const millor = res.body.punts[0].millorHora.hora;
    expect(millor >= res.body.franja.desDe && millor < res.body.franja.finsA).toBe(true);
    expect(res.body).not.toHaveProperty('avis');
  });

  it('sense tempsMaxim retorna sense límit i ordena per qualitat semblant i proximitat', async () => {
    const repo: RecomanacionsRepository = {
      puntsDinsRadi: jest.fn(async () => [
        { id: 'far', nom: 'Llunyà', municipi: '', lat: 42, lon: 1, distanciaM: 150_000 },
        { id: 'near', nom: 'Proper', municipi: '', lat: 42, lon: 2, distanciaM: 20_000 },
      ]),
      indexHores: async () => [
        {
          puntId: 'far',
          hora: '2099-12-15T23:00:00Z',
          valor: 100,
          franja: 'ras',
          factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1 },
          foscorEstimada: false,
        },
        {
          puntId: 'near',
          hora: '2099-12-15T23:00:00Z',
          valor: 95,
          franja: 'ras',
          factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1 },
          foscorEstimada: false,
        },
      ],
    };
    const res = await request(app(repo))
      .get('/api/v1/recomanacions')
      .query({ ...ORIGEN, esdevenimentId: ECLIPSI.codi });
    expect(res.status).toBe(200);
    expect(res.body.tempsMaxim).toBeNull();
    expect(res.body.radiKm).toBeNull();
    expect(repo.puntsDinsRadi).toHaveBeenCalledWith(
      { lat: Number(ORIGEN.lat), lon: Number(ORIGEN.lon) },
      null,
    );
    expect(res.body.punts.map((p: { id: string }) => p.id)).toEqual(['far', 'near']);
  });

  it('sense índex a la finestra: avis sense_previsio', async () => {
    const res = await request(app({ ...repository, indexHores: async () => [] }))
      .get('/api/v1/recomanacions')
      .query({ ...ORIGEN, esdevenimentId: ECLIPSI.codi });
    expect(res.status).toBe(200);
    expect(res.body.avis).toBe('sense_previsio');
    expect(res.body.punts.map((p: { id: string }) => p.id)).toEqual(['b', 'a']);
  });

  it('un esdeveniment que no existeix → 404 event_not_found', async () => {
    const res = await request(app())
      .get('/api/v1/recomanacions')
      .query({ ...ORIGEN, esdevenimentId: 'no-existeix' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('event_not_found');
  });

  it.each([
    ['data', { data: '2099-12-15' }],
    ['desDe i finsA', { desDe: '22', finsA: '6' }],
  ])('esdevenimentId amb %s → 400 validation_error', async (_cas, canvis) => {
    const res = await request(app())
      .get('/api/v1/recomanacions')
      .query({ ...ORIGEN, esdevenimentId: ECLIPSI.codi, ...canvis });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.message).toBe(
      "esdevenimentId no va amb data, desDe ni finsA: la finestra és la de l'esdeveniment",
    );
  });

  it('esdevenimentId buit (o d’espais) és un que falta, com la resta de paràmetres (`senseBuits`)', async () => {
    const res = await request(app())
      .get('/api/v1/recomanacions')
      .query({ ...ORIGEN, esdevenimentId: '  ' });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('esdeveniment');
  });

  it('sense esdevenimentId, la mateixa resposta que abans (regressió)', async () => {
    const amb = await request(app()).get('/api/v1/recomanacions').query(QUERY);
    const sense = await request(appWith()).get('/api/v1/recomanacions').query(QUERY);
    expect(amb.status).toBe(200);
    expect(amb.body).toEqual(sense.body);
    expect(Object.keys(amb.body).sort()).toEqual(
      ['data', 'franja', 'punts', 'radiKm', 'tempsMaxim', 'total'].sort(),
    );
  });
});

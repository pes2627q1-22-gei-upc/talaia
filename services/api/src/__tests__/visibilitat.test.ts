import { OpenMeteoError, type Coordenades, type OpenMeteoClient } from '@talaia/index';
import type { PrevisioMeteoHora } from '@talaia/shared';
import request from 'supertest';

import { createApp } from '../app';
import { createVisibilitatService } from '../visibilitat/visibilitatService';

const HORA_MS = 3_600_000;
/** L'hora en punt actual: la ruta compara `hora` amb el rellotge del servei, que aquí és el real. */
const horaActual = () => new Date(Math.floor(Date.now() / HORA_MS) * HORA_MS).toISOString();

/** 4 dies de previsió amb el cel ras des de les 00:00 UTC d'avui, com la d'Open-Meteo. */
function previsio(): PrevisioMeteoHora[] {
  const inici = Math.floor(Date.now() / 86_400_000) * 86_400_000;
  return Array.from({ length: 96 }, (_, i) => ({
    hora: new Date(inici + i * HORA_MS).toISOString(),
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
  }));
}

/** L'app amb un Open-Meteo fals (sense xarxa) que compta les crides. */
function appAmb(meteo?: OpenMeteoClient, sqm: number | null = null) {
  const client: OpenMeteoClient = meteo ?? {
    previsio: jest.fn(async (llocs: Coordenades[]) => llocs.map(() => previsio())),
  };
  const app = createApp({
    visibilitat: createVisibilitatService({ meteo: client, sqmProper: async () => sqm }),
  });
  return { app, meteo: client };
}

const LLOC = { lat: '41.9522', lon: '1.5237' };

describe('GET /api/v1/visibilitat', () => {
  it("respon 200 amb l'índex de l'hora en curs a la cel·la", async () => {
    const { app } = appAmb(undefined, 21.56);

    const res = await request(app).get('/api/v1/visibilitat').query(LLOC);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      lat: 41.95,
      lon: 1.52,
      sqm: 21.56,
      index: { hora: horaActual(), foscorEstimada: false },
    });
    expect(res.body.index.valor).toBeGreaterThanOrEqual(0);
    expect(res.body.index.valor).toBeLessThanOrEqual(100);
    expect(['tap', 'jus', 'ras']).toContain(res.body.index.franja);
    expect(Object.keys(res.body.index.factors).sort()).toEqual([
      'foscor',
      'lluna',
      'nuvols',
      'sol',
    ]);
    expect(res.body.deDia).toBe(res.body.index.factors.sol === 0);
  });

  it('la segona consulta del mateix lloc i hora surt de la memòria cau (X-Cache)', async () => {
    const { app, meteo } = appAmb();

    const primera = await request(app).get('/api/v1/visibilitat').query(LLOC);
    const segona = await request(app).get('/api/v1/visibilitat').query(LLOC);

    expect(primera.headers['x-cache']).toBe('MISS');
    expect(segona.headers['x-cache']).toBe('HIT');
    expect(segona.body).toEqual(primera.body);
    expect(meteo.previsio).toHaveBeenCalledTimes(1);
  });

  it('respon en menys de 3 s, i de la memòria cau sense esperar Open-Meteo', async () => {
    // Open-Meteo fals que triga mig segon, com el de debò.
    const lent: OpenMeteoClient = {
      previsio: async (llocs) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return llocs.map(() => previsio());
      },
    };
    const { app } = appAmb(lent);

    let inici = Date.now();
    await request(app).get('/api/v1/visibilitat').query(LLOC).expect(200);
    expect(Date.now() - inici).toBeLessThan(3_000);

    inici = Date.now();
    await request(app).get('/api/v1/visibilitat').query(LLOC).expect(200);
    expect(Date.now() - inici).toBeLessThan(400);
  });

  it('accepta una hora amb zona i en compta l’hora que la conté', async () => {
    const { app } = appAmb();
    const hora = new Date(Date.parse(horaActual()) + 5 * HORA_MS + 30 * 60_000).toISOString();

    const res = await request(app)
      .get('/api/v1/visibilitat')
      .query({ ...LLOC, hora });

    expect(res.status).toBe(200);
    expect(res.body.index.hora).toBe(
      new Date(Date.parse(horaActual()) + 5 * HORA_MS).toISOString(),
    );
  });

  it("Cache-Control privat fins a la propera hora: la URL porta la ubicació de l'usuari", async () => {
    const { app } = appAmb();

    const res = await request(app).get('/api/v1/visibilitat').query(LLOC);

    expect(res.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
    const maxAge = Number(res.headers['cache-control']?.split('=')[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it.each([
    ['sense lat', { lon: '1.52' }, 'lat'],
    ['amb lat buida', { lat: '', lon: '1.52' }, 'lat'],
    ['amb lon que no és un número', { lat: '41.95', lon: 'abc' }, 'lon'],
    ['amb lat fora de rang', { lat: '91', lon: '1.52' }, 'lat'],
    ['amb una hora sense zona', { ...LLOC, hora: '2026-12-15T22:00' }, 'hora'],
    ['amb una hora que no és una data', { ...LLOC, hora: 'demà' }, 'hora'],
  ])('400 validation_error %s', async (_cas, query, camp) => {
    const { app, meteo } = appAmb();

    const res = await request(app).get('/api/v1/visibilitat').query(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.message).toContain(camp);
    expect(meteo.previsio).not.toHaveBeenCalled();
  });

  it('fora de Catalunya: 422 fora_de_catalunya amb un missatge clar', async () => {
    const { app, meteo } = appAmb();

    const res = await request(app)
      .get('/api/v1/visibilitat')
      .query({ lat: '42.5063', lon: '1.5218' }); // Andorra la Vella

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('fora_de_catalunya');
    expect(res.body.error.message).toMatch(/fora de Catalunya/);
    expect(meteo.previsio).not.toHaveBeenCalled();
  });

  it('una hora sense previsió: 422 hora_sense_previsio', async () => {
    const { app } = appAmb();

    const passada = await request(app)
      .get('/api/v1/visibilitat')
      .query({ ...LLOC, hora: new Date(Date.now() - 2 * HORA_MS).toISOString() });
    const llunyana = await request(app)
      .get('/api/v1/visibilitat')
      .query({ ...LLOC, hora: new Date(Date.now() + 80 * HORA_MS).toISOString() });

    for (const res of [passada, llunyana]) {
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('hora_sense_previsio');
    }
  });

  it('si Open-Meteo falla: 503 meteo_unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = appAmb({
      previsio: async () => {
        throw new OpenMeteoError("No s'ha pogut contactar amb Open-Meteo: timeout");
      },
    });

    const res = await request(app).get('/api/v1/visibilitat').query(LLOC);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('meteo_unavailable');
    jest.restoreAllMocks();
  });

  it('sense el servei configurat: 503 meteo_unavailable', async () => {
    const res = await request(createApp()).get('/api/v1/visibilitat').query(LLOC);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('meteo_unavailable');
  });

  it("és a l'OpenAPI amb la query, X-Cache i els errors", async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const ruta = res.body.paths['/visibilitat'].get;

    expect(ruta.parameters.map((p: { name: string }) => p.name).sort()).toEqual([
      'hora',
      'lat',
      'lon',
    ]);
    expect(Object.keys(ruta.responses).sort()).toEqual(['200', '400', '422', '503']);
    expect(ruta.responses['200'].headers['X-Cache'].schema.enum).toEqual(['HIT', 'MISS']);
    expect(ruta.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/VisibilitatUbicacio',
    );
    expect(res.body.components.schemas.VisibilitatUbicacio.properties.index.$ref).toBe(
      '#/components/schemas/IndexHora',
    );
  });
});

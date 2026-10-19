import type { IndexHora } from '@talaia/shared';
import request from 'supertest';

import { createApp } from '../app';
import { createBreakdownService } from '../index/breakdownService';
import type { PuntDetall, PuntsRepository } from '../punts/puntsRepository';

/** La fitxa sencera, tal com la retorna `findPublished`: la resposta només n'ha de treure id, nom i municipi. */
const MONTSEC: PuntDetall = {
  id: '6f1c2b7e-3a9d-4c58-9e0b-2d7f1a4c8b35',
  nom: 'Mirador del Montsec',
  municipi: 'Àger',
  descripcio: 'Parc Astronòmic del Montsec.',
  altitud: 800,
  horitzoObert: ['S', 'SW'],
  accessibilitat: null,
  sqm: 21.4,
  lat: 42.0244,
  lon: 0.7364,
};
const ALTRE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const hora = (iso: string, valor: number, extra: Partial<IndexHora> = {}): IndexHora => ({
  hora: iso,
  valor,
  franja: valor >= 70 ? 'ras' : valor >= 40 ? 'jus' : 'tap',
  factors: { nuvols: 1, sol: 1, foscor: 0.95, lluna: 0.8 },
  foscorEstimada: false,
  ...extra,
});

/** Hores de dues nits seguides del Montsec: la del 19 (de les 18:00 a les 06:00 UTC) i la del 20. */
const HORES: IndexHora[] = [
  hora('2026-10-19T17:00:00.000Z', 0, { factors: { nuvols: 1, sol: 0, foscor: 0.95, lluna: 1 } }),
  hora('2026-10-19T18:00:00.000Z', 42, {
    factors: { nuvols: 1, sol: 0.5, foscor: 0.95, lluna: 1 },
  }),
  hora('2026-10-19T19:00:00.000Z', 89),
  hora('2026-10-19T23:00:00.000Z', 61, {
    factors: { nuvols: 0.7, sol: 1, foscor: 0.95, lluna: 0.8 },
  }),
  hora('2026-10-20T05:00:00.000Z', 35, {
    factors: { nuvols: 0.4, sol: 1, foscor: 0.95, lluna: 0.8 },
  }),
  hora('2026-10-20T10:00:00.000Z', 0, { factors: { nuvols: 1, sol: 0, foscor: 0.95, lluna: 1 } }),
  hora('2026-10-20T20:00:00.000Z', 90),
];

type FakeRepository = Pick<PuntsRepository, 'findPublished' | 'indexHores'> & {
  calls: { findPublished: number; indexHores: number };
};

/** Repositori fals: fa com la taula `index_visibilitat` amb `[desDe, finsA)`. */
function fakeRepository({ hores = HORES, punts = [MONTSEC] } = {}): FakeRepository {
  const repository: FakeRepository = {
    calls: { findPublished: 0, indexHores: 0 },
    async findPublished(id) {
      repository.calls.findPublished += 1;
      return punts.find((p) => p.id === id);
    },
    async indexHores(id, desDe, finsA) {
      repository.calls.indexHores += 1;
      if (id !== MONTSEC.id) return [];
      return hores
        .filter(
          (h) => Date.parse(h.hora) >= desDe.getTime() && Date.parse(h.hora) < finsA.getTime(),
        )
        .sort((a, b) => Date.parse(a.hora) - Date.parse(b.hora));
    },
  };
  return repository;
}

function appWith(now = new Date('2026-10-19T20:00:00Z'), repository = fakeRepository()) {
  return createApp({ breakdown: createBreakdownService(repository, { now: () => now }) });
}

const url = (id = MONTSEC.id) => `/api/v1/punts/${id}/index`;

describe('GET /api/v1/punts/{id}/index', () => {
  afterEach(() => jest.restoreAllMocks());

  it("respon amb el punt, la nit i les hores de les 12:00 locals a les 12:00 de l'endemà", async () => {
    const res = await request(appWith()).get(url()).query({ nit: '2026-10-19' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/json');
    expect(res.body.nit).toBe('2026-10-19');
    // Les 10:00 UTC del dia 20 són les 12:00 locals: ja és la nit següent.
    expect(res.body.hores.map((h: IndexHora) => h.hora)).toEqual([
      '2026-10-19T17:00:00.000Z',
      '2026-10-19T18:00:00.000Z',
      '2026-10-19T19:00:00.000Z',
      '2026-10-19T23:00:00.000Z',
      '2026-10-20T05:00:00.000Z',
    ]);
    expect(res.body.hores[2]).toEqual({
      hora: '2026-10-19T19:00:00.000Z',
      valor: 89,
      franja: 'ras',
      factors: { nuvols: 1, sol: 1, foscor: 0.95, lluna: 0.8 },
      foscorEstimada: false,
    });
  });

  it('del punt només hi va id, nom i municipi: la fitxa sencera és /punts/{id}', async () => {
    const res = await request(appWith()).get(url());
    expect(res.body.punt).toEqual({ id: MONTSEC.id, nom: MONTSEC.nom, municipi: MONTSEC.municipi });
    expect(Object.keys(res.body.punt)).toEqual(['id', 'nom', 'municipi']);
  });

  it("sense nit, és la d'avui: la que ve a partir del migdia i la que s'acaba abans", async () => {
    const vespre = await request(appWith(new Date('2026-10-20T18:00:00Z'))).get(url());
    expect(vespre.body.nit).toBe('2026-10-20');
    // Les 12:00 locals (10:00 UTC) del dia 20 ja són d'aquesta nit.
    expect(vespre.body.hores.map((h: IndexHora) => h.hora)).toEqual([
      '2026-10-20T10:00:00.000Z',
      '2026-10-20T20:00:00.000Z',
    ]);

    const matinada = await request(appWith(new Date('2026-10-20T03:00:00Z'))).get(url());
    expect(matinada.body.nit).toBe('2026-10-19');
    expect(matinada.body.hores).toHaveLength(5);
  });

  it('porta Cache-Control fins a la propera hora', async () => {
    const res = await request(appWith()).get(url());
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers['cache-control'] ?? '')?.[1]);
    expect(res.headers['cache-control']).toMatch(/^public, max-age=\d+$/);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it('un punt publicat sense cap hora calculada → 200 amb hores buides', async () => {
    const res = await request(appWith(undefined, fakeRepository({ hores: [] }))).get(url());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      punt: { id: MONTSEC.id, nom: MONTSEC.nom, municipi: MONTSEC.municipi },
      nit: '2026-10-19',
      hores: [],
    });
  });

  it.each([
    ['format', '19/10/2026'],
    ['mes 13', '2026-13-01'],
    ['30 de febrer', '2026-02-30'],
    ['buida', ''],
  ])('nit invàlida (%s) → 400 validation_error', async (_cas, nit) => {
    const res = await request(appWith()).get(url()).query({ nit });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'validation_error', message: expect.any(String) } });
  });

  it('un id que no és un UUID → 400 validation_error sense consultar la base de dades', async () => {
    const repository = fakeRepository();
    const res = await request(appWith(undefined, repository)).get(url('montsec'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repository.calls).toEqual({ findPublished: 0, indexHores: 0 });
  });

  it('un punt que no existeix o no és públic → 404 punt_not_found', async () => {
    const repository = fakeRepository();
    const res = await request(appWith(undefined, repository)).get(url(ALTRE));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'punt_not_found', message: expect.any(String) } });
    expect(repository.calls).toEqual({ findPublished: 1, indexHores: 0 });
  });

  it('sense base de dades → 503 database_unavailable', async () => {
    const res = await request(createApp()).get(url());
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'database_unavailable', message: expect.any(String) },
    });
  });

  it('si la base de dades falla → 503 database_unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const trencat = fakeRepository();
    trencat.indexHores = () => Promise.reject(new Error('connexió tancada'));
    const res = await request(appWith(undefined, trencat)).get(url());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });

  it("la ruta surt a l'OpenAPI amb un sol esquema IndexHora, compartit amb /punts/{id}", async () => {
    const openapi = await request(appWith()).get('/api/v1/openapi.json');
    expect(openapi.body.paths).toHaveProperty('/punts/{id}/index');
    expect(openapi.body.paths).toHaveProperty('/punts/{id}');
    const schemas = openapi.body.components.schemas;
    expect(schemas).toHaveProperty('DesglossamentIndex');
    expect(schemas.IndexHora.properties.hora.format).toBe('date-time');
    expect(schemas.IndexHora.properties.factors.properties.nuvols.maximum).toBe(1);
    // La fitxa i el desglossament apunten al mateix esquema.
    expect(schemas.PuntFitxa.properties.index.properties.properesHores.items.$ref).toBe(
      '#/components/schemas/IndexHora',
    );
    expect(schemas.DesglossamentIndex.properties.hores.items.$ref).toBe(
      '#/components/schemas/IndexHora',
    );
  });
});

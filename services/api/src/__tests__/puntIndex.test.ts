import type { IndexHora } from '@talaia/shared';
import request from 'supertest';

import { createApp } from '../app';
import { createBreakdownService } from '../index/breakdownService';
import type { IndexRepository } from '../index/indexRepository';
import type { PuntResum } from '../punts/puntsRepository';

const MONTSEC: PuntResum = {
  id: '6f1c2b7e-3a9d-4c58-9e0b-2d7f1a4c8b35',
  nom: 'Mirador del Montsec',
  municipi: 'Àger',
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

function fakeRepositories({ hores = HORES, punts = [MONTSEC] } = {}) {
  const calls = { findPublished: 0, listHours: 0 };
  const puntsRepository = {
    async findPublished(id: string) {
      calls.findPublished += 1;
      return punts.find((p) => p.id === id);
    },
  };
  const indexRepository: IndexRepository = {
    async listHours(puntId, { from, to }) {
      calls.listHours += 1;
      if (puntId !== MONTSEC.id) return [];
      return hores
        .filter((h) => Date.parse(h.hora) >= from.getTime() && Date.parse(h.hora) < to.getTime())
        .sort((a, b) => Date.parse(a.hora) - Date.parse(b.hora));
    },
  };
  return { puntsRepository, indexRepository, calls };
}

function appWith(now = new Date('2026-10-19T20:00:00Z'), repositories = fakeRepositories()) {
  const { puntsRepository, indexRepository } = repositories;
  return createApp({
    breakdown: createBreakdownService(puntsRepository, indexRepository, { now: () => now }),
  });
}

const url = (id = MONTSEC.id) => `/api/v1/punts/${id}/index`;

describe('GET /api/v1/punts/{id}/index', () => {
  afterEach(() => jest.restoreAllMocks());

  it("respon amb el punt, la nit i les hores de les 12:00 locals a les 12:00 de l'endemà", async () => {
    const res = await request(appWith()).get(url()).query({ nit: '2026-10-19' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/json');
    expect(res.body.punt).toEqual(MONTSEC);
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
    const res = await request(appWith(undefined, fakeRepositories({ hores: [] }))).get(url());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ punt: MONTSEC, nit: '2026-10-19', hores: [] });
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

  it('un punt que no existeix o no és públic → 404 punt_not_found', async () => {
    const res = await request(appWith()).get(url(ALTRE));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'punt_not_found', message: expect.any(String) } });
  });

  it('un id que no és un UUID → 404 sense consultar la base de dades', async () => {
    const repositories = fakeRepositories();
    const res = await request(appWith(undefined, repositories)).get(url('montsec'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('punt_not_found');
    expect(repositories.calls).toEqual({ findPublished: 0, listHours: 0 });
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
    const trencat = fakeRepositories();
    trencat.indexRepository.listHours = () => Promise.reject(new Error('connexió tancada'));
    const res = await request(appWith(undefined, trencat)).get(url());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });

  it('/punts continua responent (503 sense base de dades) i la ruta surt a l’OpenAPI', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = appWith();
    expect((await request(app).get('/api/v1/punts')).status).toBe(503);
    const openapi = await request(app).get('/api/v1/openapi.json');
    expect(openapi.body.paths).toHaveProperty('/punts/{id}/index');
    expect(openapi.body.components.schemas).toHaveProperty('IndexHora');
    expect(openapi.body.components.schemas).toHaveProperty('DesglossamentIndex');
  });
});

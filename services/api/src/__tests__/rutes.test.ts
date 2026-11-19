import type { RutesPunt } from '@talaia/shared';
import request from 'supertest';

import { createApp } from '../app';
import type { RutesService } from '../mobilicat/rutesService';

const ID = '6f1c2b7e-3a9d-4c58-9e0b-2d7f1a4c8b35';
const RESPOSTA: RutesPunt = {
  estat: 'no_disponible',
  destacada: null,
  alternatives: [],
};

function appWithRutes() {
  const getRutes = jest.fn(async () => RESPOSTA);
  const service: RutesService = { getRutes };
  return { app: createApp({ rutes: service }), getRutes };
}

describe('GET /api/v1/punts/{id}/rutes', () => {
  it('retorna la resposta parcial i no necessita autenticació', async () => {
    const { app, getRutes } = appWithRutes();

    const response = await request(app)
      .get(`/api/v1/punts/${ID}/rutes`)
      .query({ lat: '41.3851', lon: '2.1734' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(RESPOSTA);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(getRutes).toHaveBeenCalledWith(ID, { lat: 41.3851, lon: 2.1734 });
  });

  it.each([
    ['id invàlid', '/api/v1/punts/no-es-un-uuid/rutes?lat=41&lon=2'],
    ['lat absent', `/api/v1/punts/${ID}/rutes?lon=2`],
    ['lat buida', `/api/v1/punts/${ID}/rutes?lat=&lon=2`],
    ['lat fora de rang', `/api/v1/punts/${ID}/rutes?lat=91&lon=2`],
    ['lon no numèrica', `/api/v1/punts/${ID}/rutes?lat=41&lon=est`],
    ['lon fora de rang', `/api/v1/punts/${ID}/rutes?lat=41&lon=181`],
  ])('respon 400 validation_error amb %s', async (_case, path) => {
    const { app, getRutes } = appWithRutes();

    const response = await request(app).get(path);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
    expect(getRutes).not.toHaveBeenCalled();
  });

  it('respon 503 si el servei de rutes no està configurat', async () => {
    const response = await request(createApp()).get(`/api/v1/punts/${ID}/rutes?lat=41&lon=2`);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('database_unavailable');
  });

  it('documenta la ruta i els estats parcials a l’OpenAPI', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');
    const operation = response.body.paths['/punts/{id}/rutes'].get;

    expect(response.status).toBe(200);
    expect(operation.responses).toHaveProperty('200');
    expect(operation.responses).toHaveProperty('400');
    expect(operation.responses).toHaveProperty('404');
    expect(operation.responses).toHaveProperty('503');
    expect(response.body.components.schemas.RutesPunt.properties.estat.enum).toEqual([
      'disponible',
      'sense_rutes',
      'no_disponible',
    ]);
  });
});

import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '../app';
import { errorHandler } from '../middleware/errors';

const app = createApp();

describe('GET /api/v1/health', () => {
  it("respon 200 amb l'estat i la versió", async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: expect.any(String) });
  });
});

describe("format d'error { error: { code, message } }", () => {
  it('ruta inexistent → 404 not_found', async () => {
    const res = await request(app).get('/api/v1/no-existeix');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
  });

  it('JSON mal format → 400 invalid_json', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'invalid_json', message: expect.any(String) } });
  });

  describe('handler central', () => {
    const probe = express();
    probe.get('/zod', () => z.object({ n: z.number() }).parse({ n: 'x' }));
    probe.get('/boom', async () => {
      throw new Error('detall intern');
    });
    probe.use(errorHandler);

    it('error de validació de zod → 400 validation_error', async () => {
      const res = await request(probe).get('/zod');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
      expect(res.body.error.message).toContain('n');
    });

    it('error inesperat (també asíncron) → 500 sense filtrar el missatge intern', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = await request(probe).get('/boom');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: 'internal_error', message: 'Error intern del servidor' },
      });
    });
  });
});

describe('OpenAPI', () => {
  it('serveix /api/v1/openapi.json amb les rutes registrades', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/esdeveniments');
    expect(res.body.components.schemas).toHaveProperty('Error');
    expect(res.body.components.schemas).toHaveProperty('Esdeveniment');
    expect(res.body.components.securitySchemes).toHaveProperty('ApiKeyAprop');

    const tipus = res.body.paths['/esdeveniments'].get.parameters.find(
      (parameter: { name: string }) => parameter.name === 'tipus',
    );
    expect(tipus.schema.enum).toEqual([
      'fase_llunar',
      'pluja_estels',
      'eclipsi_solar',
      'eclipsi_llunar',
      'conjuncio',
      'superlluna',
    ]);
  });

  it('serveix la UI a /api/v1/docs/', async () => {
    const res = await request(app).get('/api/v1/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

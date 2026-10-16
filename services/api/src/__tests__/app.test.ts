import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
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

describe('JWT auth i perfil en el primer accés', () => {
  let profileExists = false;
  const profileStore = {
    ensureProfile: jest.fn(async (user) => {
      if (profileExists) {
        return {
          created: false,
          profile: {
            id: 'profile-1',
            authUserId: user.id,
            email: user.email ?? null,
            nom: user.email ? user.email.split('@')[0] : null,
            avatarUrl: typeof user.appMetadata?.avatar_url === 'string' ? user.appMetadata.avatar_url : null,
            dataCreacio: new Date('2026-10-14T12:00:00.000Z'),
            dataActualitzacio: new Date('2026-10-14T12:00:00.000Z'),
          },
        };
      }

      profileExists = true;
      return {
        created: true,
        profile: {
          id: 'profile-1',
          authUserId: user.id,
          email: user.email ?? null,
          nom: user.email ? user.email.split('@')[0] : null,
          avatarUrl: typeof user.appMetadata?.avatar_url === 'string' ? user.appMetadata.avatar_url : null,
          dataCreacio: new Date('2026-10-14T12:00:00.000Z'),
          dataActualitzacio: new Date('2026-10-14T12:00:00.000Z'),
        },
      };
    }),
  };

  const supabaseUrl = 'https://example.supabase.co';
  const authApp = createApp({
    supabaseUrl,
    profileStore,
  });

  beforeEach(() => {
    profileExists = false;
    profileStore.ensureProfile.mockClear();
  });

  it('respón 401 si falta el JWT', async () => {
    const res = await request(authApp).post('/api/v1/perfil');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Falta el token JWT de Supabase' } });
  });

  it('respón 401 si el JWT és invàlid', async () => {
    const res = await request(authApp).post('/api/v1/perfil').set('Authorization', 'Bearer invalid.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('crea el perfil la primera vegada i el torna a 200 la segona', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwk = {
      ...(await exportJWK(publicKey)),
      alg: 'ES256',
      use: 'sig',
      kid: 'test-key',
    };
    const localJwks: ReturnType<typeof createLocalJWKSet> = createLocalJWKSet({ keys: [jwk] });
    const jwtApp = createApp({
      supabaseUrl,
      profileStore,
      jwks: localJwks,
    });

    const token = await new SignJWT({
      sub: 'user-123',
      email: 'maria@example.com',
      role: 'authenticated',
      app_metadata: { avatar_url: 'https://example.com/avatar.png' },
      user_metadata: { full_name: 'Maria' },
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuedAt()
      .setIssuer(`${supabaseUrl}/auth/v1`)
      .setAudience('authenticated')
      .sign(privateKey);

    let res = await request(jwtApp).post('/api/v1/perfil').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);

    res = await request(jwtApp).post('/api/v1/perfil').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
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
    expect(res.body.components.schemas).toHaveProperty('Error');
  });

  it('serveix la UI a /api/v1/docs/', async () => {
    const res = await request(app).get('/api/v1/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  customFetch,
  errors as joseErrors,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTHeaderParameters,
} from 'jose';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '../app';
import type { AuthenticatedUser } from '../middleware/auth';
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
  const supabaseUrl = 'https://example.supabase.co';
  const issuer = `${supabaseUrl}/auth/v1`;

  let profileExists = false;
  const profileStore = {
    ensureProfile: jest.fn(async (user: AuthenticatedUser) => {
      const created = !profileExists;
      profileExists = true;
      return {
        created,
        profile: {
          id: 'profile-1',
          authUserId: user.id,
          email: user.email ?? null,
          nom: user.email?.split('@')[0] ?? null,
          avatarUrl:
            typeof user.userMetadata?.avatar_url === 'string' ? user.userMetadata.avatar_url : null,
          dataCreacio: new Date('2026-10-14T12:00:00.000Z'),
          dataActualitzacio: new Date('2026-10-14T12:00:00.000Z'),
        },
      };
    }),
  };

  let privateKey: CryptoKey;
  let jwtApp: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const keyPair = await generateKeyPair('ES256');
    privateKey = keyPair.privateKey;
    const jwk = {
      ...(await exportJWK(keyPair.publicKey)),
      alg: 'ES256',
      use: 'sig',
      kid: 'test-key',
    };
    jwtApp = createApp({ supabaseUrl, profileStore, jwks: createLocalJWKSet({ keys: [jwk] }) });
  });

  beforeEach(() => {
    profileExists = false;
    profileStore.ensureProfile.mockClear();
  });

  type TokenOptions = {
    sub?: string | null;
    iss?: string;
    aud?: string;
    exp?: number | string;
    key?: CryptoKey | Uint8Array;
    header?: Partial<JWTHeaderParameters> & Record<string, unknown>;
    claims?: Record<string, unknown>;
  };

  async function signToken({
    sub = 'user-123',
    iss = issuer,
    aud = 'authenticated',
    exp = '1h',
    key = privateKey,
    header = {},
    claims = {},
  }: TokenOptions = {}) {
    const jwt = new SignJWT({
      email: 'maria@example.com',
      role: 'authenticated',
      user_metadata: { full_name: 'Maria', avatar_url: 'https://example.com/avatar.png' },
      ...claims,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key', ...header })
      .setIssuedAt()
      .setIssuer(iss)
      .setAudience(aud)
      .setExpirationTime(exp);
    if (sub !== null) jwt.setSubject(sub);
    // jose no signa un `crit` desconegut si no se li diu: aquí el volem, per provar que l'API el rebutja.
    const crit = Object.fromEntries((header.crit ?? []).map((nom) => [nom, true]));
    return jwt.sign(key, { crit });
  }

  const postPerfil = (app: ReturnType<typeof createApp>, token: string) =>
    request(app).post('/api/v1/perfil').set('Authorization', `Bearer ${token}`);

  it('respon 401 si falta el JWT', async () => {
    const res = await request(jwtApp).post('/api/v1/perfil');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'unauthorized', message: 'Falta el token JWT de Supabase' },
    });
  });

  it('crea el perfil la primera vegada (201) i el torna la segona (200)', async () => {
    const token = await signToken();

    let res = await postPerfil(jwtApp, token);
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.profile.avatarUrl).toBe('https://example.com/avatar.png');

    res = await postPerfil(jwtApp, token);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
  });

  it.each<[string, () => Promise<string>]>([
    ['mal format', async () => 'invalid.token'],
    ['caducat', () => signToken({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ["amb un 'iss' incorrecte", () => signToken({ iss: 'https://altre.supabase.co/auth/v1' })],
    ["amb un 'aud' incorrecte", () => signToken({ aud: 'anon' })],
    ['sense sub', () => signToken({ sub: null })],
    [
      'signat amb una altra clau',
      async () => signToken({ key: (await generateKeyPair('ES256')).privateKey }),
    ],
    ["amb un 'kid' desconegut", () => signToken({ header: { kid: 'una-altra' } })],
    [
      'amb un algorisme no permès (HS256)',
      () => signToken({ header: { alg: 'HS256' }, key: new TextEncoder().encode('x'.repeat(32)) }),
    ],
    ["amb un 'sub' que no és una cadena", () => signToken({ sub: null, claims: { sub: 123 } })],
    [
      "amb un 'crit' desconegut",
      () => signToken({ header: { crit: ['x-desconegut'], 'x-desconegut': true } }),
    ],
  ])('respon 401 amb un JWT %s', async (_cas, makeToken) => {
    const res = await postPerfil(jwtApp, await makeToken());
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'JWT invàlid o caducat' } });
    expect(profileStore.ensureProfile).not.toHaveBeenCalled();
  });

  it.each<[string, Error]>([
    [
      'el JWKS respon un 5xx',
      new joseErrors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
    ],
    ['el JWKS triga massa', new joseErrors.JWKSTimeout()],
    ['la xarxa falla', new TypeError('fetch failed')],
  ])('respon 503 si %s', async (_cas, error) => {
    const brokenApp = createApp({
      supabaseUrl,
      profileStore,
      jwks: async () => {
        throw error;
      },
    });
    const res = await postPerfil(brokenApp, await signToken());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('service_unavailable');
  });

  it.each<[string, () => Response]>([
    ['un 500', () => new Response('', { status: 500 })],
    ['un 404', () => new Response('', { status: 404 })],
    ['un cos que no és JSON', () => new Response('no és json', { status: 200 })],
  ])('respon 503 si el JWKS remot torna %s', async (_cas, resposta) => {
    const remoteApp = createApp({
      supabaseUrl,
      profileStore,
      jwks: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
        [customFetch]: async () => resposta(),
      }),
    });
    const res = await postPerfil(remoteApp, await signToken());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('service_unavailable');
  });

  it("respon 401 a un token sense 'kid' quan el JWKS té dues claus (rotació)", async () => {
    const claus = await Promise.all([generateKeyPair('ES256'), generateKeyPair('ES256')]);
    const keys = await Promise.all(
      claus.map(async (k) => ({ ...(await exportJWK(k.publicKey)), alg: 'ES256' })),
    );
    const rotacioApp = createApp({ supabaseUrl, profileStore, jwks: createLocalJWKSet({ keys }) });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('user-123')
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign((await generateKeyPair('ES256')).privateKey);
    const res = await postPerfil(rotacioApp, token);
    expect(res.status).toBe(401);
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
    expect(
      res.body.paths['/esdeveniments'].get.parameters.map(
        (parameter: { name: string }) => parameter.name,
      ),
    ).toEqual(['des_de', 'fins_a', 'tipus']);
    expect(res.body.paths['/esdeveniments'].get.security).toEqual([{ ApiKeyAprop: [] }]);
  });

  it('serveix la UI a /api/v1/docs/', async () => {
    const res = await request(app).get('/api/v1/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

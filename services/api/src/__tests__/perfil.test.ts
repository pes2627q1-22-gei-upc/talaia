import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';

/**
 * `/api/v1/perfil` quan l'API no té base de dades, i el seu contracte a l'OpenAPI. El flux amb
 * perfil (201/200, GET, PATCH, 401 i 503 del JWKS) és a `app.test.ts`.
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

let token: string;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test-key' }],
  });
  token = await new SignJWT({ email: 'maria@example.com', role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject('user-123')
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey);
});

describe('/api/v1/perfil sense DATABASE_URL', () => {
  it.each(['post', 'get', 'patch'] as const)(
    'amb un JWT vàlid, %s respon 503 database_unavailable',
    async (method) => {
      const res = await request(createApp({ supabaseUrl, jwks }))
        [method]('/api/v1/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({ nom: 'Maria' });
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: { code: 'database_unavailable', message: expect.any(String) },
      });
    },
  );

  it('sense JWT continua sent un 401: el token es mira abans que la base de dades', async () => {
    const res = await request(createApp({ supabaseUrl, jwks })).post('/api/v1/perfil');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });
});

describe('POST /api/v1/perfil a l’OpenAPI', () => {
  it('documenta el cos opcional, les dues respostes bones i els errors', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const perfil = res.body.paths['/perfil'].post;
    expect(perfil.tags).toEqual(['Auth']);
    expect(perfil.requestBody.required).toBe(false);
    expect(perfil.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/ProfileEnsureBody',
    );
    expect(Object.keys(perfil.responses).sort()).toEqual(['200', '201', '401', '503']);
    expect(perfil.responses['201'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/ProfileEnsureResponse',
    );

    const { ProfileEnsureBody, ProfileEnsureResponse, Perfil } = res.body.components.schemas;
    expect(ProfileEnsureBody.properties.nom).toMatchObject({ type: 'string', maxLength: 100 });
    expect(ProfileEnsureBody.required).toBeUndefined();
    expect(ProfileEnsureResponse.required).toEqual(['created', 'profile']);
    expect(ProfileEnsureResponse.properties.profile.$ref).toBe('#/components/schemas/Perfil');
    expect(Object.keys(Perfil.properties)).toEqual([
      'id',
      'authUserId',
      'email',
      'nom',
      'avatarUrl',
      'dataCreacio',
      'dataActualitzacio',
    ]);
  });
});

describe('GET i PATCH /api/v1/perfil a l’OpenAPI', () => {
  it('documenten el perfil, el cos del PATCH i els errors', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { get, patch } = res.body.paths['/perfil'];
    expect(Object.keys(get.responses).sort()).toEqual(['200', '401', '404', '503']);
    expect(get.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/Perfil',
    );
    expect(Object.keys(patch.responses).sort()).toEqual(['200', '400', '401', '404', '503']);
    expect(patch.requestBody.required).toBe(true);

    const { PerfilCanvis } = res.body.components.schemas;
    expect(PerfilCanvis).toMatchObject({
      required: ['nom'],
      additionalProperties: false,
      properties: { nom: { type: 'string', minLength: 1, maxLength: 100 } },
    });
  });
});

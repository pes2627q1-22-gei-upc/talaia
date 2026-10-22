import express from 'express';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { requireAuth, type AuthenticatedRequest, type AuthMiddlewareOptions } from '../auth';
import { errorHandler } from '../errors';

/**
 * El middleware sol, davant d'una ruta que torna `req.user`: aquí es prova el que l'API fa amb
 * la capçalera i amb les claims, no el JWKS (això és a `app.test.ts`).
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

let privateKey: CryptoKey;
let jwks: AuthMiddlewareOptions['jwks'];

beforeAll(async () => {
  const keyPair = await generateKeyPair('ES256');
  privateKey = keyPair.privateKey;
  const jwk = { ...(await exportJWK(keyPair.publicKey)), alg: 'ES256', kid: 'test-key' };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

function probe(options: AuthMiddlewareOptions) {
  const app = express();
  app.get('/qui', requireAuth(options), (req, res) => {
    res.json({ user: (req as AuthenticatedRequest).user });
  });
  app.use(errorHandler);
  return app;
}

/** Un token signat amb la clau del JWKS, amb les claims d'un usuari de Supabase. */
function signToken(claims: Record<string, unknown> = {}) {
  return new SignJWT({ email: 'maria@example.com', role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject('user-123')
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('requireAuth · configuració', () => {
  it('sense SUPABASE_URL respon 500 internal_error sense mirar el token', async () => {
    const consulta = jest.fn(async () => {
      throw new Error('no hi hauria de venir');
    });
    const res = await request(probe({ jwks: consulta }))
      .get('/qui')
      .set('Authorization', `Bearer ${await signToken()}`);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal_error');
    expect(consulta).not.toHaveBeenCalled();
  });

  it("accepta SUPABASE_URL amb barra final: l'emissor és el mateix", async () => {
    const res = await request(probe({ supabaseUrl: `${supabaseUrl}/`, jwks }))
      .get('/qui')
      .set('Authorization', `Bearer ${await signToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-123');
  });
});

describe('requireAuth · capçalera Authorization', () => {
  it.each([
    ['sense capçalera', undefined],
    ['buida', ''],
    ['amb un esquema que no és Bearer', 'Basic bWFyaWE6c2VjcmV0'],
    ['amb «bearer» en minúscules', 'bearer x.y.z'],
    ['amb el token enganxat a Bearer', 'Bearerx.y.z'],
  ])('%s → 401 unauthorized i no consulta el JWKS', async (_cas, header) => {
    const consulta = jest.fn(async () => {
      throw new Error('no hi hauria de venir');
    });
    let req = request(probe({ supabaseUrl, jwks: consulta })).get('/qui');
    if (header !== undefined) req = req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'unauthorized', message: 'Falta el token JWT de Supabase' },
    });
    expect(consulta).not.toHaveBeenCalled();
  });

  it('«Bearer » sense res darrere és un token invàlid (401), no un 500', async () => {
    const res = await request(probe({ supabaseUrl, jwks }))
      .get('/qui')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('tolera espais al voltant del token', async () => {
    const res = await request(probe({ supabaseUrl, jwks }))
      .get('/qui')
      .set('Authorization', `Bearer   ${await signToken()}  `);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-123');
  });
});

describe('requireAuth · req.user', () => {
  it('porta només el que el perfil necessita: id, correu, rol i metadades', async () => {
    const token = await signToken({
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Maria Puig', avatar_url: 'https://example.com/maria.png' },
      // Claims que no s'han de filtrar a l'usuari.
      session_id: 'sessio-1',
      aal: 'aal1',
      amr: [{ method: 'oauth', timestamp: 1 }],
    });
    const res = await request(probe({ supabaseUrl, jwks }))
      .get('/qui')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 'user-123',
      email: 'maria@example.com',
      role: 'authenticated',
      appMetadata: { provider: 'google', providers: ['google'] },
      userMetadata: { full_name: 'Maria Puig', avatar_url: 'https://example.com/maria.png' },
    });
  });

  it('un token mínim (només sub) dona un usuari sense correu, amb rol authenticated', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject('user-123')
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(privateKey);
    const res = await request(probe({ supabaseUrl, jwks }))
      .get('/qui')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'user-123', email: null, role: 'authenticated' });
  });

  it('ignora un correu, un rol o unes metadades que no tenen el tipus que toca', async () => {
    const token = await signToken({
      email: 42,
      role: ['authenticated'],
      app_metadata: 'google',
      user_metadata: 7,
    });
    const res = await request(probe({ supabaseUrl, jwks }))
      .get('/qui')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'user-123', email: null, role: 'authenticated' });
  });

  it("conserva el rol del token quan no és l'habitual", async () => {
    const token = await signToken({ role: 'service_role' });
    const res = await request(probe({ supabaseUrl, jwks }))
      .get('/qui')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.user.role).toBe('service_role');
  });
});

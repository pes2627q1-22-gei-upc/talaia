import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';
import type { ProfileStore } from '../services/profileService';
import type { PushDeviceStore } from '../services/pushDeviceService';

/** `PUT` i `DELETE /api/v1/perfil/dispositius` (TG-152, ADR-0028). */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;
const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

let jwt: string;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test-key' }],
  });
  jwt = await new SignJWT({ email: 'maria@example.com', role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject('user-123')
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey);
});

const notUsed = async (): Promise<never> => {
  throw new Error('no s’hauria de cridar');
};

/** Només `getAccountStatus`, que fa servir `requireUser` (ADR-0029). */
const profileStore = (bloquejat = false): ProfileStore => ({
  ensureProfile: notUsed,
  getProfile: notUsed,
  updateProfile: notUsed,
  getAccountStatus: async () => ({ perfilId: 'perfil-1', rol: 'usuari', bloquejat }),
  listProfiles: notUsed,
  setBlocked: notUsed,
});

function setup(registered = true, bloquejat = false) {
  const store = {
    registerDevice: jest.fn<
      ReturnType<PushDeviceStore['registerDevice']>,
      Parameters<PushDeviceStore['registerDevice']>
    >(async () => registered),
    removeDevice: jest.fn<
      ReturnType<PushDeviceStore['removeDevice']>,
      Parameters<PushDeviceStore['removeDevice']>
    >(async () => undefined),
  };
  return {
    store,
    app: createApp({
      supabaseUrl,
      jwks,
      dispositius: store,
      profileStore: profileStore(bloquejat),
    }),
  };
}

describe('PUT /api/v1/perfil/dispositius', () => {
  it('desa el token al perfil de l’usuari del JWT i respon 204', async () => {
    const { app, store } = setup();
    const res = await request(app)
      .put('/api/v1/perfil/dispositius')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: TOKEN, plataforma: 'android' });
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(store.registerDevice).toHaveBeenCalledWith('user-123', {
      token: TOKEN,
      plataforma: 'android',
    });
  });

  it('és idempotent: la mateixa petició dues vegades respon 204 les dues', async () => {
    const { app, store } = setup();
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .put('/api/v1/perfil/dispositius')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ token: TOKEN, plataforma: 'ios' });
      expect(res.status).toBe(204);
    }
    expect(store.registerDevice).toHaveBeenCalledTimes(2);
  });

  it('accepta també el prefix nou ExpoPushToken[…]', async () => {
    const { app } = setup();
    const res = await request(app)
      .put('/api/v1/perfil/dispositius')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: 'ExpoPushToken[abc]', plataforma: 'ios' });
    expect(res.status).toBe(204);
  });

  it.each([
    ['un token que no és d’Expo', { token: 'fcm-token-natiu', plataforma: 'android' }],
    ['un token buit entre claudàtors', { token: 'ExponentPushToken[]', plataforma: 'android' }],
    ['una plataforma desconeguda', { token: TOKEN, plataforma: 'web' }],
    ['un camp de més', { token: TOKEN, plataforma: 'ios', perfilId: 'un-altre' }],
    ['sense cos', undefined],
  ])('respon 400 validation_error amb %s', async (_cas, body) => {
    const { app, store } = setup();
    const res = await request(app)
      .put('/api/v1/perfil/dispositius')
      .set('Authorization', `Bearer ${jwt}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(store.registerDevice).not.toHaveBeenCalled();
  });

  it('respon 404 profile_not_found si l’usuari encara no té perfil', async () => {
    const { app } = setup(false);
    const res = await request(app)
      .put('/api/v1/perfil/dispositius')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: TOKEN, plataforma: 'ios' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
  });

  it('respon 401 sense JWT i no toca la base de dades', async () => {
    const { app, store } = setup();
    const res = await request(app)
      .put('/api/v1/perfil/dispositius')
      .send({ token: TOKEN, plataforma: 'ios' });
    expect(res.status).toBe(401);
    expect(store.registerDevice).not.toHaveBeenCalled();
  });
});

describe('/api/v1/perfil/dispositius amb el compte bloquejat', () => {
  it.each([
    ['put', '/api/v1/perfil/dispositius'],
    ['delete', `/api/v1/perfil/dispositius/${encodeURIComponent(TOKEN)}`],
  ] as const)('%s respon 403 account_blocked i no toca els tokens', async (method, path) => {
    const { app, store } = setup(true, true);
    const res = await request(app)
      [method](path)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: TOKEN, plataforma: 'ios' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');
    expect(store.registerDevice).not.toHaveBeenCalled();
    expect(store.removeDevice).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/perfil/dispositius/{token}', () => {
  it('treu el token (descodificat) de l’usuari del JWT i respon 204', async () => {
    const { app, store } = setup();
    const res = await request(app)
      .delete(`/api/v1/perfil/dispositius/${encodeURIComponent(TOKEN)}`)
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(204);
    expect(store.removeDevice).toHaveBeenCalledWith('user-123', TOKEN);
  });

  it('respon 400 si el paràmetre no és un Expo push token', async () => {
    const { app, store } = setup();
    const res = await request(app)
      .delete('/api/v1/perfil/dispositius/qualsevol-cosa')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(400);
    expect(store.removeDevice).not.toHaveBeenCalled();
  });

  it('respon 401 sense JWT', async () => {
    const { app } = setup();
    const res = await request(app).delete(
      `/api/v1/perfil/dispositius/${encodeURIComponent(TOKEN)}`,
    );
    expect(res.status).toBe(401);
  });
});

describe('/api/v1/perfil/dispositius sense DATABASE_URL', () => {
  it.each([
    ['put', '/api/v1/perfil/dispositius'],
    ['delete', `/api/v1/perfil/dispositius/${encodeURIComponent(TOKEN)}`],
  ] as const)('%s respon 503 database_unavailable', async (method, path) => {
    const res = await request(createApp({ supabaseUrl, jwks }))
      [method](path)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: TOKEN, plataforma: 'ios' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });
});

describe('/perfil/dispositius a l’OpenAPI', () => {
  it('documenta el cos del PUT, el paràmetre del DELETE i les respostes', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { put } = res.body.paths['/perfil/dispositius'];
    const del = res.body.paths['/perfil/dispositius/{token}'].delete;
    expect(Object.keys(put.responses).sort()).toEqual(['204', '400', '401', '403', '404', '503']);
    expect(put.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/DispositiuPush',
    );
    expect(Object.keys(del.responses).sort()).toEqual(['204', '400', '401', '403', '503']);
    expect(del.parameters).toEqual([
      expect.objectContaining({ name: 'token', in: 'path', required: true }),
    ]);

    const { DispositiuPush } = res.body.components.schemas;
    expect(DispositiuPush).toMatchObject({
      required: ['token', 'plataforma'],
      additionalProperties: false,
      properties: { plataforma: { type: 'string', enum: ['ios', 'android'] } },
    });
  });
});

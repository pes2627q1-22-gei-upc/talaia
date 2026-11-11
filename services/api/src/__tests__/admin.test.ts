import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';
import type { ProfileRecord, ProfileStore } from '../services/profileService';

/**
 * HU41 (TG-177): bloqueig de comptes des de `/admin/usuaris` i 403 `account_blocked` a les rutes
 * autenticades. Els perfils viuen en un store en memòria, com a la base de dades.
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

const ADMIN = { auth: 'admin-auth', perfil: '0b9f6a52-3c1d-4e8f-9a7b-2d5c6e7f8a90' };
const MARIA = { auth: 'maria-auth', perfil: '5e2d7c41-8b3a-4f6e-9d1c-0a2b3c4d5e6f' };
const NO_EXISTEIX = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

function perfil(perfilId: string, authUserId: string, rol: ProfileRecord['rol']): ProfileRecord {
  return {
    id: perfilId,
    authUserId,
    email: `${authUserId}@example.com`,
    nom: authUserId,
    avatarUrl: null,
    rol,
    bloquejat: false,
    dataBloqueig: null,
    dataCreacio: new Date('2026-11-01T12:00:00.000Z'),
    dataActualitzacio: new Date('2026-11-01T12:00:00.000Z'),
  };
}

let perfils: ProfileRecord[];
const byAuth = (authUserId: string) => perfils.find((p) => p.authUserId === authUserId) ?? null;

const profileStore: ProfileStore = {
  ensureProfile: async (user) => ({ created: false, profile: byAuth(user.id)! }),
  getProfile: async (authUserId) => byAuth(authUserId),
  updateProfile: async (authUserId) => byAuth(authUserId),
  getAccountStatus: async (authUserId) => {
    const p = byAuth(authUserId);
    return p ? { perfilId: p.id, rol: p.rol, bloquejat: p.bloquejat } : null;
  },
  listProfiles: async () => perfils,
  setBlocked: async (perfilId, bloquejat) => {
    const p = perfils.find((candidat) => candidat.id === perfilId);
    if (!p) return null;
    p.bloquejat = bloquejat;
    p.dataBloqueig = bloquejat ? (p.dataBloqueig ?? new Date('2026-11-12T10:00:00.000Z')) : null;
    return p;
  },
};

let app: ReturnType<typeof createApp>;
let privateKey: CryptoKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair('ES256');
  privateKey = keyPair.privateKey;
  const jwk = { ...(await exportJWK(keyPair.publicKey)), alg: 'ES256', kid: 'test-key' };
  app = createApp({ supabaseUrl, profileStore, jwks: createLocalJWKSet({ keys: [jwk] }) });
});

beforeEach(() => {
  perfils = [perfil(ADMIN.perfil, ADMIN.auth, 'admin'), perfil(MARIA.perfil, MARIA.auth, 'usuari')];
});

const tokenFor = (sub: string) =>
  new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey);

const bloqueja = async (com: string, perfilId: string, bloquejat: unknown) =>
  request(app)
    .patch(`/api/v1/admin/usuaris/${perfilId}`)
    .set('Authorization', `Bearer ${await tokenFor(com)}`)
    .send({ bloquejat });

const getPerfil = async (com: string) =>
  request(app)
    .get('/api/v1/perfil')
    .set('Authorization', `Bearer ${await tokenFor(com)}`);

describe('PATCH /api/v1/admin/usuaris/{id}', () => {
  it("l'admin bloqueja i desbloqueja un compte", async () => {
    let res = await bloqueja(ADMIN.auth, MARIA.perfil, true);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      id: MARIA.perfil,
      rol: 'usuari',
      bloquejat: true,
      dataBloqueig: '2026-11-12T10:00:00.000Z',
    });

    res = await bloqueja(ADMIN.auth, MARIA.perfil, false);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bloquejat: false, dataBloqueig: null });
  });

  it('respon 401 sense token', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/usuaris/${MARIA.perfil}`)
      .send({ bloquejat: true });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('respon 403 forbidden a un usuari que no és admin', async () => {
    const res = await bloqueja(MARIA.auth, ADMIN.perfil, true);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect(perfils[0]?.bloquejat).toBe(false);
  });

  it('respon 403 forbidden a un usuari sense perfil', async () => {
    const res = await bloqueja('sense-perfil', MARIA.perfil, true);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it("respon 404 usuari_not_found si l'id no és de cap perfil", async () => {
    const res = await bloqueja(ADMIN.auth, NO_EXISTEIX, true);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('usuari_not_found');
  });

  it.each<[string, string, unknown]>([
    ['un id que no és un UUID', 'maria', true],
    ['un bloquejat que no és booleà', MARIA.perfil, 'sí'],
    ['sense bloquejat', MARIA.perfil, undefined],
  ])('respon 400 validation_error amb %s', async (_cas, perfilId, bloquejat) => {
    const res = await bloqueja(ADMIN.auth, perfilId, bloquejat);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it("l'admin no es pot bloquejar a si mateix", async () => {
    const res = await bloqueja(ADMIN.auth, ADMIN.perfil, true);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('cannot_block_self');
    expect(perfils[0]?.bloquejat).toBe(false);
  });

  it('un admin bloquejat tampoc no hi entra', async () => {
    perfils[0]!.bloquejat = true;
    const res = await bloqueja(ADMIN.auth, MARIA.perfil, true);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');
  });
});

describe('GET /api/v1/admin/usuaris', () => {
  it("llista els comptes amb el rol i el bloqueig, només per a l'admin", async () => {
    let res = await request(app)
      .get('/api/v1/admin/usuaris')
      .set('Authorization', `Bearer ${await tokenFor(ADMIN.auth)}`);
    expect(res.status).toBe(200);
    expect(res.body.map((u: { id: string; rol: string }) => [u.id, u.rol])).toEqual([
      [ADMIN.perfil, 'admin'],
      [MARIA.perfil, 'usuari'],
    ]);
    expect(res.body[1]).toMatchObject({ bloquejat: false, dataBloqueig: null });

    res = await request(app)
      .get('/api/v1/admin/usuaris')
      .set('Authorization', `Bearer ${await tokenFor(MARIA.auth)}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});

describe('compte bloquejat', () => {
  it('rep 403 account_blocked a /perfil i, un cop desbloquejat, hi torna a entrar', async () => {
    expect((await getPerfil(MARIA.auth)).status).toBe(200);

    await bloqueja(ADMIN.auth, MARIA.perfil, true);
    const responses = await Promise.all([
      getPerfil(MARIA.auth),
      request(app)
        .post('/api/v1/perfil')
        .set('Authorization', `Bearer ${await tokenFor(MARIA.auth)}`),
      request(app)
        .patch('/api/v1/perfil')
        .set('Authorization', `Bearer ${await tokenFor(MARIA.auth)}`)
        .send({ nom: 'Maria' }),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: { code: 'account_blocked', message: expect.stringContaining('bloquejat') },
      });
    }

    await bloqueja(ADMIN.auth, MARIA.perfil, false);
    expect((await getPerfil(MARIA.auth)).status).toBe(200);
  });

  it('les rutes públiques no hi miren', async () => {
    perfils[1]!.bloquejat = true;
    const token = await tokenFor(MARIA.auth);
    // Sense base de dades responen 503, però no 403: el bloqueig no s'hi aplica.
    for (const path of ['/health', '/punts', '/recomanacions', '/esdeveniments']) {
      const res = await request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
      expect(res.body.error?.code).not.toBe('account_blocked');
    }
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });
});

describe('/admin/usuaris a l’OpenAPI', () => {
  it('documenta les dues rutes amb els errors i els esquemes', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    const { get } = res.body.paths['/admin/usuaris'];
    const { patch } = res.body.paths['/admin/usuaris/{id}'];
    expect(get.tags).toEqual(['Admin']);
    expect(get.security).toEqual([{ BearerSupabase: [] }]);
    expect(Object.keys(get.responses).sort()).toEqual(['200', '401', '403', '503']);
    expect(Object.keys(patch.responses).sort()).toEqual(['200', '400', '401', '403', '404', '503']);
    expect(patch.parameters[0]).toMatchObject({ name: 'id', in: 'path' });
    expect(patch.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/UsuariAdminCanvis',
    );
    expect(patch.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/UsuariAdmin',
    );
    const { UsuariAdmin, UsuariAdminCanvis } = res.body.components.schemas;
    expect(UsuariAdmin.properties).toHaveProperty('bloquejat');
    expect(UsuariAdmin.properties).toHaveProperty('dataBloqueig');
    expect(UsuariAdminCanvis.required).toEqual(['bloquejat']);
  });

  it('les rutes de /perfil documenten el 403 account_blocked', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.body.paths['/perfil'].get.responses['403'].description).toContain('account_blocked');
  });
});

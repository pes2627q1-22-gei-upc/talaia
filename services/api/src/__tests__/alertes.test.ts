import type { Alerta, AlertaNova } from '@talaia/shared';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import type { AlertesStore } from '../alertes/alertesRepository';
import { createApp } from '../app';
import type { AccountStatus, ProfileStore } from '../services/profileService';

/**
 * `POST` i `GET /api/v1/alertes` (HU16, TG-145) amb JWT locals, el `requireUser` comú (comptes
 * bloquejats, TG-177) i les alertes en memòria.
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

const MARIA = { auth: 'maria-auth', perfil: 'perfil-maria' };
const PERE = { auth: 'pere-auth', perfil: 'perfil-pere' };
const BLOQUEJAT = { auth: 'bloquejat-auth', perfil: 'perfil-bloquejat' };
const SENSE_PERFIL = 'sense-perfil-auth';

const COMPTES: Record<string, AccountStatus> = {
  [MARIA.auth]: { perfilId: MARIA.perfil, rol: 'usuari', bloquejat: false },
  [PERE.auth]: { perfilId: PERE.perfil, rol: 'usuari', bloquejat: false },
  [BLOQUEJAT.auth]: { perfilId: BLOQUEJAT.perfil, rol: 'usuari', bloquejat: true },
};

const noCal = async (): Promise<never> => {
  throw new Error('aquests tests no la fan servir');
};

/** Només `getAccountStatus`, que és el que llegeix `requireUser`. */
const profileStore: ProfileStore = {
  ensureProfile: noCal,
  getProfile: noCal,
  updateProfile: noCal,
  getAccountStatus: async (authUserId) => COMPTES[authUserId] ?? null,
  listProfiles: noCal,
  setBlocked: noCal,
};

const NOVA: AlertaNova = {
  objectiu: 'pluja_estels',
  origen: { lat: 41.3874, lon: 2.1686 },
  distanciaMaxKm: 60,
  indexMinim: 70,
};

/** Com el de la base de dades: cada perfil només veu les seves. */
function memoryStore() {
  const alertes: { perfilId: string; alerta: Alerta }[] = [];
  const store = {
    create: jest.fn<ReturnType<AlertesStore['create']>, Parameters<AlertesStore['create']>>(
      async (perfilId, nova) => {
        const alerta: Alerta = {
          ...nova,
          id: `alerta-${alertes.length + 1}`,
          activa: true,
          dataCreacio: '2026-11-10T18:00:00.000Z',
          dataActualitzacio: '2026-11-10T18:00:00.000Z',
        };
        alertes.unshift({ perfilId, alerta });
        return alerta;
      },
    ),
    list: jest.fn<ReturnType<AlertesStore['list']>, Parameters<AlertesStore['list']>>(
      async (perfilId) => alertes.filter((a) => a.perfilId === perfilId).map((a) => a.alerta),
    ),
  } satisfies AlertesStore;
  return store;
}

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;
const tokens: Record<string, string> = {};

const sign = (sub: string, key: CryptoKey = privateKey, exp: string | number = '1h') =>
  new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime(exp)
    .sign(key);

beforeAll(async () => {
  const keyPair = await generateKeyPair('ES256');
  privateKey = keyPair.privateKey;
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keyPair.publicKey)), alg: 'ES256', kid: 'test-key' }],
  });
  for (const sub of [MARIA.auth, PERE.auth, BLOQUEJAT.auth, SENSE_PERFIL]) {
    tokens[sub] = await sign(sub);
  }
});

const appAmb = (store: AlertesStore) =>
  createApp({ supabaseUrl, jwks, profileStore, alertes: store });
const auth = (sub: string) => `Bearer ${tokens[sub]}`;

describe('POST /api/v1/alertes', () => {
  it("crea l'alerta activa al perfil de l'usuari del JWT i respon 201 sense memòria cau", async () => {
    const store = memoryStore();
    const res = await request(appAmb(store))
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send(NOVA);

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      ...NOVA,
      id: 'alerta-1',
      activa: true,
      dataCreacio: '2026-11-10T18:00:00.000Z',
      dataActualitzacio: '2026-11-10T18:00:00.000Z',
    });
    expect(store.create).toHaveBeenCalledWith(MARIA.perfil, NOVA);
  });

  it.each([
    ['un perfilId (l’usuari només surt del JWT)', { ...NOVA, perfilId: PERE.perfil }],
    ['un camp desconegut', { ...NOVA, activa: false }],
    ['un objectiu que no existeix', { ...NOVA, objectiu: 'aurora' }],
    ['indexMinim > 100', { ...NOVA, indexMinim: 101 }],
    ['indexMinim < 0', { ...NOVA, indexMinim: -1 }],
    ['indexMinim no enter', { ...NOVA, indexMinim: 70.5 }],
    ['distanciaMaxKm 0', { ...NOVA, distanciaMaxKm: 0 }],
    ['distanciaMaxKm > 200', { ...NOVA, distanciaMaxKm: 201 }],
    ['distanciaMaxKm no enter', { ...NOVA, distanciaMaxKm: 3.5 }],
    ['una latitud fora de rang', { ...NOVA, origen: { lat: 91, lon: 2 } }],
    ['una longitud com a text', { ...NOVA, origen: { lat: 41, lon: '2' } }],
    ['sense origen', { objectiu: 'eclipsi', distanciaMaxKm: 60, indexMinim: 70 }],
    ['un cos buit', undefined],
  ])('amb %s respon 400 validation_error', async (_cas, body) => {
    const store = memoryStore();
    const res = await request(appAmb(store))
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(store.create).not.toHaveBeenCalled();
  });

  it("respon 404 profile_not_found si l'usuari no ha fet POST /perfil", async () => {
    const store = memoryStore();
    const res = await request(appAmb(store))
      .post('/api/v1/alertes')
      .set('Authorization', auth(SENSE_PERFIL))
      .send(NOVA);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
    expect(store.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/alertes', () => {
  it("només torna les alertes de l'usuari del JWT", async () => {
    const app = appAmb(memoryStore());
    await request(app).post('/api/v1/alertes').set('Authorization', auth(MARIA.auth)).send(NOVA);
    await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(PERE.auth))
      .send({ ...NOVA, objectiu: 'via_lactia' });
    await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send({ ...NOVA, objectiu: 'eclipsi' });

    const maria = await request(app).get('/api/v1/alertes').set('Authorization', auth(MARIA.auth));
    const pere = await request(app).get('/api/v1/alertes').set('Authorization', auth(PERE.auth));

    expect(maria.status).toBe(200);
    expect(maria.headers['cache-control']).toBe('no-store');
    expect(maria.body.map((a: Alerta) => a.objectiu)).toEqual(['eclipsi', 'pluja_estels']);
    expect(pere.body.map((a: Alerta) => a.objectiu)).toEqual(['via_lactia']);
  });

  it('torna una llista buida si no en té cap', async () => {
    const res = await request(appAmb(memoryStore()))
      .get('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("respon 404 profile_not_found si l'usuari no té perfil", async () => {
    const res = await request(appAmb(memoryStore()))
      .get('/api/v1/alertes')
      .set('Authorization', auth(SENSE_PERFIL));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
  });
});

describe('/api/v1/alertes amb un compte bloquejat (TG-177)', () => {
  it.each(['post', 'get'] as const)('%s respon 403 account_blocked', async (method) => {
    const store = memoryStore();
    const res = await request(appAmb(store))
      [method]('/api/v1/alertes')
      .set('Authorization', auth(BLOQUEJAT.auth))
      .send(NOVA);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');
    expect(store.create).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
  });
});

describe('/api/v1/alertes sense un JWT vàlid', () => {
  it.each(['post', 'get'] as const)('%s sense Authorization respon 401', async (method) => {
    const store = memoryStore();
    const res = await request(appAmb(store))[method]('/api/v1/alertes').send(NOVA);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
    expect(store.create).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
  });

  it('un token caducat o signat amb una altra clau respon 401', async () => {
    const altra = (await generateKeyPair('ES256')).privateKey;
    const app = appAmb(memoryStore());
    for (const token of [
      await sign(MARIA.auth, privateKey, Math.floor(Date.now() / 1000) - 60),
      await sign(MARIA.auth, altra),
    ]) {
      const res = await request(app).get('/api/v1/alertes').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });
});

describe('/api/v1/alertes sense DATABASE_URL', () => {
  it.each(['post', 'get'] as const)(
    'amb un JWT vàlid, %s respon 503 database_unavailable',
    async (method) => {
      const res = await request(createApp({ supabaseUrl, jwks }))
        [method]('/api/v1/alertes')
        .set('Authorization', auth(MARIA.auth))
        .send(NOVA);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('database_unavailable');
    },
  );

  it('sense JWT continua sent un 401: el token es mira abans que la base de dades', async () => {
    const res = await request(createApp({ supabaseUrl, jwks })).get('/api/v1/alertes');
    expect(res.status).toBe(401);
  });
});

describe('/alertes a l’OpenAPI', () => {
  it('documenta POST i GET amb els esquemes Alerta i AlertaNova i els errors comuns', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { post, get } = res.body.paths['/alertes'];

    expect(post.tags).toEqual(['Alertes']);
    expect(post.requestBody.required).toBe(true);
    expect(post.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertaNova',
    );
    expect(Object.keys(post.responses).sort()).toEqual(['201', '400', '401', '403', '404', '503']);
    expect(Object.keys(get.responses).sort()).toEqual(['200', '401', '403', '404', '503']);
    expect(post.responses['403'].description).toContain('account_blocked');
    expect(get.responses['200'].content['application/json'].schema.items.$ref).toBe(
      '#/components/schemas/Alerta',
    );

    const { AlertaNova: nova, Alerta: alerta } = res.body.components.schemas;
    expect(nova.required.sort()).toEqual(['distanciaMaxKm', 'indexMinim', 'objectiu', 'origen']);
    expect(nova.additionalProperties).toBe(false);
    expect(nova.properties.indexMinim).toMatchObject({ type: 'integer', minimum: 0, maximum: 100 });
    expect(nova.properties.distanciaMaxKm).toMatchObject({ minimum: 1, maximum: 200 });
    expect(Object.keys(alerta.properties)).toEqual([
      'id',
      'objectiu',
      'origen',
      'distanciaMaxKm',
      'indexMinim',
      'activa',
      'dataCreacio',
      'dataActualitzacio',
    ]);
  });
});

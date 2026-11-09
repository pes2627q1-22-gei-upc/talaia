import type { Alerta, AlertaNova } from '@talaia/shared';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import type { AlertesStore } from '../alertes/alertesRepository';
import { createApp } from '../app';

/** `POST` i `GET /api/v1/alertes` (HU16, TG-145) amb JWT locals i un store en memòria. */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

const MARIA = 'user-maria';
const PERE = 'user-pere';
const SENSE_PERFIL = 'user-sense-perfil';

const NOVA: AlertaNova = {
  objectiu: 'pluja_estels',
  origen: { lat: 41.3874, lon: 2.1686 },
  distanciaMaxKm: 60,
  indexMinim: 70,
};

/** Store en memòria: com el de la base de dades, cada usuari només veu les seves. */
function memoryStore(perfils: string[]) {
  const alertes: { owner: string; alerta: Alerta }[] = [];
  const store: AlertesStore = {
    create: jest.fn(async (userId: string, nova: AlertaNova) => {
      if (!perfils.includes(userId)) return null;
      const alerta: Alerta = {
        ...nova,
        id: `alerta-${alertes.length + 1}`,
        activa: true,
        dataCreacio: '2026-11-10T18:00:00.000Z',
        dataActualitzacio: '2026-11-10T18:00:00.000Z',
      };
      alertes.unshift({ owner: userId, alerta });
      return alerta;
    }),
    list: jest.fn(async (userId: string) =>
      perfils.includes(userId)
        ? alertes.filter((a) => a.owner === userId).map((a) => a.alerta)
        : null,
    ),
  };
  return store;
}

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;
let tokens: Record<string, string>;

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
  tokens = {
    [MARIA]: await sign(MARIA),
    [PERE]: await sign(PERE),
    [SENSE_PERFIL]: await sign(SENSE_PERFIL),
  };
});

const appAmb = (store: AlertesStore) => createApp({ supabaseUrl, jwks, alertes: store });
const auth = (userId: string) => `Bearer ${tokens[userId]}`;

describe('POST /api/v1/alertes', () => {
  it("crea l'alerta activa de l'usuari del JWT i respon 201 sense memòria cau", async () => {
    const store = memoryStore([MARIA]);
    const res = await request(appAmb(store))
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA))
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
    expect(store.create).toHaveBeenCalledWith(MARIA, NOVA);
  });

  it.each([
    ['un perfilId (l’usuari només surt del JWT)', { ...NOVA, perfilId: 'un-altre' }],
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
    const store = memoryStore([MARIA]);
    const res = await request(appAmb(store))
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(store.create).not.toHaveBeenCalled();
  });

  it("respon 404 profile_not_found si l'usuari no ha fet POST /perfil", async () => {
    const res = await request(appAmb(memoryStore([MARIA])))
      .post('/api/v1/alertes')
      .set('Authorization', auth(SENSE_PERFIL))
      .send(NOVA);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
  });
});

describe('GET /api/v1/alertes', () => {
  it("només torna les alertes de l'usuari del JWT", async () => {
    const app = appAmb(memoryStore([MARIA, PERE]));
    await request(app).post('/api/v1/alertes').set('Authorization', auth(MARIA)).send(NOVA);
    await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(PERE))
      .send({ ...NOVA, objectiu: 'via_lactia' });
    await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA))
      .send({ ...NOVA, objectiu: 'eclipsi' });

    const maria = await request(app).get('/api/v1/alertes').set('Authorization', auth(MARIA));
    const pere = await request(app).get('/api/v1/alertes').set('Authorization', auth(PERE));

    expect(maria.status).toBe(200);
    expect(maria.headers['cache-control']).toBe('no-store');
    expect(maria.body.map((a: Alerta) => a.objectiu)).toEqual(['eclipsi', 'pluja_estels']);
    expect(pere.body.map((a: Alerta) => a.objectiu)).toEqual(['via_lactia']);
  });

  it('torna una llista buida si no en té cap', async () => {
    const res = await request(appAmb(memoryStore([MARIA])))
      .get('/api/v1/alertes')
      .set('Authorization', auth(MARIA));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("respon 404 profile_not_found si l'usuari no té perfil", async () => {
    const res = await request(appAmb(memoryStore([])))
      .get('/api/v1/alertes')
      .set('Authorization', auth(SENSE_PERFIL));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
  });
});

describe('/api/v1/alertes sense un JWT vàlid', () => {
  it.each(['post', 'get'] as const)('%s sense Authorization respon 401', async (method) => {
    const store = memoryStore([MARIA]);
    const res = await request(appAmb(store))[method]('/api/v1/alertes').send(NOVA);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
    expect(store.create).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
  });

  it('un token caducat o signat amb una altra clau respon 401', async () => {
    const altra = (await generateKeyPair('ES256')).privateKey;
    const app = appAmb(memoryStore([MARIA]));
    for (const token of [
      await sign(MARIA, privateKey, Math.floor(Date.now() / 1000) - 60),
      await sign(MARIA, altra),
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
        .set('Authorization', auth(MARIA))
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
  it('documenta POST i GET amb els esquemes Alerta i AlertaNova', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { post, get } = res.body.paths['/alertes'];

    expect(post.tags).toEqual(['Alertes']);
    expect(post.requestBody.required).toBe(true);
    expect(post.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertaNova',
    );
    expect(Object.keys(post.responses).sort()).toEqual(['201', '400', '401', '404', '503']);
    expect(Object.keys(get.responses).sort()).toEqual(['200', '401', '404', '503']);
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

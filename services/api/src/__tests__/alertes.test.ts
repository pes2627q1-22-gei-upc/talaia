import type { Alerta, AlertaNova } from '@talaia/shared';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { MAX_ALERTES, type AlertesStore } from '../alertes/alertesRepository';
import { createApp } from '../app';
import type { AccountStatus, ProfileStore } from '../services/profileService';

/**
 * `POST` i `GET /api/v1/alertes` (HU16, TG-145), `PATCH /api/v1/alertes/{id}` (TG-147) i
 * `DELETE /api/v1/alertes/{id}` (TG-150) amb JWT locals, el `requireUser` comú (comptes
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
  deleteAccount: noCal,
};

const NOVA: AlertaNova = {
  objectiu: 'pluja_estels',
  origen: { lat: 41.3874, lon: 2.1686 },
  distanciaMaxKm: 60,
  indexMinim: 70,
  avisaEnArribar: true,
  horaAvis: null,
};

/** Un UUID previsible per a l'alerta número `n`. */
const idAlerta = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NO_EXISTEIX = idAlerta(999);

/** Com el de la base de dades: cada perfil només veu les seves, i com a molt `MAX_ALERTES`. */
function memoryStore() {
  const alertes: { perfilId: string; alerta: Alerta }[] = [];
  const store = {
    create: jest.fn<ReturnType<AlertesStore['create']>, Parameters<AlertesStore['create']>>(
      async (perfilId, nova) => {
        if (alertes.filter((a) => a.perfilId === perfilId).length >= MAX_ALERTES) {
          return { ok: false, reason: 'limit' };
        }
        const alerta: Alerta = {
          ...nova,
          id: idAlerta(alertes.length + 1),
          activa: true,
          dataCreacio: '2026-11-10T18:00:00.000Z',
          dataActualitzacio: '2026-11-10T18:00:00.000Z',
        };
        alertes.unshift({ perfilId, alerta });
        return { ok: true, alerta };
      },
    ),
    list: jest.fn<ReturnType<AlertesStore['list']>, Parameters<AlertesStore['list']>>(
      async (perfilId) => alertes.filter((a) => a.perfilId === perfilId).map((a) => a.alerta),
    ),
    update: jest.fn<ReturnType<AlertesStore['update']>, Parameters<AlertesStore['update']>>(
      async (perfilId, id, canvis) => {
        const fila = alertes.find((a) => a.perfilId === perfilId && a.alerta.id === id);
        if (!fila) return { ok: false, reason: 'not_found' };
        const alerta = { ...fila.alerta, ...canvis, dataActualitzacio: '2026-11-15T10:00:00.000Z' };
        if (!alerta.avisaEnArribar && alerta.horaAvis === null) {
          return { ok: false, reason: 'quan_avisa' };
        }
        fila.alerta = alerta;
        return { ok: true, alerta };
      },
    ),
    remove: jest.fn<ReturnType<AlertesStore['remove']>, Parameters<AlertesStore['remove']>>(
      async (perfilId, id) => {
        const i = alertes.findIndex((a) => a.perfilId === perfilId && a.alerta.id === id);
        if (i === -1) return false;
        alertes.splice(i, 1);
        return true;
      },
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
      id: idAlerta(1),
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
    ['sense triar quan avisar', { ...NOVA, avisaEnArribar: false, horaAvis: null }],
    ['sense avisaEnArribar', { ...NOVA, avisaEnArribar: undefined }],
    ['sense horaAvis (ha de ser null si no es tria)', { ...NOVA, horaAvis: undefined }],
    ['avisaEnArribar com a text', { ...NOVA, avisaEnArribar: 'true' }],
    ['horaAvis 24', { ...NOVA, horaAvis: 24 }],
    ['horaAvis negativa', { ...NOVA, horaAvis: -1 }],
    ['horaAvis no entera', { ...NOVA, horaAvis: 18.5 }],
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

  it.each([
    ['només en arribar-hi', { avisaEnArribar: true, horaAvis: null }],
    ['només a una hora', { avisaEnArribar: false, horaAvis: 18 }],
    ['de les dues maneres', { avisaEnArribar: true, horaAvis: 0 }],
  ])('accepta avisar %s', async (_cas, quan) => {
    const store = memoryStore();
    const res = await request(appAmb(store))
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send({ ...NOVA, ...quan });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(quan);
    expect(store.create).toHaveBeenCalledWith(MARIA.perfil, { ...NOVA, ...quan });
  });

  it('sense triar quan avisar, el missatge ho explica', async () => {
    const res = await request(appAmb(memoryStore()))
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send({ ...NOVA, avisaEnArribar: false, horaAvis: null });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('quan avisar');
  });

  it(`amb ${MAX_ALERTES} alertes, la següent respon 409 alert_limit_reached`, async () => {
    const app = appAmb(memoryStore());
    for (let i = 0; i < MAX_ALERTES; i++) {
      const ok = await request(app)
        .post('/api/v1/alertes')
        .set('Authorization', auth(MARIA.auth))
        .send(NOVA);
      expect(ok.status).toBe(201);
    }

    const res = await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send(NOVA);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'alert_limit_reached', message: expect.stringContaining(`${MAX_ALERTES}`) },
    });

    // El límit és per usuari: en Pere encara en pot crear.
    const pere = await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(PERE.auth))
      .send(NOVA);
    expect(pere.status).toBe(201);
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

describe('PATCH /api/v1/alertes/{id}', () => {
  /** Una app amb una alerta de la Maria (`idAlerta(1)`) ja creada. */
  async function ambAlerta(nova: AlertaNova = NOVA) {
    const store = memoryStore();
    const app = appAmb(store);
    const res = await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send(nova);
    expect(res.status).toBe(201);
    return { store, app, id: res.body.id as string };
  }

  it('desactiva i torna a activar una alerta (HU19) sense memòria cau', async () => {
    const { store, app, id } = await ambAlerta();

    const off = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth))
      .send({ activa: false });
    expect(off.status).toBe(200);
    expect(off.headers['cache-control']).toBe('no-store');
    expect(off.body).toMatchObject({ ...NOVA, id, activa: false });
    expect(off.body.dataActualitzacio).toBe('2026-11-15T10:00:00.000Z');
    expect(store.update).toHaveBeenCalledWith(MARIA.perfil, id, { activa: false });

    const on = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth))
      .send({ activa: true });
    expect(on.body.activa).toBe(true);

    const llista = await request(app).get('/api/v1/alertes').set('Authorization', auth(MARIA.auth));
    expect(llista.body[0].activa).toBe(true);
  });

  it('edita les preferències (HU18) i només canvia els camps del cos', async () => {
    const { store, app, id } = await ambAlerta();
    const canvis = {
      objectiu: 'via_lactia',
      origen: { lat: 42.1, lon: 1.8 },
      distanciaMaxKm: 120,
      indexMinim: 55,
      avisaEnArribar: false,
      horaAvis: 20,
    };

    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth))
      .send(canvis);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...canvis, id, activa: true });
    expect(store.update).toHaveBeenCalledWith(MARIA.perfil, id, canvis);
  });

  it('accepta treure l’hora si continua avisant en arribar-hi', async () => {
    const { app, id } = await ambAlerta({ ...NOVA, avisaEnArribar: true, horaAvis: 18 });
    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth))
      .send({ horaAvis: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ avisaEnArribar: true, horaAvis: null });
  });

  it('respon 400 si amb els canvis l’alerta no avisaria mai', async () => {
    const { app, id } = await ambAlerta({ ...NOVA, avisaEnArribar: true, horaAvis: null });
    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth))
      .send({ avisaEnArribar: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'validation_error',
      message: expect.stringContaining('quan avisar'),
    });
  });

  it.each([
    ['un cos buit', {}],
    ['sense cos', undefined],
    ['un perfilId (l’usuari només surt del JWT)', { perfilId: PERE.perfil }],
    ['un camp desconegut', { activa: false, id: idAlerta(2) }],
    ['activa com a text', { activa: 'false' }],
    ['activa null', { activa: null }],
    ['un objectiu que no existeix', { objectiu: 'aurora' }],
    ['indexMinim > 100', { indexMinim: 101 }],
    ['distanciaMaxKm 0', { distanciaMaxKm: 0 }],
    ['horaAvis 24', { horaAvis: 24 }],
    ['avisaEnArribar null', { avisaEnArribar: null }],
    ['un origen sense longitud', { origen: { lat: 41 } }],
  ])('amb %s respon 400 validation_error', async (_cas, body) => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(store.update).not.toHaveBeenCalled();
  });

  it('respon 400 validation_error si l’id no és un UUID', async () => {
    const { store, app } = await ambAlerta();
    const res = await request(app)
      .patch('/api/v1/alertes/no-es-un-uuid')
      .set('Authorization', auth(MARIA.auth))
      .send({ activa: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(store.update).not.toHaveBeenCalled();
  });

  it('respon 404 alert_not_found si l’alerta no existeix', async () => {
    const { app } = await ambAlerta();
    const res = await request(app)
      .patch(`/api/v1/alertes/${NO_EXISTEIX}`)
      .set('Authorization', auth(MARIA.auth))
      .send({ activa: false });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('alert_not_found');
  });

  it('una alerta d’un altre usuari respon 404 com si no existís i no canvia', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(PERE.auth))
      .send({ activa: false });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('alert_not_found');
    expect(store.update).toHaveBeenCalledWith(PERE.perfil, id, { activa: false });

    const maria = await request(app).get('/api/v1/alertes').set('Authorization', auth(MARIA.auth));
    expect(maria.body[0].activa).toBe(true);
  });

  it("respon 404 profile_not_found si l'usuari no té perfil", async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(SENSE_PERFIL))
      .send({ activa: false });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
    expect(store.update).not.toHaveBeenCalled();
  });

  it('amb un compte bloquejat respon 403 account_blocked', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .patch(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(BLOQUEJAT.auth))
      .send({ activa: false });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');
    expect(store.update).not.toHaveBeenCalled();
  });

  it('sense Authorization respon 401', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app).patch(`/api/v1/alertes/${id}`).send({ activa: false });
    expect(res.status).toBe(401);
    expect(store.update).not.toHaveBeenCalled();
  });

  it('sense DATABASE_URL respon 503 database_unavailable', async () => {
    const res = await request(createApp({ supabaseUrl, jwks }))
      .patch(`/api/v1/alertes/${idAlerta(1)}`)
      .set('Authorization', auth(MARIA.auth))
      .send({ activa: false });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });
});

describe('DELETE /api/v1/alertes/{id}', () => {
  /** Una app amb una alerta de la Maria (`idAlerta(1)`) ja creada. */
  async function ambAlerta() {
    const store = memoryStore();
    const app = appAmb(store);
    const res = await request(app)
      .post('/api/v1/alertes')
      .set('Authorization', auth(MARIA.auth))
      .send(NOVA);
    expect(res.status).toBe(201);
    return { store, app, id: res.body.id as string };
  }

  it('esborra l’alerta i respon 204 sense cos ni memòria cau (HU20)', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .delete(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(MARIA.auth));

    expect(res.status).toBe(204);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toBe('');
    expect(store.remove).toHaveBeenCalledWith(MARIA.perfil, id);

    const llista = await request(app).get('/api/v1/alertes').set('Authorization', auth(MARIA.auth));
    expect(llista.body).toEqual([]);
  });

  it('esborrar-la dues vegades: la segona respon 404 alert_not_found', async () => {
    const { app, id } = await ambAlerta();
    const esborra = () =>
      request(app).delete(`/api/v1/alertes/${id}`).set('Authorization', auth(MARIA.auth));
    expect((await esborra()).status).toBe(204);
    const res = await esborra();
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('alert_not_found');
  });

  it('respon 404 alert_not_found si l’alerta no existeix', async () => {
    const { app } = await ambAlerta();
    const res = await request(app)
      .delete(`/api/v1/alertes/${NO_EXISTEIX}`)
      .set('Authorization', auth(MARIA.auth));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('alert_not_found');
  });

  it('una alerta d’un altre usuari respon 404 com si no existís i no s’esborra', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .delete(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(PERE.auth));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('alert_not_found');
    expect(store.remove).toHaveBeenCalledWith(PERE.perfil, id);

    const maria = await request(app).get('/api/v1/alertes').set('Authorization', auth(MARIA.auth));
    expect(maria.body).toHaveLength(1);
  });

  it('respon 400 validation_error si l’id no és un UUID', async () => {
    const { store, app } = await ambAlerta();
    const res = await request(app)
      .delete('/api/v1/alertes/no-es-un-uuid')
      .set('Authorization', auth(MARIA.auth));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("respon 404 profile_not_found si l'usuari no té perfil", async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .delete(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(SENSE_PERFIL));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('amb un compte bloquejat respon 403 account_blocked', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app)
      .delete(`/api/v1/alertes/${id}`)
      .set('Authorization', auth(BLOQUEJAT.auth));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('sense Authorization respon 401', async () => {
    const { store, app, id } = await ambAlerta();
    const res = await request(app).delete(`/api/v1/alertes/${id}`);
    expect(res.status).toBe(401);
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('sense DATABASE_URL respon 503 database_unavailable', async () => {
    const res = await request(createApp({ supabaseUrl, jwks }))
      .delete(`/api/v1/alertes/${idAlerta(1)}`)
      .set('Authorization', auth(MARIA.auth));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
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
    expect(Object.keys(post.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
      '503',
    ]);
    expect(Object.keys(get.responses).sort()).toEqual(['200', '401', '403', '404', '503']);
    expect(post.responses['403'].description).toContain('account_blocked');
    expect(post.responses['409'].description).toContain('alert_limit_reached');
    expect(get.responses['200'].content['application/json'].schema.items.$ref).toBe(
      '#/components/schemas/Alerta',
    );

    const { AlertaNova: nova, Alerta: alerta } = res.body.components.schemas;
    expect(nova.required.sort()).toEqual([
      'avisaEnArribar',
      'distanciaMaxKm',
      'horaAvis',
      'indexMinim',
      'objectiu',
      'origen',
    ]);
    expect(nova.additionalProperties).toBe(false);
    expect(nova.properties.indexMinim).toMatchObject({ type: 'integer', minimum: 0, maximum: 100 });
    expect(nova.properties.distanciaMaxKm).toMatchObject({ minimum: 1, maximum: 200 });
    expect(nova.properties.avisaEnArribar).toMatchObject({ type: 'boolean' });
    expect(nova.properties.horaAvis).toMatchObject({ minimum: 0, maximum: 23 });
    expect(Object.keys(alerta.properties)).toEqual([
      'id',
      'objectiu',
      'origen',
      'distanciaMaxKm',
      'indexMinim',
      'avisaEnArribar',
      'horaAvis',
      'activa',
      'dataCreacio',
      'dataActualitzacio',
    ]);
  });
  it('documenta PATCH /alertes/{id} amb AlertaCanvis', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { patch } = res.body.paths['/alertes/{id}'];

    expect(patch.tags).toEqual(['Alertes']);
    expect(patch.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path', required: true }),
    ]);
    expect(patch.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertaCanvis',
    );
    expect(patch.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/Alerta',
    );
    expect(Object.keys(patch.responses).sort()).toEqual(['200', '400', '401', '403', '404', '503']);
    expect(patch.responses['404'].description).toContain('alert_not_found');

    const { AlertaCanvis: canvis } = res.body.components.schemas;
    expect(canvis.required).toBeUndefined();
    expect(canvis.additionalProperties).toBe(false);
    expect(Object.keys(canvis.properties).sort()).toEqual([
      'activa',
      'avisaEnArribar',
      'distanciaMaxKm',
      'horaAvis',
      'indexMinim',
      'objectiu',
      'origen',
    ]);
  });

  it('documenta DELETE /alertes/{id} amb 204 i 404 alert_not_found', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { delete: del } = res.body.paths['/alertes/{id}'];

    expect(del.tags).toEqual(['Alertes']);
    expect(del.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path', required: true }),
    ]);
    expect(del.requestBody).toBeUndefined();
    expect(Object.keys(del.responses).sort()).toEqual(['204', '400', '401', '403', '404', '503']);
    expect(del.responses['204'].content).toBeUndefined();
    expect(del.responses['404'].description).toContain('alert_not_found');
  });
});

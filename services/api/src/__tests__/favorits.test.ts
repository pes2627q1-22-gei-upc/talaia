import type { Favorit } from '@talaia/shared';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';
import type { FavoritsRepository } from '../favorits/favoritsRepository';
import { createFavoritsService } from '../favorits/favoritsService';
import type { ProfileStore } from '../services/profileService';

/**
 * `POST`, `GET` i `DELETE /api/v1/favorits` (HU25–HU27, TG-169) amb JWT locals, perfils en memòria
 * i un repositori en memòria que, com la base de dades, filtra pel perfil i pels punts publicats.
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

const MARIA = { auth: 'maria-auth', perfil: '5e2d7c41-8b3a-4f6e-9d1c-0a2b3c4d5e6f' };
const PERE = { auth: 'pere-auth', perfil: '0b9f6a52-3c1d-4e8f-9a7b-2d5c6e7f8a90' };
const SENSE_PERFIL = 'sense-perfil-auth';

const MONTSEC = '6f1c2b7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const PRADES = '7a2d3c8f-2b3c-4d4e-9f0a-1b2c3d4e5f60';
const RETIRAT = '8b3e4d90-3c4d-4e5f-a01b-2c3d4e5f6071';
const NO_EXISTEIX = '9c4f5ea1-4d5e-4f60-b12c-3d4e5f607182';

const PUNTS: Omit<Favorit, 'dataCreacio'>[] = [
  {
    id: MONTSEC,
    nom: 'Observatori del Montsec',
    municipi: 'Àger',
    lat: 42.0244,
    lon: 0.7364,
    index: { valor: 82, franja: 'ras', deDia: false },
  },
  {
    id: PRADES,
    nom: 'Prades',
    municipi: 'Prades',
    lat: 41.31,
    lon: 0.98,
    index: null,
  },
  {
    id: RETIRAT,
    nom: 'Retirat',
    municipi: 'Vic',
    lat: 41.93,
    lon: 2.25,
    index: null,
  },
];
/** Punts que existeixen però no són `PUBLICAT`: no es poden desar ni surten a la llista. */
let retirats: Set<string>;
const publicat = (puntId: string) =>
  retirats.has(puntId) ? undefined : PUNTS.find((p) => p.id === puntId);

let bloquejats: Set<string>;
const profileStore = {
  getAccountStatus: async (authUserId: string) => {
    const perfil = [MARIA, PERE].find((u) => u.auth === authUserId);
    return perfil
      ? { perfilId: perfil.perfil, rol: 'usuari' as const, bloquejat: bloquejats.has(perfil.auth) }
      : null;
  },
} as ProfileStore;

/** Com la taula: una fila per perfil i punt, i només es llisten els punts publicats. */
function memoryRepository() {
  const files: { perfilId: string; puntId: string; dataCreacio: string }[] = [];
  let rellotge = Date.parse('2026-11-11T18:00:00.000Z');
  const favorit = ({ puntId, dataCreacio }: (typeof files)[number]): Favorit | undefined => {
    const punt = publicat(puntId);
    return punt && { ...punt, dataCreacio };
  };
  const repo: jest.Mocked<FavoritsRepository> = {
    list: jest.fn(async (perfilId: string, _hora: Date) =>
      files
        .filter((f) => f.perfilId === perfilId)
        .sort((a, b) => b.dataCreacio.localeCompare(a.dataCreacio))
        .map(favorit)
        .filter((f): f is Favorit => f !== undefined),
    ),
    add: jest.fn(async (perfilId: string, puntId: string, _hora: Date) => {
      if (!publicat(puntId)) return undefined;
      let fila = files.find((f) => f.perfilId === perfilId && f.puntId === puntId);
      const created = !fila;
      if (!fila) {
        rellotge += 60_000;
        fila = { perfilId, puntId, dataCreacio: new Date(rellotge).toISOString() };
        files.push(fila);
      }
      return { created, favorit: favorit(fila)! };
    }),
    remove: jest.fn(async (perfilId: string, puntId: string) => {
      const i = files.findIndex((f) => f.perfilId === perfilId && f.puntId === puntId);
      if (i >= 0) files.splice(i, 1);
    }),
  };
  return repo;
}

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;
let repo: ReturnType<typeof memoryRepository>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const keyPair = await generateKeyPair('ES256');
  privateKey = keyPair.privateKey;
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keyPair.publicKey)), alg: 'ES256', kid: 'test-key' }],
  });
});

beforeEach(() => {
  bloquejats = new Set();
  retirats = new Set([RETIRAT]);
  repo = memoryRepository();
  app = createApp({ supabaseUrl, jwks, profileStore, favorits: createFavoritsService(repo) });
});

const tokenFor = (sub: string, key: CryptoKey = privateKey, exp: string | number = '1h') =>
  new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime(exp)
    .sign(key);

const desa = async (com: string, body: unknown) =>
  request(app)
    .post('/api/v1/favorits')
    .set('Authorization', `Bearer ${await tokenFor(com)}`)
    .send(body as object);

const llista = async (com: string) =>
  request(app)
    .get('/api/v1/favorits')
    .set('Authorization', `Bearer ${await tokenFor(com)}`);

const treu = async (com: string, puntId: string) =>
  request(app)
    .delete(`/api/v1/favorits/${puntId}`)
    .set('Authorization', `Bearer ${await tokenFor(com)}`);

const noms = (res: request.Response) => (res.body as Favorit[]).map((f) => f.nom);

describe('POST /api/v1/favorits', () => {
  it('desa un punt publicat (201) i, si ja hi era, respon 200 amb el mateix favorit', async () => {
    const primer = await desa(MARIA.auth, { puntId: MONTSEC });
    expect(primer.status).toBe(201);
    expect(primer.headers['cache-control']).toBe('no-store');
    expect(primer.body).toEqual({
      id: MONTSEC,
      nom: 'Observatori del Montsec',
      municipi: 'Àger',
      lat: 42.0244,
      lon: 0.7364,
      index: { valor: 82, franja: 'ras', deDia: false },
      dataCreacio: '2026-11-11T18:01:00.000Z',
    });
    // El perfil surt del JWT (via requireUser), no de la petició.
    expect(repo.add).toHaveBeenCalledWith(MARIA.perfil, MONTSEC, expect.any(Date));

    const segon = await desa(MARIA.auth, { puntId: MONTSEC });
    expect(segon.status).toBe(200);
    expect(segon.body).toEqual(primer.body);
    expect(noms(await llista(MARIA.auth))).toEqual(['Observatori del Montsec']);
  });

  it.each([
    ['un punt retirat', RETIRAT],
    ['un punt que no existeix', NO_EXISTEIX],
  ])('amb %s respon 404 punt_not_found', async (_cas, puntId) => {
    const res = await desa(MARIA.auth, { puntId });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('punt_not_found');
    expect((await llista(MARIA.auth)).body).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['un puntId que no és un UUID', { puntId: 'montsec' }],
    ['un perfilId (l’usuari només surt del JWT)', { puntId: MONTSEC, perfilId: PERE.perfil }],
    ['sense puntId', {}],
    ['un cos buit', undefined],
  ])('amb %s respon 400 validation_error', async (_cas, body) => {
    const res = await desa(MARIA.auth, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repo.add).not.toHaveBeenCalled();
  });

  it("respon 404 profile_not_found si l'usuari no ha fet POST /perfil", async () => {
    const res = await desa(SENSE_PERFIL, { puntId: MONTSEC });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
    expect(repo.add).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/favorits', () => {
  it("només torna els favorits de l'usuari del JWT, els més nous primer", async () => {
    await desa(MARIA.auth, { puntId: MONTSEC });
    await desa(PERE.auth, { puntId: PRADES });
    await desa(MARIA.auth, { puntId: PRADES });

    const maria = await llista(MARIA.auth);
    expect(maria.status).toBe(200);
    expect(maria.headers['cache-control']).toBe('no-store');
    expect(noms(maria)).toEqual(['Prades', 'Observatori del Montsec']);
    expect(noms(await llista(PERE.auth))).toEqual(['Prades']);
    expect(repo.list).toHaveBeenCalledWith(MARIA.perfil, expect.any(Date));
  });

  it('un punt retirat desapareix de la llista i hi torna si es torna a publicar', async () => {
    await desa(MARIA.auth, { puntId: MONTSEC });
    await desa(MARIA.auth, { puntId: PRADES });

    retirats.add(MONTSEC);
    expect(noms(await llista(MARIA.auth))).toEqual(['Prades']);

    retirats.delete(MONTSEC);
    expect(noms(await llista(MARIA.auth))).toEqual(['Prades', 'Observatori del Montsec']);
  });

  it('torna una llista buida si no en té cap', async () => {
    const res = await llista(MARIA.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("respon 404 profile_not_found si l'usuari no té perfil", async () => {
    const res = await llista(SENSE_PERFIL);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
  });
});

describe('DELETE /api/v1/favorits/{puntId}', () => {
  it('treu el punt dels favorits (204) sense tocar els dels altres usuaris', async () => {
    await desa(MARIA.auth, { puntId: MONTSEC });
    await desa(MARIA.auth, { puntId: PRADES });
    await desa(PERE.auth, { puntId: MONTSEC });

    const res = await treu(MARIA.auth, MONTSEC);
    expect(res.status).toBe(204);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toBe('');
    expect(repo.remove).toHaveBeenCalledWith(MARIA.perfil, MONTSEC);

    expect(noms(await llista(MARIA.auth))).toEqual(['Prades']);
    expect(noms(await llista(PERE.auth))).toEqual(['Observatori del Montsec']);
  });

  it('és idempotent: si el punt no hi era, o no existeix, també respon 204', async () => {
    expect((await treu(MARIA.auth, MONTSEC)).status).toBe(204);
    expect((await treu(MARIA.auth, NO_EXISTEIX)).status).toBe(204);
  });

  it('respon 400 validation_error si puntId no és un UUID', async () => {
    const res = await treu(MARIA.auth, 'montsec');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("respon 404 profile_not_found si l'usuari no té perfil", async () => {
    const res = await treu(SENSE_PERFIL, MONTSEC);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
  });
});

describe('/api/v1/favorits sense un usuari vàlid', () => {
  /** Les tres rutes, amb el token que se li passi (o sense `Authorization`). */
  const ambToken = (test: request.Test, token?: string) =>
    token ? test.set('Authorization', `Bearer ${token}`) : test;
  const peticions = [
    [
      'POST',
      (token?: string) =>
        ambToken(request(app).post('/api/v1/favorits'), token).send({ puntId: MONTSEC }),
    ],
    ['GET', (token?: string) => ambToken(request(app).get('/api/v1/favorits'), token)],
    [
      'DELETE',
      (token?: string) => ambToken(request(app).delete(`/api/v1/favorits/${MONTSEC}`), token),
    ],
  ] as const;

  it.each(peticions)('%s sense Authorization respon 401', async (_metode, peticio) => {
    const res = await peticio();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it.each(peticions)(
    '%s amb un token caducat o d’una altra clau respon 401',
    async (_m, peticio) => {
      const altra = (await generateKeyPair('ES256')).privateKey;
      for (const token of [
        await tokenFor(MARIA.auth, privateKey, Math.floor(Date.now() / 1000) - 60),
        await tokenFor(MARIA.auth, altra),
      ]) {
        expect((await peticio(token)).status).toBe(401);
      }
    },
  );

  it.each(peticions)(
    '%s amb un compte bloquejat respon 403 account_blocked',
    async (_m, peticio) => {
      bloquejats.add(MARIA.auth);
      const res = await peticio(await tokenFor(MARIA.auth));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('account_blocked');
      expect(repo.add).not.toHaveBeenCalled();
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    },
  );
});

describe('/api/v1/favorits sense DATABASE_URL', () => {
  it.each(['post', 'get', 'delete'] as const)(
    'amb un JWT vàlid, %s respon 503 database_unavailable',
    async (method) => {
      const path = method === 'delete' ? `/api/v1/favorits/${MONTSEC}` : '/api/v1/favorits';
      const res = await request(createApp({ supabaseUrl, jwks }))
        [method](path)
        .set('Authorization', `Bearer ${await tokenFor(MARIA.auth)}`)
        .send({ puntId: MONTSEC });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('database_unavailable');
    },
  );

  it('amb perfils però sense el servei de favorits, també 503', async () => {
    const res = await request(createApp({ supabaseUrl, jwks, profileStore }))
      .get('/api/v1/favorits')
      .set('Authorization', `Bearer ${await tokenFor(MARIA.auth)}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });

  it('sense JWT continua sent un 401: el token es mira abans que la base de dades', async () => {
    const res = await request(createApp({ supabaseUrl, jwks })).get('/api/v1/favorits');
    expect(res.status).toBe(401);
  });
});

describe('/favorits a l’OpenAPI', () => {
  it('documenta POST, GET i DELETE amb els esquemes Favorit i FavoritNou', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { post, get } = res.body.paths['/favorits'];
    const { delete: del } = res.body.paths['/favorits/{puntId}'];

    for (const operacio of [post, get, del]) {
      expect(operacio.tags).toEqual(['Favorits']);
      expect(operacio.security).toEqual([{ BearerSupabase: [] }]);
      expect(operacio.responses['403'].description).toContain('account_blocked');
    }
    expect(Object.keys(post.responses).sort()).toEqual([
      '200',
      '201',
      '400',
      '401',
      '403',
      '404',
      '503',
    ]);
    expect(Object.keys(get.responses).sort()).toEqual(['200', '401', '403', '404', '503']);
    expect(Object.keys(del.responses).sort()).toEqual(['204', '400', '401', '403', '404', '503']);

    expect(post.requestBody.required).toBe(true);
    expect(post.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/FavoritNou',
    );
    expect(post.responses['201'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/Favorit',
    );
    expect(get.responses['200'].content['application/json'].schema.items.$ref).toBe(
      '#/components/schemas/Favorit',
    );
    expect(del.parameters[0]).toMatchObject({ name: 'puntId', in: 'path', required: true });

    const { Favorit: favorit, FavoritNou: nou } = res.body.components.schemas;
    expect(nou).toMatchObject({ required: ['puntId'], additionalProperties: false });
    expect(nou.properties.puntId).toMatchObject({ type: 'string', format: 'uuid' });
    expect(Object.keys(favorit.properties)).toEqual([
      'id',
      'nom',
      'municipi',
      'lat',
      'lon',
      'index',
      'dataCreacio',
    ]);
    expect(favorit.properties.index.nullable).toBe(true);
  });
});

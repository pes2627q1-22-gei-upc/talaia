import type { Pla, PlaNou } from '@talaia/shared';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';
import { defaultNight, nightWindow } from '../index/night';
import {
  MAX_PLANS_FUTURS,
  type PlaAmbTextos,
  type PlansRepository,
} from '../plans/plansRepository';
import { createPlansService } from '../plans/plansService';
import type { ProfileStore } from '../services/profileService';

/**
 * `POST` i `GET /api/v1/plans` i `GET /api/v1/plans/{id}` (HU12, TG-156) amb JWT locals, perfils en
 * memòria i un repositori en memòria que, com la base de dades, filtra pel perfil. L'SQL del
 * repositori (el `where perfil_id`) es prova a `plansRepository.test.ts`.
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

const MARIA = { auth: 'maria-auth', perfil: '5e2d7c41-8b3a-4f6e-9d1c-0a2b3c4d5e6f' };
const PERE = { auth: 'pere-auth', perfil: '0b9f6a52-3c1d-4e8f-9a7b-2d5c6e7f8a90' };
const SENSE_PERFIL = 'sense-perfil-auth';

const MONTSEC = '6f1c2b7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const PRADES = '7a2d3c8f-2b3c-4d4e-9f0a-1b2c3d4e5f60';
const NO_EXISTEIX = '9c4f5ea1-4d5e-4f60-b12c-3d4e5f607182';
const LEONIDES = 'leonides-2026';

/** Les 12:00 UTC del 16/11: el que separa els plans futurs dels passats. */
const ARA = new Date('2026-11-16T12:00:00.000Z');

const PUNTS: Record<string, { nom: string; municipi: string; textos?: unknown }> = {
  [MONTSEC]: {
    nom: 'Observatori del Montsec',
    municipi: 'Àger',
    textos: { ca: { nom: 'Observatori del Montsec' }, es: { nom: 'Observatorio del Montsec' } },
  },
  [PRADES]: { nom: 'Prades', municipi: 'Prades' },
};
let retirats: Set<string>;

let bloquejats: Set<string>;
const profileStore = {
  getAccountStatus: async (authUserId: string) => {
    const perfil = [MARIA, PERE].find((u) => u.auth === authUserId);
    return perfil
      ? { perfilId: perfil.perfil, rol: 'usuari' as const, bloquejat: bloquejats.has(perfil.auth) }
      : null;
  },
} as ProfileStore;

/** Com la taula: cada pla és d'un perfil i només es llegeix amb aquest perfil. */
function memoryRepository() {
  const files: { perfilId: string; pla: Omit<PlaAmbTextos, 'punt'> & { puntId: string } }[] = [];
  let seguent = 1;
  /** Com `fiEfectiu`: sense `dataHoraFi`, el pla dura fins al final de la nit de l'inici. */
  const fi = (p: (typeof files)[number]['pla']) =>
    p.dataHoraFi
      ? Date.parse(p.dataHoraFi)
      : +nightWindow(defaultNight(new Date(p.dataHoraInici))).to;
  const ambPunt = ({ puntId, ...pla }: (typeof files)[number]['pla']): PlaAmbTextos => ({
    ...pla,
    punt: { id: puntId, ...PUNTS[puntId]!, publicat: !retirats.has(puntId) },
  });
  const repo: jest.Mocked<PlansRepository> = {
    create: jest.fn(async (perfilId: string, nou: PlaNou, ara: Date) => {
      if (!PUNTS[nou.puntId] || retirats.has(nou.puntId)) {
        return { ok: false, reason: 'punt_not_found' } as const;
      }
      if (nou.esdevenimentId && nou.esdevenimentId !== LEONIDES) {
        return { ok: false, reason: 'event_not_found' } as const;
      }
      const delPerfil = files.filter((f) => f.perfilId === perfilId).map((f) => f.pla);
      if (delPerfil.filter((p) => fi(p) >= +ara).length >= MAX_PLANS_FUTURS) {
        return { ok: false, reason: 'limit' } as const;
      }
      const inici = new Date(nou.dataHoraInici).toISOString();
      if (delPerfil.some((p) => p.puntId === nou.puntId && p.dataHoraInici === inici)) {
        return { ok: false, reason: 'duplicate' } as const;
      }
      const pla = {
        id: `00000000-0000-4000-8000-${String(seguent++).padStart(12, '0')}`,
        puntId: nou.puntId,
        esdevenimentId: nou.esdevenimentId ?? null,
        dataHoraInici: new Date(nou.dataHoraInici).toISOString(),
        dataHoraFi: nou.dataHoraFi ? new Date(nou.dataHoraFi).toISOString() : null,
        calendariEventId: nou.calendariEventId ?? null,
        notes: nou.notes ?? null,
        dataCreacio: '2026-11-16T10:00:00.000Z',
        dataActualitzacio: '2026-11-16T10:00:00.000Z',
      };
      files.push({ perfilId, pla });
      return { ok: true, pla: ambPunt(pla) } as const;
    }),
    list: jest.fn(async (perfilId: string, quan, ara: Date) => {
      return files
        .filter((f) => f.perfilId === perfilId)
        .map((f) => f.pla)
        .filter((p) => !quan || (quan === 'futurs' ? fi(p) >= +ara : fi(p) < +ara))
        .sort(
          (a, b) => (quan === 'passats' ? -1 : 1) * a.dataHoraInici.localeCompare(b.dataHoraInici),
        )
        .map(ambPunt);
    }),
    findById: jest.fn(async (perfilId: string, id: string) => {
      const fila = files.find((f) => f.perfilId === perfilId && f.pla.id === id);
      return fila && ambPunt(fila.pla);
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
  retirats = new Set();
  repo = memoryRepository();
  app = createApp({
    supabaseUrl,
    jwks,
    profileStore,
    plans: createPlansService(repo, { now: () => ARA }),
  });
});

const tokenFor = (sub: string, key: CryptoKey = privateKey, exp: string | number = '1h') =>
  new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime(exp)
    .sign(key);

const crea = async (com: string, body: unknown, acceptLanguage?: string) => {
  const req = request(app)
    .post('/api/v1/plans')
    .set('Authorization', `Bearer ${await tokenFor(com)}`);
  return (acceptLanguage ? req.set('Accept-Language', acceptLanguage) : req).send(body as object);
};

const llista = async (com: string, query = '') =>
  request(app)
    .get(`/api/v1/plans${query}`)
    .set('Authorization', `Bearer ${await tokenFor(com)}`);

const llegeix = async (com: string, id: string) =>
  request(app)
    .get(`/api/v1/plans/${id}`)
    .set('Authorization', `Bearer ${await tokenFor(com)}`);

const inicis = (res: request.Response) => (res.body as Pla[]).map((p) => p.dataHoraInici);

const NOU: PlaNou = {
  puntId: MONTSEC,
  esdevenimentId: LEONIDES,
  dataHoraInici: '2026-11-17T22:00:00+01:00',
  dataHoraFi: '2026-11-18T02:00:00+01:00',
  notes: 'Portar el trípode',
};

describe('POST /api/v1/plans', () => {
  it('crea el pla (201) amb el mateix Pla que el GET, el punt inclòs i les dates en UTC', async () => {
    const res = await crea(MARIA.auth, NOU);
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      id: expect.any(String),
      punt: { id: MONTSEC, nom: 'Observatori del Montsec', municipi: 'Àger', publicat: true },
      esdevenimentId: LEONIDES,
      dataHoraInici: '2026-11-17T21:00:00.000Z',
      dataHoraFi: '2026-11-18T01:00:00.000Z',
      calendariEventId: null,
      notes: 'Portar el trípode',
      dataCreacio: '2026-11-16T10:00:00.000Z',
      dataActualitzacio: '2026-11-16T10:00:00.000Z',
    });
    // El perfil surt del JWT (via requireUser), no de la petició.
    expect(repo.create).toHaveBeenCalledWith(MARIA.perfil, NOU, ARA);
    expect((await llegeix(MARIA.auth, res.body.id)).body).toEqual(res.body);
  });

  it('només amb punt i data (sense fenomen): la resta, null', async () => {
    const res = await crea(MARIA.auth, { puntId: PRADES, dataHoraInici: '2026-11-20T21:00:00Z' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      esdevenimentId: null,
      dataHoraFi: null,
      calendariEventId: null,
      notes: null,
    });
  });

  it('accepta una data passada: ho controla l’app', async () => {
    const res = await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: '2020-01-01T21:00:00Z' });
    expect(res.status).toBe(201);
  });

  it('el nom del punt segueix Accept-Language', async () => {
    const res = await crea(MARIA.auth, NOU, 'es-ES,es;q=0.9');
    expect(res.headers.vary).toBe('Accept-Language');
    expect(res.body.punt.nom).toBe('Observatorio del Montsec');
    expect(res.body.punt).not.toHaveProperty('textos');
  });

  it.each([
    ['un punt que no existeix', { ...NOU, puntId: NO_EXISTEIX }, 'punt_not_found'],
    ['un punt retirat', { ...NOU, puntId: PRADES }, 'punt_not_found'],
    [
      'un esdeveniment que no existeix',
      { ...NOU, esdevenimentId: 'perseids-1900' },
      'event_not_found',
    ],
  ])('amb %s respon 422', async (_cas, body, code) => {
    retirats.add(PRADES);
    const res = await crea(MARIA.auth, body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(code);
    expect((await llista(MARIA.auth)).body).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['un puntId que no és un UUID', { ...NOU, puntId: 'montsec' }],
    ['sense dataHoraInici', { puntId: MONTSEC }],
    ['una data sense zona', { ...NOU, dataHoraInici: '2026-11-17T22:00:00' }],
    ['una data que no és ISO', { ...NOU, dataHoraInici: '17/11/2026 22:00' }],
    ['dataHoraFi igual que dataHoraInici', { ...NOU, dataHoraFi: NOU.dataHoraInici }],
    ['dataHoraFi abans de dataHoraInici', { ...NOU, dataHoraFi: '2026-11-17T20:00:00Z' }],
    ['un esdevenimentId mal format', { ...NOU, esdevenimentId: 'Leònides 2026' }],
    ['unes notes buides', { ...NOU, notes: '' }],
    ['un perfilId (l’usuari només surt del JWT)', { ...NOU, perfilId: PERE.perfil }],
    ['un cos buit', undefined],
  ])('amb %s respon 400 validation_error', async (_cas, body) => {
    const res = await crea(MARIA.auth, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repo.create).not.toHaveBeenCalled();
  });

  // Els límits de mida de `routes/plans.ts`: un valor al límit passa la validació i un caràcter
  // més és un 400.
  it.each<[string, Partial<PlaNou>]>([
    ['notes', { notes: 'x'.repeat(1000) }],
    ['calendariEventId', { calendariEventId: 'x'.repeat(255) }],
  ])('%s al límit de mida es desa sencer', async (camp, extra) => {
    const res = await crea(MARIA.auth, { ...NOU, ...extra });
    expect(res.status).toBe(201);
    expect(res.body[camp]).toBe(extra[camp as keyof PlaNou]);
  });

  it('un esdevenimentId de 200 caràcters passa la validació (i el repositori no el troba)', async () => {
    const res = await crea(MARIA.auth, { ...NOU, esdevenimentId: 'a'.repeat(200) });
    expect(repo.create).toHaveBeenCalled();
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('event_not_found');
  });

  it.each<[string, Partial<PlaNou>]>([
    ['notes', { notes: 'x'.repeat(1001) }],
    ['esdevenimentId', { esdevenimentId: 'a'.repeat(201) }],
    ['calendariEventId', { calendariEventId: 'x'.repeat(256) }],
  ])('%s un caràcter per sobre del límit respon 400 validation_error', async (_camp, extra) => {
    const res = await crea(MARIA.auth, { ...NOU, ...extra });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('el mateix punt a la mateixa hora (un doble toc) respon 409 plan_already_exists', async () => {
    expect((await crea(MARIA.auth, NOU)).status).toBe(201);
    const res = await crea(MARIA.auth, { ...NOU, dataHoraInici: '2026-11-17T21:00:00Z' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('plan_already_exists');
    expect((await llista(MARIA.auth)).body).toHaveLength(1);
    // Un altre usuari sí que el pot crear.
    expect((await crea(PERE.auth, NOU)).status).toBe(201);
  });

  it(`amb ${MAX_PLANS_FUTURS} plans pendents respon 409 plan_limit_reached; els passats no hi compten`, async () => {
    await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: '2026-11-01T21:00:00Z' });
    for (let dia = 1; dia <= MAX_PLANS_FUTURS; dia++) {
      const data = new Date(Date.UTC(2026, 11, dia, 21)).toISOString();
      expect((await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: data })).status).toBe(201);
    }
    const res = await crea(MARIA.auth, { puntId: PRADES, dataHoraInici: '2026-12-25T21:00:00Z' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('plan_limit_reached');
  });

  it("respon 404 profile_not_found si l'usuari no ha fet POST /perfil", async () => {
    const res = await crea(SENSE_PERFIL, NOU);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('profile_not_found');
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/plans', () => {
  /** Un d'ahir, un que s'està fent ara (fins a la nit) i un de demà, creats desordenats. */
  const creaTres = async (com: string) => {
    await crea(com, { puntId: MONTSEC, dataHoraInici: '2026-11-17T21:00:00Z' });
    await crea(com, { puntId: MONTSEC, dataHoraInici: '2026-11-15T21:00:00Z' });
    await crea(com, {
      puntId: PRADES,
      dataHoraInici: '2026-11-16T11:00:00Z',
      dataHoraFi: '2026-11-16T23:00:00Z',
    });
  };

  it("només torna els plans de l'usuari del JWT, per data", async () => {
    await creaTres(MARIA.auth);
    await crea(PERE.auth, { puntId: PRADES, dataHoraInici: '2026-11-19T21:00:00Z' });

    const maria = await llista(MARIA.auth);
    expect(maria.status).toBe(200);
    expect(maria.headers['cache-control']).toBe('no-store');
    expect(inicis(maria)).toEqual([
      '2026-11-15T21:00:00.000Z',
      '2026-11-16T11:00:00.000Z',
      '2026-11-17T21:00:00.000Z',
    ]);
    expect(inicis(await llista(PERE.auth))).toEqual(['2026-11-19T21:00:00.000Z']);
    expect(repo.list).toHaveBeenCalledWith(MARIA.perfil, undefined, ARA);
  });

  it('?quan=futurs: els que no s’han acabat (també el que s’està fent), del més proper', async () => {
    await creaTres(MARIA.auth);
    const res = await llista(MARIA.auth, '?quan=futurs');
    expect(inicis(res)).toEqual(['2026-11-16T11:00:00.000Z', '2026-11-17T21:00:00.000Z']);
    expect(repo.list).toHaveBeenCalledWith(MARIA.perfil, 'futurs', ARA);
  });

  it('sense dataHoraFi, un pla és futur fins al migdia de després de la seva nit', async () => {
    // A les 03:00 locals del 16: de la nit del 15, que s'ha acabat a les 12:00 (ARA són les 13:00).
    await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: '2026-11-16T02:00:00Z' });
    // A les 12:30 locals del 16: ja ha començat, però és de la nit del 16, que dura fins demà a migdia.
    await crea(MARIA.auth, { puntId: PRADES, dataHoraInici: '2026-11-16T11:30:00Z' });

    expect(inicis(await llista(MARIA.auth, '?quan=futurs'))).toEqual(['2026-11-16T11:30:00.000Z']);
    expect(inicis(await llista(MARIA.auth, '?quan=passats'))).toEqual(['2026-11-16T02:00:00.000Z']);
  });

  // Aquests límits passen pel repositori en memòria: proven el servei i el doble, no l'SQL. El
  // límit real (`fiEfectiu >= ara` i el migdia de després de la nit) el protegeixen els tests de
  // futurs i passats de `plans/__tests__/plansRepository.test.ts`.
  it.each([
    ['acaba just ara', 'futurs', '2026-11-16T12:00:00.000Z'],
    ['acaba 1 ms abans d’ara', 'passats', '2026-11-16T11:59:59.999Z'],
    ['acaba d’aquí a 1 s', 'futurs', '2026-11-16T12:00:01.000Z'],
  ])('un pla que %s és dels %s', async (_cas, quan, dataHoraFi) => {
    await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: '2026-11-16T09:00:00Z', dataHoraFi });
    expect((await llista(MARIA.auth, `?quan=${quan}`)).body).toMatchObject([{ dataHoraFi }]);
  });

  it.each([
    ['les 12:00 locals', 'futurs', new Date('2026-11-16T11:00:00.000Z')],
    ['1 ms després de les 12:00 locals', 'passats', new Date('2026-11-16T11:00:00.001Z')],
  ])('sense dataHoraFi, a %s de després de la nit, el pla és dels %s', async (_c, quan, ara) => {
    app = createApp({
      supabaseUrl,
      jwks,
      profileStore,
      plans: createPlansService(repo, { now: () => ara }),
    });
    // Les 22:00 locals del 15: la nit del 15 s'acaba a les 12:00 locals del 16.
    await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: '2026-11-15T21:00:00Z' });
    expect(inicis(await llista(MARIA.auth, `?quan=${quan}`))).toEqual(['2026-11-15T21:00:00.000Z']);
  });

  it('?quan=passats: els acabats, del més recent al més antic', async () => {
    await creaTres(MARIA.auth);
    await crea(MARIA.auth, { puntId: MONTSEC, dataHoraInici: '2026-11-10T21:00:00Z' });
    const res = await llista(MARIA.auth, '?quan=passats');
    expect(inicis(res)).toEqual(['2026-11-15T21:00:00.000Z', '2026-11-10T21:00:00.000Z']);
  });

  it('el pla d’un punt retirat després de crear-lo continua sortint, amb publicat: false', async () => {
    await crea(MARIA.auth, { puntId: PRADES, dataHoraInici: '2026-11-20T21:00:00Z' });
    retirats.add(PRADES);
    const res = await llista(MARIA.auth);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].punt).toEqual({
      id: PRADES,
      nom: 'Prades',
      municipi: 'Prades',
      publicat: false,
    });
  });

  it('respon 400 validation_error si quan no és futurs ni passats', async () => {
    const res = await llista(MARIA.auth, '?quan=ahir');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repo.list).not.toHaveBeenCalled();
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

describe('GET /api/v1/plans/{id}', () => {
  it('torna el pla de l’usuari', async () => {
    const { body: pla } = await crea(MARIA.auth, NOU);
    const res = await llegeix(MARIA.auth, pla.id);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual(pla);
    expect(repo.findById).toHaveBeenCalledWith(MARIA.perfil, pla.id);
  });

  it('el pla d’un altre usuari respon 404 plan_not_found, igual que un que no existeix', async () => {
    const { body: pla } = await crea(MARIA.auth, NOU);

    const dePere = await llegeix(PERE.auth, pla.id);
    const noExisteix = await llegeix(PERE.auth, NO_EXISTEIX);
    expect(dePere.status).toBe(404);
    expect(dePere.body).toEqual(noExisteix.body);
    expect(dePere.body.error.code).toBe('plan_not_found');
    expect(repo.findById).toHaveBeenCalledWith(PERE.perfil, pla.id);
  });

  it('el pla d’un punt retirat després de crear-lo respon 200 amb publicat: false', async () => {
    const { body: pla } = await crea(MARIA.auth, NOU);
    retirats.add(MONTSEC);
    const res = await llegeix(MARIA.auth, pla.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...pla, punt: { ...pla.punt, publicat: false } });
  });

  it('respon 400 validation_error si l’id no és un UUID', async () => {
    const res = await llegeix(MARIA.auth, 'el-meu-pla');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(repo.findById).not.toHaveBeenCalled();
  });
});

describe('/api/v1/plans sense un usuari vàlid', () => {
  const ambToken = (test: request.Test, token?: string) =>
    token ? test.set('Authorization', `Bearer ${token}`) : test;
  const peticions = [
    ['POST', (token?: string) => ambToken(request(app).post('/api/v1/plans'), token).send(NOU)],
    ['GET', (token?: string) => ambToken(request(app).get('/api/v1/plans'), token)],
    [
      'GET {id}',
      (token?: string) => ambToken(request(app).get(`/api/v1/plans/${NO_EXISTEIX}`), token),
    ],
  ] as const;

  it.each(peticions)('%s sense Authorization respon 401', async (_metode, peticio) => {
    const res = await peticio();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it.each(peticions)('%s amb un token d’una altra clau respon 401', async (_m, peticio) => {
    const altra = (await generateKeyPair('ES256')).privateKey;
    expect((await peticio(await tokenFor(MARIA.auth, altra))).status).toBe(401);
  });

  it.each(peticions)(
    '%s amb un compte bloquejat respon 403 account_blocked',
    async (_m, peticio) => {
      bloquejats.add(MARIA.auth);
      const res = await peticio(await tokenFor(MARIA.auth));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('account_blocked');
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.findById).not.toHaveBeenCalled();
    },
  );
});

describe('/api/v1/plans sense DATABASE_URL', () => {
  it.each([
    ['post', '/api/v1/plans'],
    ['get', '/api/v1/plans'],
    ['get', `/api/v1/plans/${NO_EXISTEIX}`],
  ] as const)('amb un JWT vàlid, %s %s respon 503 database_unavailable', async (method, path) => {
    const res = await request(createApp({ supabaseUrl, jwks, profileStore }))
      [method](path)
      .set('Authorization', `Bearer ${await tokenFor(MARIA.auth)}`)
      .send(NOU);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });
});

describe('/plans a l’OpenAPI', () => {
  it('documenta POST, GET i GET {id} amb els esquemes Pla i PlaNou', async () => {
    const res = await request(createApp()).get('/api/v1/openapi.json');
    const { post, get } = res.body.paths['/plans'];
    const { get: getId } = res.body.paths['/plans/{id}'];

    for (const operacio of [post, get, getId]) {
      expect(operacio.tags).toEqual(['Plans']);
      expect(operacio.security).toEqual([{ BearerSupabase: [] }]);
      expect(operacio.responses['403'].description).toContain('account_blocked');
    }
    expect(Object.keys(post.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
      '404',
      '409',
      '422',
      '503',
    ]);
    expect(post.responses['409'].description).toContain('plan_limit_reached');
    expect(post.responses['409'].description).toContain('plan_already_exists');
    expect(get.parameters.map((p: { name: string }) => p.name)).toContain('quan');
    expect(getId.responses['404'].description).toContain('plan_not_found');
    expect(res.body.components.schemas).toHaveProperty('Pla');
    expect(res.body.components.schemas).toHaveProperty('PlaNou');
  });
});

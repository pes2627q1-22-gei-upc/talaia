import type { PuntAdmin, PuntAdminCanvis } from '@talaia/shared';
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';
import { SLUG_PUNT_REFERENCIA } from '../esdeveniments/esdevenimentsRepository';
import type { PuntsAdminRepository } from '../punts/puntsAdminRepository';
import { createPuntsAdminService } from '../punts/puntsAdminService';
import type { PuntsRepository } from '../punts/puntsRepository';
import { createDefaultPuntsService } from '../punts/puntsService';
import type { AccountStatus, ProfileStore } from '../services/profileService';

/**
 * HU39 (TG-174): `/admin/punts` per crear, editar i retirar punts. El catàleg viu en memòria i el
 * llegeixen alhora els repositoris de l'administració i del mapa, com la taula `punts_observacio`:
 * així es veu que un punt retirat deixa de sortir a `/punts` i `/punts/{id}` a la petició següent.
 */
const supabaseUrl = 'https://example.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;

const COMPTES: Record<string, AccountStatus> = {
  admin: { perfilId: '0b9f6a52-3c1d-4e8f-9a7b-2d5c6e7f8a90', rol: 'admin', bloquejat: false },
  maria: { perfilId: '5e2d7c41-8b3a-4f6e-9d1c-0a2b3c4d5e6f', rol: 'usuari', bloquejat: false },
  'admin-bloquejat': {
    perfilId: '3c4d5e6f-0a2b-4c1d-8e9f-6a7b8c9d0e1f',
    rol: 'admin',
    bloquejat: true,
  },
};

const unavailable = async (): Promise<never> => {
  throw new Error('aquests tests no fan servir el perfil');
};
const profileStore: ProfileStore = {
  ensureProfile: unavailable,
  getProfile: unavailable,
  updateProfile: unavailable,
  getAccountStatus: async (authUserId) => COMPTES[authUserId] ?? null,
  listProfiles: unavailable,
  setBlocked: unavailable,
};

const MONTSEC: PuntAdmin = {
  id: '7d3f2c1a-5b4e-4f6a-9c8d-1e2f3a4b5c6d',
  slug: 'mirador-del-montsec',
  nom: 'Mirador del Montsec',
  municipi: 'Àger',
  descripcio: 'Parc Astronòmic del Montsec.',
  altitud: 817,
  horitzoObert: ['SE', 'S', 'SW'],
  accessibilitat: "Accés en cotxe fins a l'equipament",
  sqm: 21.56,
  estat: 'PUBLICAT',
  origen: 'OFICIAL',
  dataCreacio: '2026-10-12T10:00:00.000Z',
  dataActualitzacio: '2026-10-12T10:00:00.000Z',
  lat: 42.0244,
  lon: 0.7364,
};
const NO_EXISTEIX = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let cataleg: Map<string, PuntAdmin>;

/** `punts_observacio` en memòria, vista des de l'administració. */
const adminRepository: PuntsAdminRepository = {
  list: async () => [...cataleg.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  find: async (id) => cataleg.get(id),
  async create({ estat, ...nou }) {
    if ([...cataleg.values()].some((p) => p.slug === nou.slug)) return undefined;
    const ara = new Date().toISOString();
    const punt: PuntAdmin = {
      altitud: null,
      horitzoObert: null,
      accessibilitat: null,
      sqm: null,
      ...nou,
      id: randomUUID(),
      estat,
      origen: 'OFICIAL',
      dataCreacio: ara,
      dataActualitzacio: ara,
    };
    cataleg.set(punt.id, punt);
    return punt;
  },
  async update(id, canvis: PuntAdminCanvis, comprova) {
    const punt = cataleg.get(id);
    if (!punt) return undefined;
    comprova?.(punt);
    const actualitzat = { ...punt, ...canvis, dataActualitzacio: new Date().toISOString() };
    cataleg.set(id, actualitzat);
    return actualitzat;
  },
};

/** La mateixa taula vista des del mapa i la fitxa: només els `PUBLICAT`, com les consultes reals. */
const puntsRepository: PuntsRepository = {
  listPublished: async () =>
    [...cataleg.values()]
      .filter((p) => p.estat === 'PUBLICAT')
      .map(({ id, nom, municipi, lat, lon }) => ({ id, nom, municipi, lat, lon, index: null })),
  indexVersion: async () => '2026-11-11T10:05:00.000Z',
  async findPublished(id) {
    const punt = cataleg.get(id);
    if (punt?.estat !== 'PUBLICAT') return undefined;
    const { nom, municipi, descripcio, altitud, horitzoObert, accessibilitat, sqm, lat, lon } =
      punt;
    return { id, nom, municipi, descripcio, altitud, horitzoObert, accessibilitat, sqm, lat, lon };
  },
  indexHores: async () => [],
};

let app: ReturnType<typeof createApp>;
let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const keyPair = await generateKeyPair('ES256');
  privateKey = keyPair.privateKey;
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keyPair.publicKey)), alg: 'ES256', kid: 'test-key' }],
  });
});

beforeEach(() => {
  cataleg = new Map([[MONTSEC.id, { ...MONTSEC }]]);
  // Com a `server.ts`: el servei d'administració descarta el document del mapa de `punts`.
  const punts = createDefaultPuntsService(puntsRepository);
  const puntsAdmin = createPuntsAdminService(adminRepository, { mapa: punts });
  app = createApp({ supabaseUrl, jwks, profileStore, punts, puntsAdmin });
});

const tokenFor = (sub: string) =>
  new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey);

const comAdmin = async (req: request.Test, com = 'admin') =>
  req.set('Authorization', `Bearer ${await tokenFor(com)}`);

const NOU = {
  slug: 'mirador-de-sant-joan',
  nom: 'Mirador de Sant Joan',
  municipi: 'Montgai',
  descripcio: 'Mirador al Pla d’Urgell, dins de la Destinació Starlight de Montgai.',
  lat: 41.7987,
  lon: 1.0809,
};

const idsAlMapa = async () => {
  const res = await request(app).get('/api/v1/punts');
  expect(res.status).toBe(200);
  return res.body.features.map((f: { properties: { id: string } }) => f.properties.id);
};

describe('/admin/punts: només per a administradors', () => {
  it.each([
    ['get', '/api/v1/admin/punts'],
    ['post', '/api/v1/admin/punts'],
    ['get', `/api/v1/admin/punts/${MONTSEC.id}`],
    ['patch', `/api/v1/admin/punts/${MONTSEC.id}`],
  ] as const)('%s %s: 401 sense token, 403 a un usuari i a un admin bloquejat', async (m, url) => {
    let res = await request(app)[m](url).send({ estat: 'DESACTIVAT' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');

    res = await comAdmin(request(app)[m](url).send({ estat: 'DESACTIVAT' }), 'maria');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');

    res = await comAdmin(request(app)[m](url).send({ estat: 'DESACTIVAT' }), 'admin-bloquejat');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');

    expect(cataleg.get(MONTSEC.id)?.estat).toBe('PUBLICAT');
  });

  it('sense DATABASE_URL, 503 database_unavailable (després de comprovar el rol)', async () => {
    const senseBd = createApp({ supabaseUrl, jwks, profileStore });
    const res = await comAdmin(request(senseBd).get('/api/v1/admin/punts'));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
  });
});

describe('GET /api/v1/admin/punts', () => {
  it('llista tots els punts, també els retirats, amb l’estat', async () => {
    cataleg.set(NO_EXISTEIX, {
      ...MONTSEC,
      id: NO_EXISTEIX,
      slug: 'a-retirat',
      estat: 'DESACTIVAT',
    });

    const res = await comAdmin(request(app).get('/api/v1/admin/punts'));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.map((p: PuntAdmin) => [p.slug, p.estat])).toEqual([
      ['a-retirat', 'DESACTIVAT'],
      [MONTSEC.slug, 'PUBLICAT'],
    ]);
    expect(res.body[1]).toEqual(MONTSEC);
  });
});

describe('GET /api/v1/admin/punts/{id}', () => {
  it('torna el punt en qualsevol estat, i 404 punt_not_found si no existeix', async () => {
    cataleg.get(MONTSEC.id)!.estat = 'DESACTIVAT';
    let res = await comAdmin(request(app).get(`/api/v1/admin/punts/${MONTSEC.id}`));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: MONTSEC.id, estat: 'DESACTIVAT' });

    res = await comAdmin(request(app).get(`/api/v1/admin/punts/${NO_EXISTEIX}`));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('punt_not_found');

    res = await comAdmin(request(app).get('/api/v1/admin/punts/montsec'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});

describe('POST /api/v1/admin/punts', () => {
  it('crea un punt OFICIAL i PUBLICAT, que surt al mapa a la petició següent', async () => {
    expect(await idsAlMapa()).toEqual([MONTSEC.id]); // el document ja és a la memòria cau

    const res = await comAdmin(request(app).post('/api/v1/admin/punts').send(NOU));

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.location).toBe(`/api/v1/admin/punts/${res.body.id}`);
    expect(res.body).toMatchObject({
      ...NOU,
      estat: 'PUBLICAT',
      origen: 'OFICIAL',
      altitud: null,
      horitzoObert: null,
      accessibilitat: null,
      sqm: null,
    });
    expect(await idsAlMapa()).toEqual([MONTSEC.id, res.body.id]);
    expect((await request(app).get(`/api/v1/punts/${res.body.id}`)).status).toBe(200);
  });

  it('amb estat DESACTIVAT, el crea retirat: no surt al mapa', async () => {
    const res = await comAdmin(
      request(app)
        .post('/api/v1/admin/punts')
        .send({ ...NOU, estat: 'DESACTIVAT', sqm: 21.3, altitud: 240, horitzoObert: ['N', 'S'] }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estat: 'DESACTIVAT', sqm: 21.3, altitud: 240 });
    expect(await idsAlMapa()).toEqual([MONTSEC.id]);
  });

  it('409 slug_already_exists si el slug ja és d’un altre punt', async () => {
    const res = await comAdmin(
      request(app)
        .post('/api/v1/admin/punts')
        .send({ ...NOU, slug: MONTSEC.slug }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('slug_already_exists');
    expect(cataleg.size).toBe(1);
  });

  it.each<[string, Record<string, unknown>]>([
    ['sense nom', { nom: undefined }],
    ['un nom en blanc', { nom: '   ' }],
    ['un slug amb majúscules', { slug: 'Mirador' }],
    ['un slug amb accents', { slug: 'mirador-de-sant-joan-d-àger' }],
    ['lat i lon intercanviades', { lat: NOU.lon, lon: NOU.lat }],
    ['un punt fora de Catalunya (Palma)', { lat: 39.5696, lon: 2.6502 }],
    ['una lat de text', { lat: '41.79' }],
    ['una altitud decimal', { altitud: 240.5 }],
    ['una altitud de més de 3.200 m', { altitud: 4000 }],
    ['una direcció que no existeix', { horitzoObert: ['NNE'] }],
    ['direccions repetides', { horitzoObert: ['N', 'N'] }],
    ['un horitzó obert buit (és null)', { horitzoObert: [] }],
    ['un sqm fora del rang de la taula', { sqm: 25 }],
    ['una accessibilitat buida (és null)', { accessibilitat: '' }],
    ['un estat de moderació', { estat: 'PENDENT' }],
    ["l'origen, que sempre és OFICIAL", { origen: 'COMUNITAT' }],
    ["el perfil d'horitzó", { horitzo: [1, 2, 3] }],
  ])('400 validation_error amb %s', async (_cas, canvi) => {
    const res = await comAdmin(
      request(app)
        .post('/api/v1/admin/punts')
        .send({ ...NOU, ...canvi }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(cataleg.size).toBe(1);
  });
});

describe('PATCH /api/v1/admin/punts/{id}', () => {
  const patch = (id: string, cos: unknown) =>
    comAdmin(
      request(app)
        .patch(`/api/v1/admin/punts/${id}`)
        .send(cos as object),
    );

  it('retirar un punt el treu del mapa i de la fitxa al moment, i es pot tornar a publicar', async () => {
    const mapa = await request(app).get('/api/v1/punts');
    expect(mapa.body.features).toHaveLength(1);

    let res = await patch(MONTSEC.id, { estat: 'DESACTIVAT' });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ id: MONTSEC.id, estat: 'DESACTIVAT', nom: MONTSEC.nom });

    // Sense esperar els 5 minuts de la memòria cau del mapa (ADR-0012).
    const retirat = await request(app).get('/api/v1/punts');
    expect(retirat.body.features).toEqual([]);
    expect(retirat.headers.etag).not.toBe(mapa.headers.etag);
    const fitxa = await request(app).get(`/api/v1/punts/${MONTSEC.id}`);
    expect(fitxa.status).toBe(404);
    expect(fitxa.body.error.code).toBe('punt_not_found');
    // No s'esborra: l'administració el continua veient.
    expect(cataleg.get(MONTSEC.id)?.estat).toBe('DESACTIVAT');

    res = await patch(MONTSEC.id, { estat: 'PUBLICAT' });
    expect(res.status).toBe(200);
    expect(await idsAlMapa()).toEqual([MONTSEC.id]);
  });

  it('edita només els camps que rep, i el mapa ja porta el nom nou', async () => {
    await idsAlMapa();
    const res = await patch(MONTSEC.id, { nom: 'Observatori del Montsec', accessibilitat: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nom: 'Observatori del Montsec',
      accessibilitat: null,
      municipi: MONTSEC.municipi,
      sqm: MONTSEC.sqm,
      estat: 'PUBLICAT',
    });
    const mapa = await request(app).get('/api/v1/punts');
    expect(mapa.body.features[0].properties.nom).toBe('Observatori del Montsec');
  });

  it('mou el punt si rep lat i lon junts', async () => {
    const res = await patch(MONTSEC.id, { lat: 42.03, lon: 0.74 });
    expect(res.status).toBe(200);
    const mapa = await request(app).get('/api/v1/punts');
    expect(mapa.body.features[0].geometry.coordinates).toEqual([0.74, 42.03]);
  });

  it('404 punt_not_found si no hi ha cap punt amb aquest id', async () => {
    const res = await patch(NO_EXISTEIX, { estat: 'DESACTIVAT' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('punt_not_found');
  });

  it("409 reference_point_required: el punt de referència d'Aprop no es pot retirar, però sí editar", async () => {
    const referencia = { ...MONTSEC, id: NO_EXISTEIX, slug: SLUG_PUNT_REFERENCIA };
    cataleg.set(referencia.id, referencia);

    let res = await patch(referencia.id, { estat: 'DESACTIVAT' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('reference_point_required');
    expect(cataleg.get(referencia.id)?.estat).toBe('PUBLICAT');

    res = await patch(referencia.id, { descripcio: 'Parc Astronòmic del Montsec, a Àger.' });
    expect(res.status).toBe(200);
  });

  it.each(['PENDENT', 'REBUTJAT'] as const)(
    "409 moderation_required: un punt %s no es publica ni es retira des d'aquí",
    async (estat) => {
      const proposat: PuntAdmin = {
        ...MONTSEC,
        id: NO_EXISTEIX,
        slug: 'mirador-proposat',
        estat,
        origen: 'COMUNITAT',
      };
      cataleg.set(proposat.id, proposat);

      for (const nou of ['PUBLICAT', 'DESACTIVAT']) {
        const res = await patch(proposat.id, { estat: nou });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('moderation_required');
      }
      expect(cataleg.get(proposat.id)?.estat).toBe(estat);
      expect(await idsAlMapa()).toEqual([MONTSEC.id]);

      // Sí que se'n poden corregir les dades.
      const res = await patch(proposat.id, { nom: 'Mirador proposat' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ nom: 'Mirador proposat', estat });
    },
  );

  it.each<[string, string, unknown]>([
    ['un id que no és un UUID', 'montsec', { estat: 'DESACTIVAT' }],
    ['un cos buit', MONTSEC.id, {}],
    ['lat sense lon', MONTSEC.id, { lat: 42.03 }],
    ["l'slug, que no es pot canviar", MONTSEC.id, { slug: 'montsec' }],
    ['un estat de moderació', MONTSEC.id, { estat: 'REBUTJAT' }],
    ['un nom buit', MONTSEC.id, { nom: '' }],
    ['un punt fora de Catalunya (Tolosa)', MONTSEC.id, { lat: 43.6045, lon: 1.444 }],
  ])('400 validation_error amb %s', async (_cas, id, cos) => {
    const res = await patch(id, cos);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(cataleg.get(MONTSEC.id)).toEqual(MONTSEC);
  });
});

describe('/admin/punts a l’OpenAPI', () => {
  it('documenta les quatre rutes, els esquemes i els errors', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    const llista = res.body.paths['/admin/punts'];
    const punt = res.body.paths['/admin/punts/{id}'];

    for (const op of [llista.get, llista.post, punt.get, punt.patch]) {
      expect(op.tags).toEqual(['Admin']);
      expect(op.security).toEqual([{ BearerSupabase: [] }]);
    }
    expect(Object.keys(llista.get.responses).sort()).toEqual(['200', '401', '403', '503']);
    expect(Object.keys(llista.post.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
      '409',
      '503',
    ]);
    expect(Object.keys(punt.patch.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
      '503',
    ]);
    expect(llista.post.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/PuntAdminNou',
    );
    expect(punt.patch.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/PuntAdminCanvis',
    );
    expect(punt.patch.description).toContain('DESACTIVAT');
    expect(punt.patch.responses['409'].description).toContain('moderation_required');
    expect(punt.patch.responses['409'].description).toContain('reference_point_required');

    const { PuntAdmin, PuntAdminNou, PuntAdminCanvis } = res.body.components.schemas;
    expect(PuntAdmin.properties.estat.enum).toEqual([
      'PENDENT',
      'PUBLICAT',
      'REBUTJAT',
      'DESACTIVAT',
    ]);
    expect(PuntAdminNou.required.sort()).toEqual(
      ['descripcio', 'lat', 'lon', 'municipi', 'nom', 'slug'].sort(),
    );
    expect(PuntAdminNou.properties.lat).toMatchObject({ minimum: 40.5, maximum: 42.9 });
    expect(PuntAdminCanvis.required).toBeUndefined();
    expect(PuntAdminCanvis.properties).not.toHaveProperty('slug');
  });
});

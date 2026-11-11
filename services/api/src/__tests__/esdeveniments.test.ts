import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import { createApp } from '../app';
import { iniciDiaCatala, intervalCatala } from '../esdeveniments/dates';
import {
  createEsdevenimentsRepository,
  type EsdevenimentsRepository,
  type FilaEsdeveniment,
} from '../esdeveniments/esdevenimentsRepository';
import { createEsdevenimentsService } from '../esdeveniments/esdevenimentsService';
import { TIPUS_FENOMEN } from '../esdeveniments/tipus';
import { EsdevenimentsQuerySchema } from '../routes/esdeveniments.contract';
import { fakeDb } from '../testing/fakeDb';

const PATH = '/api/v1/esdeveniments?des_de=2026-10-25&fins_a=2026-10-25';
const FILA: FilaEsdeveniment = {
  codi: 'lluna-plena-2026-10-26',
  tipus: 'fase_llunar',
  inici: new Date('2026-10-25T23:00:00Z'),
  fi: new Date('2026-10-26T23:00:00Z'),
  maxim: new Date('2026-10-26T12:00:00Z'),
  precisio: { inici: 'dia', maxim: 'dia', fi: 'dia' },
  textosFenomen: {
    ca: {
      nom: 'Lluna plena',
      descripcio: 'Disc lunar il·luminat.',
      consellGeneral: 'Mireu el cel.',
    },
  },
  textosEsdeveniment: {
    ca: { notaVisibilitat: 'Visible des de Catalunya.', consellObservacio: 'Observeu-la de nit.' },
  },
  organitzacio: null,
  metodeCalcul: 'Astronomy Engine 2.1.19',
};
const PUNT = { nom: "Centre d'Observació de l'Univers", latitud: 42.024603, longitud: 0.73684 };

function fakeRepository(overrides: Partial<EsdevenimentsRepository> = {}) {
  const repo: EsdevenimentsRepository & { rangs: Array<[Date, Date, string | undefined]> } = {
    rangs: [],
    async list(inici, fi, tipus) {
      repo.rangs.push([inici, fi, tipus]);
      return [FILA];
    },
    findPublicById: async (id) => (id === FILA.codi ? FILA : undefined),
    puntReferencia: async () => PUNT,
    ...overrides,
  };
  return repo;
}

const appWith = (
  repository: EsdevenimentsRepository = fakeRepository(),
  apropApiKey = 'clau-secreta',
) => createApp({ esdeveniments: createEsdevenimentsService(repository), apropApiKey });

describe('dies civils de Catalunya', () => {
  it('converteix bé les 00:00 dels canvis d’horari (23 i 25 hores)', () => {
    expect(intervalCatala('2026-03-29', '2026-03-29')).toEqual({
      inici: new Date('2026-03-28T23:00:00Z'),
      fi: new Date('2026-03-29T22:00:00Z'),
    });
    expect(intervalCatala('2026-10-25', '2026-10-25')).toEqual({
      inici: new Date('2026-10-24T22:00:00Z'),
      fi: new Date('2026-10-25T23:00:00Z'),
    });
    expect(iniciDiaCatala('2026-10-26')).toEqual(new Date('2026-10-25T23:00:00Z'));
    expect(Number.isFinite(intervalCatala('9999-12-31', '9999-12-31').fi.getTime())).toBe(true);
  });

  it('accepta l’offset històric de Madrid amb segons', () => {
    expect(iniciDiaCatala('1900-01-01')).toEqual(new Date('1900-01-01T00:14:44Z'));
  });
});

describe('GET /api/v1/esdeveniments/{id}', () => {
  const detailPath = `/api/v1/esdeveniments/${FILA.codi}`;

  it('troba un esdeveniment publicable pel seu codi i conserva els camps del calendari', async () => {
    const res = await request(appWith()).get(detailPath).set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: FILA.codi,
      nom: 'Lluna plena',
      maxim: FILA.maxim?.toISOString(),
      ubicacio: PUNT,
      horari: {
        inici: FILA.inici.toISOString(),
        maxim: FILA.maxim?.toISOString(),
        fi: FILA.fi.toISOString(),
        precisio: { inici: 'dia', maxim: 'dia', fi: 'dia' },
      },
      explicacio: {
        fenomen: 'Disc lunar il·luminat.',
        particularitat: 'Visible des de Catalunya.',
        observacioGeneral: 'Mireu el cel.',
        observacioEsdeveniment: 'Observeu-la de nit.',
      },
    });
  });

  it('no presenta el migdia marcador com una hora exacta del màxim', async () => {
    const res = await request(appWith()).get(detailPath).set('X-API-Key', 'clau-secreta');
    expect(res.body.horari.maxim).toBe('2026-10-26T12:00:00.000Z');
    expect(res.body.horari.precisio.maxim).toBe('dia');
  });

  it('tria el primer idioma disponible a Accept-Language i completa camps amb català', async () => {
    const repo = fakeRepository({
      findPublicById: async () => ({
        ...FILA,
        textosFenomen: {
          ca: {
            nom: 'Lluna plena',
            descripcio: 'Disc lunar il·luminat.',
            consellGeneral: 'Mireu el cel.',
          },
          es: { nom: 'Luna llena', descripcio: 'Disco lunar iluminado.' },
        },
        textosEsdeveniment: {
          ca: {
            notaVisibilitat: 'Visible des de Catalunya.',
            consellObservacio: 'Observeu-la de nit.',
          },
          es: {
            notaVisibilitat: 'Visible desde Cataluña.',
            consellObservacio: 'Obsérvela de noche.',
          },
        },
      }),
    });
    const res = await request(appWith(repo))
      .get(detailPath)
      .set('Accept-Language', 'es-ES,es;q=0.9,en;q=0.8')
      .set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nom: 'Luna llena',
      descripcio: 'Disco lunar iluminado. Visible desde Cataluña.',
      explicacio: {
        fenomen: 'Disco lunar iluminado.',
        particularitat: 'Visible desde Cataluña.',
        observacioGeneral: 'Mireu el cel.',
        observacioEsdeveniment: 'Obsérvela de noche.',
      },
    });
  });

  it('manté el català per defecte si no es demana un idioma', async () => {
    const res = await request(appWith()).get(detailPath).set('X-API-Key', 'clau-secreta');
    expect(res.body.nom).toBe('Lluna plena');
    expect(res.body.explicacio.fenomen).toBe('Disc lunar il·luminat.');
  });

  it('permet un màxim absent sense inventar-ne la precisió', async () => {
    const repo = fakeRepository({
      findPublicById: async () => ({
        ...FILA,
        maxim: null,
        precisio: { inici: 'dia', maxim: null, fi: 'dia' },
      }),
    });
    const res = await request(appWith(repo)).get(detailPath).set('X-API-Key', 'clau-secreta');
    expect(res.body.horari.maxim).toBeNull();
    expect(res.body.horari.precisio.maxim).toBeNull();
  });

  it('rebutja un detall sense consell o precisió fiables', async () => {
    const repo = fakeRepository({
      findPublicById: async () => ({
        ...FILA,
        precisio: { inici: 'dia', maxim: 'desconegut', fi: 'dia' },
      }),
    });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const res = await request(appWith(repo)).get(detailPath).set('X-API-Key', 'clau-secreta');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('invalid_event_data');
    } finally {
      spy.mockRestore();
    }
  });

  it('rebutja un detall sense consell específic', async () => {
    const repo = fakeRepository({
      findPublicById: async () => ({
        ...FILA,
        textosEsdeveniment: { ca: { notaVisibilitat: 'Visible des de Catalunya.' } },
      }),
    });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const res = await request(appWith(repo)).get(detailPath).set('X-API-Key', 'clau-secreta');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('invalid_event_data');
    } finally {
      spy.mockRestore();
    }
  });

  it('respon 404 si el codi no correspon a cap esdeveniment publicable', async () => {
    const res = await request(appWith())
      .get('/api/v1/esdeveniments/desconegut')
      .set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('event_not_found');
  });

  it('manté l’autenticació i informa si la base de dades no està disponible', async () => {
    expect((await request(appWith()).get(detailPath)).status).toBe(401);
    expect(
      (
        await request(createApp({ apropApiKey: 'clau-secreta' }))
          .get(detailPath)
          .set('X-API-Key', 'clau-secreta')
      ).status,
    ).toBe(503);
  });
});

describe('validació del període', () => {
  it('no afegeix errors d’interval quan una data no té format ISO o és impossible', () => {
    const format = EsdevenimentsQuerySchema.safeParse({ des_de: '2027-1-1', fins_a: '2027-01-02' });
    expect(format.success).toBe(false);
    if (!format.success)
      expect(format.error.issues.map((issue) => issue.path)).toEqual([['des_de']]);

    const impossible = EsdevenimentsQuerySchema.safeParse({
      des_de: '2027-02-30',
      fins_a: '2027-03-01',
    });
    expect(impossible.success).toBe(false);
    if (!impossible.success) {
      expect(impossible.error.issues.map((issue) => issue.path)).toEqual([['des_de']]);
    }
  });
});

describe('GET /api/v1/esdeveniments', () => {
  it('retorna una llista buida i consulta tots els tipus quan no hi ha filtre', async () => {
    const rebuts: Array<string | undefined> = [];
    const repo = fakeRepository({
      list: async (_inici, _fi, tipus) => {
        rebuts.push(tipus);
        return [];
      },
    });
    const res = await request(appWith(repo)).get(PATH).set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
    expect(rebuts).toEqual([undefined]);
  });

  it.each(TIPUS_FENOMEN)('accepta el tipus públic %s i el passa al repositori', async (tipus) => {
    const repo = fakeRepository({
      list: async (_inici, _fi, rebut) => {
        expect(rebut).toBe(tipus);
        return [];
      },
    });
    const res = await request(appWith(repo))
      .get('/api/v1/esdeveniments')
      .query({ des_de: '2026-10-25', fins_a: '2026-10-25', tipus })
      .set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });

  it('retorna els camps acordats en català, amb la ubicació oficial i la font del càlcul', async () => {
    const repo = fakeRepository();
    const res = await request(appWith(repo))
      .get('/api/v1/esdeveniments')
      .query({ des_de: '2026-10-26', fins_a: '2026-10-26', tipus: 'fase_llunar' })
      .set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(200);
    expect(repo.rangs).toEqual([
      [new Date('2026-10-25T23:00:00Z'), new Date('2026-10-26T23:00:00Z'), 'fase_llunar'],
    ]);
    expect(res.body).toEqual({
      data: [
        {
          id: FILA.codi,
          tipus: 'fase_llunar',
          nom: 'Lluna plena',
          inici: FILA.inici.toISOString(),
          fi: FILA.fi.toISOString(),
          maxim: FILA.maxim?.toISOString(),
          descripcio: 'Disc lunar il·luminat. Visible des de Catalunya.',
          ubicacio: PUNT,
          font: 'Astronomy Engine 2.1.19',
        },
      ],
    });
  });

  it('també exposa la font IMO/NASA i permet maxim null', async () => {
    const repo = fakeRepository({
      list: async () => [{ ...FILA, maxim: null, organitzacio: 'IMO', metodeCalcul: null }],
    });
    const res = await request(appWith(repo)).get(PATH).set('X-API-Key', 'clau-secreta');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ maxim: null, font: 'IMO' });
  });

  it('no barreja una nota de càlcul del Montseny amb les coordenades generals d’Àger', async () => {
    const repo = fakeRepository({
      list: async () => [
        {
          ...FILA,
          tipus: 'conjuncio',
          textosEsdeveniment: { ca: { notaVisibilitat: 'Separació mesurada des del Montseny.' } },
        },
      ],
    });
    const res = await request(appWith(repo)).get(PATH).set('X-API-Key', 'clau-secreta');
    expect(res.body.data[0]).toMatchObject({
      descripcio: 'Disc lunar il·luminat.',
      ubicacio: PUNT,
    });
  });

  it('retorna 401 sense clau o amb clau invàlida, i 400 per una query dolenta', async () => {
    expect((await request(appWith()).get(PATH)).status).toBe(401);
    expect((await request(appWith()).get(PATH).set('X-API-Key', 'incorrecta')).status).toBe(401);
    const invalid = await request(appWith())
      .get('/api/v1/esdeveniments?des_de=2026-10-26&fins_a=2026-10-25')
      .set('X-API-Key', 'clau-secreta');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
  });

  it('no deixa evitar un JWT invàlid amb una API key correcta', async () => {
    const res = await request(appWith())
      .get(PATH)
      .set('X-API-Key', 'clau-secreta')
      .set('Authorization', 'Bearer mal-format');
    expect(res.status).toBe(401);
  });

  it('respon 503 si es demana accés amb API key però el secret no està configurat', async () => {
    const res = await request(appWith(fakeRepository(), ''))
      .get(PATH)
      .set('X-API-Key', 'qualsevol');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('service_unavailable');
  });

  it('accepta el JWT de Supabase com a alternativa a la clau d’Aprop', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test-key', use: 'sig' };
    const issuer = 'https://example.supabase.co/auth/v1';
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject('user-123')
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(privateKey);
    const app = createApp({
      esdeveniments: createEsdevenimentsService(fakeRepository()),
      supabaseUrl: 'https://example.supabase.co',
      jwks: createLocalJWKSet({ keys: [jwk] }),
    });
    expect((await request(app).get(PATH).set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('respon 503 sense BD, si falla o si manca el punt oficial publicat', async () => {
    expect(
      (
        await request(createApp({ apropApiKey: 'clau-secreta' }))
          .get(PATH)
          .set('X-API-Key', 'clau-secreta')
      ).status,
    ).toBe(503);
    const missing = fakeRepository({ puntReferencia: async () => undefined });
    expect(
      (await request(appWith(missing)).get(PATH).set('X-API-Key', 'clau-secreta')).body.error.code,
    ).toBe('reference_point_unavailable');
    const failed = fakeRepository({
      list: async () => {
        throw new Error('BD caiguda');
      },
    });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const res = await request(appWith(failed)).get(PATH).set('X-API-Key', 'clau-secreta');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('database_unavailable');
    } finally {
      spy.mockRestore();
    }
  });

  it('registra el codi d’una fila incompleta i respon 500 sense dades parcials', async () => {
    const repo = fakeRepository({
      list: async () => [
        FILA,
        { ...FILA, codi: 'sense-descripcio', textosFenomen: { ca: { nom: 'Sense descripció' } } },
      ],
    });
    const spy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const res = await request(appWith(repo)).get(PATH).set('X-API-Key', 'clau-secreta');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('invalid_event_data');
      expect(res.body.data).toBeUndefined();
      expect(spy).toHaveBeenCalledWith('[esdeveniments] dades incompletes', 'sense-descripcio');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('consultes Kysely del calendari', () => {
  it('cerca el detall per ID amb els mateixos filtres de publicació que el llistat', async () => {
    const { db, queries } = fakeDb([]);
    await createEsdevenimentsRepository(db).findPublicById(FILA.codi);
    expect(queries[0]?.sql).toContain('"e"."codi" =');
    expect(queries[0]?.sql).toContain('"e"."rellevant_catalunya" =');
    expect(queries[0]?.sql).toContain('"f"."publicable_calendari" =');
    expect(queries[0]?.sql).toContain('"f"."tipus_codi" in');
    expect(queries[0]?.parameters).toEqual([true, true, ...TIPUS_FENOMEN, FILA.codi]);
  });
  it('llegeix les notes JSONB amb les claus camelCase que retorna CamelCasePlugin', async () => {
    const { db } = fakeDb([
      {
        codi: FILA.codi,
        tipus: 'fase_llunar',
        inici: FILA.inici,
        fi: FILA.fi,
        maxim: FILA.maxim,
        textos_fenomen: FILA.textosFenomen,
        textos_esdeveniment: { ca: { nota_visibilitat: 'Nota concreta.' } },
        organitzacio: null,
        metode_calcul: FILA.metodeCalcul,
      },
    ]);
    const files = await createEsdevenimentsRepository(db).list(FILA.inici, FILA.fi);
    expect(files[0]?.textosEsdeveniment).toEqual({ ca: { notaVisibilitat: 'Nota concreta.' } });
  });

  it('filtra solapament, visibilitat a Catalunya i tipus, amb ordre estable', async () => {
    const { db, queries } = fakeDb([]);
    await createEsdevenimentsRepository(db).list(
      new Date('2026-10-25T22:00:00Z'),
      new Date('2026-10-25T23:00:00Z'),
      'fase_llunar',
    );
    expect(queries[0]?.sql).toMatch(/"e"\."inici" < \$9/);
    expect(queries[0]?.sql).toMatch(/"e"\."fi" > \$10/);
    expect(queries[0]?.sql).toContain('"e"."rellevant_catalunya" =');
    expect(queries[0]?.sql).toContain('"f"."publicable_calendari" =');
    expect(queries[0]?.sql).toContain('"f"."tipus_codi" in');
    expect(queries[0]?.sql).toContain('"f"."tipus_codi" =');
    expect(queries[0]?.sql).toContain('order by "e"."inici", "e"."codi"');
    expect(queries[0]?.parameters).toEqual([
      true,
      true,
      ...TIPUS_FENOMEN,
      new Date('2026-10-25T23:00:00Z'),
      new Date('2026-10-25T22:00:00Z'),
      'fase_llunar',
    ]);
  });

  it('llegeix només el punt de referència oficial i publicat', async () => {
    const { db, queries } = fakeDb([]);
    await createEsdevenimentsRepository(db).puntReferencia();
    expect(queries[0]?.sql).toContain('"p"."slug" =');
    expect(queries[0]?.sql).toContain('"p"."origen" =');
    expect(queries[0]?.sql).toContain('"p"."estat" =');
    expect(queries[0]?.parameters).toEqual(['centre-observacio-univers', 'OFICIAL', 'PUBLICAT']);
  });
});

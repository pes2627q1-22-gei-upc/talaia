import { fakeDb } from '../../testing/fakeDb';
import { createDatabaseAlertesStore, MAX_ALERTES } from '../alertesRepository';

const PERFIL = 'perfil-1';

/** Una fila d'`alertes` tal com la retorna `pg`: snake_case, dates com a `Date`. */
const FILA = {
  id: 'alerta-1',
  objectiu: 'pluja_estels',
  lat: 41.3874,
  lon: 2.1686,
  distancia_max_km: 60,
  index_minim: 70,
  avisa_en_arribar: false,
  hora_avis: 18,
  activa: true,
  data_creacio: new Date('2026-11-10T18:00:00.000Z'),
  data_actualitzacio: new Date('2026-11-10T18:00:00.000Z'),
};

const ALERTA = {
  id: 'alerta-1',
  objectiu: 'pluja_estels',
  origen: { lat: 41.3874, lon: 2.1686 },
  distanciaMaxKm: 60,
  indexMinim: 70,
  avisaEnArribar: false,
  horaAvis: 18,
  activa: true,
  dataCreacio: '2026-11-10T18:00:00.000Z',
  dataActualitzacio: '2026-11-10T18:00:00.000Z',
};

const NOVA = {
  objectiu: 'pluja_estels',
  origen: { lat: 41.3874, lon: 2.1686 },
  distanciaMaxKm: 60,
  indexMinim: 70,
  avisaEnArribar: false,
  horaAvis: 18,
} as const;

describe('createDatabaseAlertesStore.create', () => {
  it('bloqueja el perfil, en compta les alertes i insereix la nova', async () => {
    // pg torna count(*) com a text.
    const { db, queries } = fakeDb([[{ id: PERFIL }], [{ total: '3' }], [FILA]]);

    await expect(createDatabaseAlertesStore(db).create(PERFIL, NOVA)).resolves.toEqual({
      ok: true,
      alerta: ALERTA,
    });

    expect(queries.map((q) => q.sql)).toEqual([
      'select "id" from "perfils" where "id" = $1 for update',
      'select count(*) as "total" from "alertes" where "perfil_id" = $1',
      'insert into "alertes" ("perfil_id", "objectiu", "origen", "distancia_max_km", "index_minim", ' +
        '"avisa_en_arribar", "hora_avis") ' +
        'values ($1, $2, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5, $6, $7, $8) ' +
        'returning "id", "objectiu", "distancia_max_km", "index_minim", "avisa_en_arribar", "hora_avis", ' +
        '"activa", "data_creacio", "data_actualitzacio", st_y("origen"::geometry) as "lat", ' +
        'st_x("origen"::geometry) as "lon"',
    ]);
    expect(queries[0]?.parameters).toEqual([PERFIL]);
    expect(queries[1]?.parameters).toEqual([PERFIL]);
    // L'ordre de st_makepoint és longitud, latitud.
    expect(queries[2]?.parameters).toEqual([
      PERFIL,
      'pluja_estels',
      2.1686,
      41.3874,
      60,
      70,
      false,
      18,
    ]);
  });

  it(`amb ${MAX_ALERTES} alertes no insereix res i torna el límit`, async () => {
    const { db, queries } = fakeDb([[{ id: PERFIL }], [{ total: String(MAX_ALERTES) }]]);

    await expect(createDatabaseAlertesStore(db).create(PERFIL, NOVA)).resolves.toEqual({
      ok: false,
      reason: 'limit',
    });
    expect(queries).toHaveLength(2);
  });
});

describe('createDatabaseAlertesStore.list', () => {
  it('només llegeix les alertes del perfil, de la més nova a la més antiga', async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createDatabaseAlertesStore(db).list(PERFIL)).resolves.toEqual([ALERTA]);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toMatch(
      /from "alertes" where "perfil_id" = \$1 order by "data_creacio" desc, "id"$/,
    );
    expect(queries[0]?.parameters).toEqual([PERFIL]);
  });

  it('torna una llista buida si el perfil no té alertes', async () => {
    const { db } = fakeDb([]);
    await expect(createDatabaseAlertesStore(db).list(PERFIL)).resolves.toEqual([]);
  });

  it('passa a número els valors que pg pugui tornar com a text', async () => {
    const { db } = fakeDb([{ ...FILA, lat: '41.3874', lon: '2.1686', hora_avis: '18' }]);
    const [alerta] = await createDatabaseAlertesStore(db).list(PERFIL);
    expect(alerta?.origen).toEqual({ lat: 41.3874, lon: 2.1686 });
    expect(alerta?.horaAvis).toBe(18);
  });

  it('manté horaAvis a null si només avisa en arribar-hi', async () => {
    const { db } = fakeDb([{ ...FILA, avisa_en_arribar: true, hora_avis: null }]);
    const [alerta] = await createDatabaseAlertesStore(db).list(PERFIL);
    expect(alerta).toMatchObject({ avisaEnArribar: true, horaAvis: null });
  });
});

describe('createDatabaseAlertesStore.update', () => {
  const ID = '00000000-0000-4000-8000-000000000001';

  it('bloqueja l’alerta del perfil, la mira i només canvia els camps donats', async () => {
    const { db, queries } = fakeDb([
      [{ avisa_en_arribar: false, hora_avis: 18 }],
      [{ ...FILA, activa: false }],
    ]);

    await expect(
      createDatabaseAlertesStore(db).update(PERFIL, ID, { activa: false, indexMinim: 80 }),
    ).resolves.toEqual({ ok: true, alerta: { ...ALERTA, activa: false } });

    expect(queries.map((q) => q.sql)).toEqual([
      'select "avisa_en_arribar", "hora_avis" from "alertes" where "id" = $1 and "perfil_id" = $2 for update',
      'update "alertes" set "activa" = $1, "index_minim" = $2 where "id" = $3 and "perfil_id" = $4 ' +
        'returning "id", "objectiu", "distancia_max_km", "index_minim", "avisa_en_arribar", "hora_avis", ' +
        '"activa", "data_creacio", "data_actualitzacio", st_y("origen"::geometry) as "lat", ' +
        'st_x("origen"::geometry) as "lon"',
    ]);
    expect(queries[0]?.parameters).toEqual([ID, PERFIL]);
    expect(queries[1]?.parameters).toEqual([false, 80, ID, PERFIL]);
  });

  it('desa l’origen com a punt (longitud, latitud)', async () => {
    const { db, queries } = fakeDb([[{ avisa_en_arribar: true, hora_avis: null }], [FILA]]);
    await createDatabaseAlertesStore(db).update(PERFIL, ID, { origen: { lat: 42.1, lon: 1.8 } });
    expect(queries[1]?.sql).toMatch(
      /^update "alertes" set "origen" = st_setsrid\(st_makepoint\(\$1, \$2\), 4326\)::geography where/,
    );
    expect(queries[1]?.parameters).toEqual([1.8, 42.1, ID, PERFIL]);
  });

  it('torna not_found sense actualitzar res si el perfil no té l’alerta', async () => {
    const { db, queries } = fakeDb([[]]);
    await expect(
      createDatabaseAlertesStore(db).update(PERFIL, ID, { activa: false }),
    ).resolves.toEqual({ ok: false, reason: 'not_found' });
    expect(queries).toHaveLength(1);
  });

  it.each([
    [
      'treu l’hora i no avisa en arribar-hi',
      { avisa_en_arribar: false, hora_avis: 18 },
      { horaAvis: null },
    ],
    [
      'deixa d’avisar en arribar-hi sense hora',
      { avisa_en_arribar: true, hora_avis: null },
      { avisaEnArribar: false },
    ],
  ])('torna quan_avisa si %s', async (_cas, actual, canvis) => {
    const { db, queries } = fakeDb([[actual]]);
    await expect(createDatabaseAlertesStore(db).update(PERFIL, ID, canvis)).resolves.toEqual({
      ok: false,
      reason: 'quan_avisa',
    });
    expect(queries).toHaveLength(1);
  });

  it('accepta canviar les dues maneres d’avisar alhora', async () => {
    const { db, queries } = fakeDb([[{ avisa_en_arribar: true, hora_avis: null }], [FILA]]);
    const result = await createDatabaseAlertesStore(db).update(PERFIL, ID, {
      avisaEnArribar: false,
      horaAvis: 18,
    });
    expect(result.ok).toBe(true);
    expect(queries).toHaveLength(2);
  });
});

describe('createDatabaseAlertesStore.remove', () => {
  const ID = '00000000-0000-4000-8000-000000000001';

  it('esborra només l’alerta del perfil i torna true', async () => {
    const { db, queries } = fakeDb([[{ id: ID }]]);
    await expect(createDatabaseAlertesStore(db).remove(PERFIL, ID)).resolves.toBe(true);
    expect(queries.map((q) => q.sql)).toEqual([
      'delete from "alertes" where "id" = $1 and "perfil_id" = $2 returning "id"',
    ]);
    expect(queries[0]?.parameters).toEqual([ID, PERFIL]);
  });

  it('torna false si el perfil no té l’alerta (no existeix o és d’un altre)', async () => {
    const { db } = fakeDb([[]]);
    await expect(createDatabaseAlertesStore(db).remove(PERFIL, ID)).resolves.toBe(false);
  });
});

import { fakeDb } from '../../testing/fakeDb';
import { createDatabaseAlertesStore } from '../alertesRepository';

const MARIA = 'f3c1b2a0-5d6e-4f70-8a9b-1c2d3e4f5a6b';
const PERFIL = { id: 'perfil-1' };

/** Una fila d'`alertes` tal com la retorna `pg`: snake_case, dates com a `Date`. */
const FILA = {
  id: 'alerta-1',
  objectiu: 'pluja_estels',
  lat: 41.3874,
  lon: 2.1686,
  distancia_max_km: 60,
  index_minim: 70,
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
  activa: true,
  dataCreacio: '2026-11-10T18:00:00.000Z',
  dataActualitzacio: '2026-11-10T18:00:00.000Z',
};

const NOVA = {
  objectiu: 'pluja_estels',
  origen: { lat: 41.3874, lon: 2.1686 },
  distanciaMaxKm: 60,
  indexMinim: 70,
} as const;

const SELECT_PERFIL = 'select "id" from "perfils" where "auth_user_id" = $1';

describe('createDatabaseAlertesStore.create', () => {
  it("busca el perfil de l'usuari del JWT i hi penja l'alerta", async () => {
    const { db, queries } = fakeDb([[PERFIL], [FILA]]);

    const alerta = await createDatabaseAlertesStore(db).create(MARIA, NOVA);

    expect(alerta).toEqual(ALERTA);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toBe(SELECT_PERFIL);
    expect(queries[0]?.parameters).toEqual([MARIA]);
    expect(queries[1]?.sql).toBe(
      'insert into "alertes" ("perfil_id", "objectiu", "origen", "distancia_max_km", "index_minim") ' +
        'values ($1, $2, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5, $6) ' +
        'returning "id", "objectiu", st_y("origen"::geometry) as "lat", st_x("origen"::geometry) as "lon", ' +
        '"distancia_max_km", "index_minim", "activa", "data_creacio", "data_actualitzacio"',
    );
    // L'ordre de st_makepoint és longitud, latitud.
    expect(queries[1]?.parameters).toEqual(['perfil-1', 'pluja_estels', 2.1686, 41.3874, 60, 70]);
  });

  it("torna null i no insereix res si l'usuari no té perfil", async () => {
    const { db, queries } = fakeDb([[]]);

    await expect(createDatabaseAlertesStore(db).create(MARIA, NOVA)).resolves.toBeNull();
    expect(queries).toHaveLength(1);
  });
});

describe('createDatabaseAlertesStore.list', () => {
  it("només llegeix les alertes del perfil de l'usuari, de la més nova a la més antiga", async () => {
    const { db, queries } = fakeDb([[PERFIL], [FILA]]);

    await expect(createDatabaseAlertesStore(db).list(MARIA)).resolves.toEqual([ALERTA]);

    expect(queries[0]?.sql).toBe(SELECT_PERFIL);
    expect(queries[1]?.sql).toMatch(
      /from "alertes" where "perfil_id" = \$1 order by "data_creacio" desc, "id"$/,
    );
    expect(queries[1]?.parameters).toEqual(['perfil-1']);
  });

  it("torna una llista buida si l'usuari té perfil però cap alerta", async () => {
    const { db } = fakeDb([[PERFIL], []]);
    await expect(createDatabaseAlertesStore(db).list(MARIA)).resolves.toEqual([]);
  });

  it("torna null si l'usuari no té perfil", async () => {
    const { db, queries } = fakeDb([[]]);
    await expect(createDatabaseAlertesStore(db).list(MARIA)).resolves.toBeNull();
    expect(queries).toHaveLength(1);
  });

  it('passa a número els valors que pg pugui tornar com a text', async () => {
    const { db } = fakeDb([[PERFIL], [{ ...FILA, lat: '41.3874', lon: '2.1686' }]]);
    const [alerta] = (await createDatabaseAlertesStore(db).list(MARIA)) ?? [];
    expect(alerta?.origen).toEqual({ lat: 41.3874, lon: 2.1686 });
  });
});

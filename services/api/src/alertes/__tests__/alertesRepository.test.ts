import { fakeDb } from '../../testing/fakeDb';
import { createDatabaseAlertesStore } from '../alertesRepository';

const PERFIL = 'perfil-1';

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

describe('createDatabaseAlertesStore.create', () => {
  it('insereix l’alerta al perfil', async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createDatabaseAlertesStore(db).create(PERFIL, NOVA)).resolves.toEqual(ALERTA);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'insert into "alertes" ("perfil_id", "objectiu", "origen", "distancia_max_km", "index_minim") ' +
        'values ($1, $2, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5, $6) ' +
        'returning "id", "objectiu", st_y("origen"::geometry) as "lat", st_x("origen"::geometry) as "lon", ' +
        '"distancia_max_km", "index_minim", "activa", "data_creacio", "data_actualitzacio"',
    );
    // L'ordre de st_makepoint és longitud, latitud.
    expect(queries[0]?.parameters).toEqual([PERFIL, 'pluja_estels', 2.1686, 41.3874, 60, 70]);
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
    const { db } = fakeDb([{ ...FILA, lat: '41.3874', lon: '2.1686' }]);
    const [alerta] = await createDatabaseAlertesStore(db).list(PERFIL);
    expect(alerta?.origen).toEqual({ lat: 41.3874, lon: 2.1686 });
  });
});

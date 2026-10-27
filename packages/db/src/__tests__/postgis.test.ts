import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
  type RawBuilder,
} from 'kysely';
import { createDb } from '../createDb';
import { dinsBbox, dinsRadi, distancia, lat, lon, puntDesDeLonLat } from '../postgis';

// Compila sense connectar-se enlloc: només comprova l'SQL i els paràmetres.
const db = new Kysely<unknown>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (k) => new PostgresIntrospector(k),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

const ubicacio = sql.ref<string>('ubicacio');
const compila = (e: RawBuilder<unknown>) => db.selectNoFrom(e.as('v')).compile();

describe('postgis', () => {
  it('puntDesDeLonLat posa la longitud primer i passa els valors com a paràmetres', () => {
    const q = compila(puntDesDeLonLat(3.3167, 42.3194));
    expect(q.sql).toBe('select st_setsrid(st_makepoint($1, $2), 4326)::geography as "v"');
    expect(q.parameters).toEqual([3.3167, 42.3194]);
  });

  it('lon i lat llegeixen la x i la y de la columna', () => {
    expect(compila(lon(ubicacio)).sql).toBe('select st_x("ubicacio"::geometry) as "v"');
    expect(compila(lat(ubicacio)).sql).toBe('select st_y("ubicacio"::geometry) as "v"');
  });

  it("dinsBbox compara com a geometry, amb l'ordre minLon, minLat, maxLon, maxLat", () => {
    const q = compila(
      dinsBbox(ubicacio, { minLon: 0.15, minLat: 40.5, maxLon: 3.35, maxLat: 42.9 }),
    );
    expect(q.sql).toBe(
      'select "ubicacio"::geometry && st_makeenvelope($1, $2, $3, $4, 4326) as "v"',
    );
    expect(q.parameters).toEqual([0.15, 40.5, 3.35, 42.9]);
  });

  it('distancia accepta una columna i un punt', () => {
    const q = compila(distancia(ubicacio, puntDesDeLonLat(2.17, 41.38)));
    expect(q.sql).toBe(
      'select st_distance("ubicacio", st_setsrid(st_makepoint($1, $2), 4326)::geography) as "v"',
    );
    expect(q.parameters).toEqual([2.17, 41.38]);
  });

  it('dinsRadi compara en metres amb st_dwithin sobre geography', () => {
    const q = compila(dinsRadi(ubicacio, puntDesDeLonLat(2.17, 41.38), 50_000));
    expect(q.sql).toBe(
      'select st_dwithin("ubicacio", st_setsrid(st_makepoint($1, $2), 4326)::geography, $3) as "v"',
    );
    expect(q.parameters).toEqual([2.17, 41.38, 50_000]);
  });
});

describe('createDb', () => {
  it('tradueix camelCase a snake_case sense connectar-se', async () => {
    const real = createDb('postgresql://postgres:postgres@127.0.0.1:1/postgres', { max: 1 });
    const q = real
      .selectFrom('puntsObservacio')
      .select(['slug', 'dataCreacio', lon(sql.ref('ubicacio')).as('lon')])
      .where('horitzoObert', 'is not', null)
      .compile();
    expect(q.sql).toBe(
      'select "slug", "data_creacio", st_x("ubicacio"::geometry) as "lon" from "punts_observacio" where "horitzo_obert" is not null',
    );
    await real.destroy();
  });
});

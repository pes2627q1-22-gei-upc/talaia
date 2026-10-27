import type { DB } from '@talaia/db';
import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
} from 'kysely';

import { createKyselyRecalculRepositories } from '../repository';

/** Kysely sense base de dades: captura l'SQL i torna les files que li diem. */
function fakeDb(files: Record<string, unknown>[] = []) {
  const queries: CompiledQuery[] = [];
  class Driver extends DummyDriver {
    override async acquireConnection(): Promise<DatabaseConnection> {
      return {
        executeQuery: async <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
          queries.push(query);
          return { rows: files as R[] };
        },
        streamQuery: () => {
          throw new Error('no fa falta');
        },
      };
    }
  }
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new Driver(),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { db, queries };
}

describe('createKyselyRecalculRepositories', () => {
  it("llegeix els punts publicats i converteix el numeric de l'SQM a number", async () => {
    const { db, queries } = fakeDb([
      { id: 'a', altitud: 1570, sqm: '21.56', lon: 0.7112, lat: 42.0294 },
      { id: 'b', altitud: null, sqm: null, lon: 2.17, lat: 41.38 },
    ]);

    const punts = await createKyselyRecalculRepositories(db).punts.listPublicats();

    expect(queries[0]?.sql).toBe(
      'select "id", "altitud", "sqm", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat" from "punts_observacio" where "estat" = $1 order by "slug"',
    );
    expect(queries[0]?.parameters).toEqual(['PUBLICAT']);
    expect(punts).toEqual([
      { id: 'a', altitud: 1570, sqm: 21.56, lon: 0.7112, lat: 42.0294 },
      { id: 'b', altitud: null, sqm: null, lon: 2.17, lat: 41.38 },
    ]);
  });

  it("esborra només l'índex anterior a la data", async () => {
    const { db, queries } = fakeDb();
    const abans = new Date('2026-10-15T21:00:00.000Z');

    await createKyselyRecalculRepositories(db).indexs.esborraAnteriors(abans);

    expect(queries[0]?.sql).toBe('delete from "index_visibilitat" where "hora" < $1');
    expect(queries[0]?.parameters).toEqual([abans]);
  });

  it("registra l'execució amb l'error o amb null", async () => {
    const { db, queries } = fakeDb();
    const { execucions } = createKyselyRecalculRepositories(db);
    const iniciadaEl = new Date('2026-10-16T21:05:00.000Z');
    const acabadaEl = new Date('2026-10-16T21:05:02.000Z');

    await execucions.registra({ iniciadaEl, acabadaEl, estat: 'ok', punts: 32, hores: 2720 });
    await execucions.registra({
      iniciadaEl,
      acabadaEl,
      estat: 'error',
      punts: 0,
      hores: 0,
      error: 'Open-Meteo 503',
    });

    expect(queries[0]?.sql).toBe(
      'insert into "execucions_worker" ("iniciada_el", "acabada_el", "estat", "punts", "hores", "error") values ($1, $2, $3, $4, $5, $6)',
    );
    expect(queries[0]?.parameters).toEqual([iniciadaEl, acabadaEl, 'ok', 32, 2720, null]);
    expect(queries[1]?.parameters).toEqual([
      iniciadaEl,
      acabadaEl,
      'error',
      0,
      0,
      'Open-Meteo 503',
    ]);
  });
});

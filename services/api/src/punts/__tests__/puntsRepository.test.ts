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
import type { DB } from '@talaia/db';

import { createPuntsRepository } from '../puntsRepository';

/** Kysely sense base de dades: captura l'SQL i torna les `files` que li diem. */
function dummyDb(files: Record<string, unknown>[] = []) {
  const queries: CompiledQuery[] = [];
  class Driver extends DummyDriver {
    override async acquireConnection(): Promise<DatabaseConnection> {
      return {
        executeQuery: async <R>(): Promise<QueryResult<R>> => ({ rows: files as R[] }),
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
    log: (event) => {
      queries.push(event.query);
    },
  });
  return { db, queries };
}

describe('puntsRepository.listPublished', () => {
  const HORA = new Date('2026-10-19T11:00:00.000Z');

  it("només llegeix els punts publicats, amb l'índex de l'hora que se li passa", async () => {
    const { db, queries } = dummyDb();

    await createPuntsRepository(db).listPublished(HORA);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "p"."id", "p"."nom", "p"."municipi", st_x("p"."ubicacio"::geometry) as "lon", st_y("p"."ubicacio"::geometry) as "lat", "iv"."valor", "iv"."franja" from "punts_observacio" as "p" left join "index_visibilitat" as "iv" on "iv"."punt_id" = "p"."id" and "iv"."hora" = $1 where "p"."estat" = $2 order by "p"."slug"',
    );
    expect(queries[0]?.parameters).toEqual([HORA, 'PUBLICAT']);
  });

  it("un punt sense fila d'índex (valor i franja nuls) surt amb index: null", async () => {
    const punt = { id: 'a', nom: 'Montsec', municipi: 'Àger', lon: 0.71, lat: 42.03 };
    const { db } = dummyDb([
      { ...punt, valor: null, franja: null },
      { ...punt, id: 'b', valor: 82, franja: 'ras' },
    ]);

    await expect(createPuntsRepository(db).listPublished(HORA)).resolves.toEqual([
      { ...punt, index: null },
      { ...punt, id: 'b', index: { valor: 82, franja: 'ras' } },
    ]);
  });
});

describe('puntsRepository.indexVersion', () => {
  it("llegeix l'última execució correcta del worker", async () => {
    const { db, queries } = dummyDb();

    await expect(createPuntsRepository(db).indexVersion()).resolves.toBeNull();

    expect(queries[0]?.sql).toBe(
      'select max("acabada_el") as "acabada_el" from "execucions_worker" where "estat" = $1',
    );
    expect(queries[0]?.parameters).toEqual(['ok']);
  });
});

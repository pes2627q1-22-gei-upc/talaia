import type { DB } from '@talaia/db';
import type { LecturaXema } from '@talaia/shared';
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

import { createKyselyXemaRepository } from '../repository';

/** Kysely sense base de dades: captura l'SQL i torna les `files` que li diem. */
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

const lectura = (data: string): LecturaXema => ({
  estacio: 'CC',
  data,
  temperatura: 8.3,
  humitat: null,
  precipitacio: 0,
  ventVelocitat: 7.2,
  ventDireccio: 270,
  irradiancia: 0,
  validada: true,
});

describe('createKyselyXemaRepository', () => {
  it("assigna a cada punt l'estació més propera amb el KNN de PostGIS", async () => {
    const { db, queries } = fakeDb([{ n: '32' }]);

    await expect(createKyselyXemaRepository(db).assignaEstacionsProperes()).resolves.toBe(32);

    expect(queries[0]?.sql).toBe(
      'update "punts_observacio" set "estacio_xema" = (select "e"."codi" from "estacions_xema" as "e" order by e.ubicacio <-> punts_observacio.ubicacio limit $1)',
    );
  });

  it('desa les lectures amb un upsert que no esborra els valors que no porta', async () => {
    const { db, queries } = fakeDb();

    await createKyselyXemaRepository(db).desaLectures([lectura('2026-10-18T21:00:00.000Z')]);

    expect(queries[0]?.sql).toContain('on conflict ("estacio", "data") do update set');
    expect(queries[0]?.sql).toContain(
      '"humitat" = coalesce(excluded.humitat, lectures_xema.humitat)',
    );
  });

  it('parteix les lectures en inserts de 1.000 files', async () => {
    const { db, queries } = fakeDb();
    const lectures = Array.from({ length: 2500 }, (_, i) =>
      lectura(new Date(Date.UTC(2026, 9, 18) + i * 60_000).toISOString()),
    );

    await createKyselyXemaRepository(db).desaLectures(lectures);

    expect(queries).toHaveLength(3);
  });

  it('torna només les estacions assignades a algun punt', async () => {
    const { db, queries } = fakeDb([{ estacioXema: 'CC' }, { estacioXema: 'UG' }]);

    await expect(createKyselyXemaRepository(db).estacionsDelsPunts()).resolves.toEqual([
      'CC',
      'UG',
    ]);
    expect(queries[0]?.sql).toBe(
      'select distinct "estacio_xema" from "punts_observacio" where "estacio_xema" is not null',
    );
  });
});

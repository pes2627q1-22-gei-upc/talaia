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

/** L'SQL sense salts de línia ni espais repetits, per comparar-lo. */
const pla = (sql: string | undefined) => sql?.replace(/\s+/g, ' ').trim();

describe('createKyselyXemaRepository', () => {
  it("assigna l'estació operativa més propera (KNN) i només als punts que canvien", async () => {
    const { db, queries } = fakeDb([{ n: '32' }]);

    await expect(createKyselyXemaRepository(db).assignaEstacionsProperes()).resolves.toBe(32);

    const mesPropera =
      '( select e.codi from estacions_xema e where e.operativa order by e.ubicacio <-> punts_observacio.ubicacio limit 1 )';
    expect(pla(queries[0]?.sql)).toBe(
      `update "punts_observacio" set "estacio_xema" = ${mesPropera} where estacio_xema is distinct from ${mesPropera}`,
    );
  });

  it('marca com a no operatives les estacions que falten, sense esborrar-ne cap', async () => {
    const { db, queries } = fakeDb();

    await createKyselyXemaRepository(db).desaEstacions([
      { codi: 'CC', nom: 'Orís', lat: 42.07, lon: 2.2, altitud: 626 },
      { codi: 'UG', nom: 'Viladecans', lat: 41.3, lon: 2.04, altitud: 3 },
    ]);

    const sqls = queries.map((q) => pla(q.sql) ?? '');
    expect(sqls.some((q) => q.startsWith('delete'))).toBe(false);
    const marca = queries.find((q) => q.sql.startsWith('update "estacions_xema"'));
    expect(pla(marca?.sql)).toBe(
      'update "estacions_xema" set "operativa" = $1, "actualitzada_el" = $2 where "operativa" = $3 and "codi" not in ($4, $5)',
    );
    expect(marca?.parameters).toEqual([false, expect.any(Date), true, 'CC', 'UG']);
  });

  it("desa les lectures amb un upsert que conserva els valors i calcula 'validada'", async () => {
    const { db, queries } = fakeDb();

    await createKyselyXemaRepository(db).desaLectures([lectura('2026-10-18T21:00:00.000Z')]);

    const sql = pla(queries[0]?.sql) ?? '';
    expect(sql).toContain('on conflict ("estacio", "data") do update set');
    expect(sql).toContain('"humitat" = coalesce(excluded.humitat, lectures_xema.humitat)');
    expect(sql).toContain(
      '"validada" = excluded.validada and (lectures_xema.validada or not ((excluded."temperatura" is null and lectures_xema."temperatura" is not null) or',
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

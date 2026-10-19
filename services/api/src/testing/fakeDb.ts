import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
} from 'kysely';
import type { DB } from '@talaia/db';

/** Driver sense base de dades que respon cada consulta amb `rows`, tal com les retornaria `pg`. */
class RowsDriver extends DummyDriver {
  constructor(private readonly rows: Record<string, unknown>[]) {
    super();
  }

  override async acquireConnection(): Promise<DatabaseConnection> {
    const rows = this.rows;
    return {
      executeQuery: async <R>() => ({ rows: rows as R[] }),
      // eslint-disable-next-line require-yield -- cap test fa servir streaming
      streamQuery: async function* () {
        throw new Error('streamQuery no està implementat al fake');
      },
    };
  }
}

/**
 * Kysely sense base de dades, amb els mateixos plugins que `createDb`. Captura l'SQL de cada
 * consulta i respon amb `rows` (claus en snake_case i `numeric` com a text, com fa `pg`).
 */
export function fakeDb(rows: Record<string, unknown>[] = []) {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new RowsDriver(rows),
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

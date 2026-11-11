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

/**
 * Kysely sense base de dades, amb el `CamelCasePlugin` de `createDb`: captura l'SQL de cada
 * consulta i torna les files que li diem (claus en snake_case, com fa `pg`). Només per als tests.
 */
export function fakeDb(files: Record<string, unknown>[] = []) {
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

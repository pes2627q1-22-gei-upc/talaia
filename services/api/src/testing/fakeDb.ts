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

type Rows = Record<string, unknown>[];

/**
 * Driver sense base de dades que respon cada consulta amb `rows`, tal com les retornaria `pg`.
 * Amb una llista de llistes, cada consulta rep la seva, en ordre (i `[]` quan s'acaben).
 */
class RowsDriver extends DummyDriver {
  private next = 0;

  constructor(private readonly rows: Rows | Rows[]) {
    super();
  }

  private rowsForNextQuery(): Rows {
    if (!isQueue(this.rows)) return this.rows;
    return this.rows[this.next++] ?? [];
  }

  override async acquireConnection(): Promise<DatabaseConnection> {
    return {
      executeQuery: async <R>() => ({ rows: this.rowsForNextQuery() as R[] }),
      // eslint-disable-next-line require-yield -- cap test fa servir streaming
      streamQuery: async function* () {
        throw new Error('streamQuery no està implementat al fake');
      },
    };
  }
}

const isQueue = (rows: Rows | Rows[]): rows is Rows[] => Array.isArray(rows[0]);

/**
 * Kysely sense base de dades, amb els mateixos plugins que `createDb`. Captura l'SQL de cada
 * consulta i respon amb `rows` (claus en snake_case i `numeric` com a text, com fa `pg`): les
 * mateixes files a totes les consultes o, amb una llista de llistes, unes per a cada consulta.
 */
export function fakeDb(rows: Rows | Rows[] = []) {
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

import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './schema';

export type CreateDbOptions = {
  /** Connexions màximes del pool: 5 a l'API i 2 al worker (ADR-0013). */
  max?: number;
  /** Temps màxim per obtenir una connexió. Sense valor, `pg` espera indefinidament. */
  connectionTimeoutMillis?: number;
  /** Temps màxim d'una consulta. Sense valor, una BD penjada bloqueja qui la crida per sempre. */
  queryTimeoutMillis?: number;
};

/**
 * Crea el client de la base de dades. `databaseUrl` és el Session pooler de Supabase (`DATABASE_URL`).
 * El codi treballa en camelCase (`dataCreacio`) i la base de dades en snake_case (`data_creacio`).
 * No connecta fins a la primera consulta; en acabar, `await db.destroy()`.
 */
export function createDb(
  databaseUrl: string,
  { max = 5, connectionTimeoutMillis, queryTimeoutMillis }: CreateDbOptions = {},
): Kysely<DB> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max,
    connectionTimeoutMillis,
    query_timeout: queryTimeoutMillis,
  });
  // El pooler de Supabase tanca connexions inactives: sense aquest listener, l'error atura el procés.
  pool.on('error', (err) => console.error('[db]', err));
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
}

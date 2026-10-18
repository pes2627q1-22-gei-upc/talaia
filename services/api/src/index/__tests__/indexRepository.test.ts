import type { DB } from '@talaia/db';
import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
} from 'kysely';

import { createPuntsRepository } from '../../punts/puntsRepository';
import { createIndexRepository } from '../indexRepository';

/** Sense base de dades: el DummyDriver no retorna files, però el log captura l'SQL. */
function dbThatLogs(queries: CompiledQuery[]) {
  return new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
    log: (event) => {
      queries.push(event.query);
    },
  });
}

describe('indexRepository.listHours', () => {
  it('llegeix les hores del punt dins de la finestra, en ordre', async () => {
    const queries: CompiledQuery[] = [];
    const from = new Date('2026-10-19T10:00:00Z');
    const to = new Date('2026-10-20T10:00:00Z');

    await createIndexRepository(dbThatLogs(queries)).listHours('p1', { from, to });

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "hora", "valor", "franja", "factors", "foscor_estimada" from "index_visibilitat" where "punt_id" = $1 and "hora" >= $2 and "hora" < $3 order by "hora"',
    );
    expect(queries[0]?.parameters).toEqual(['p1', from, to]);
  });
});

describe('puntsRepository.findPublished', () => {
  it("només troba el punt si té estat = 'PUBLICAT'", async () => {
    const queries: CompiledQuery[] = [];

    await createPuntsRepository(dbThatLogs(queries)).findPublished('p1');

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "id", "nom", "municipi" from "punts_observacio" where "id" = $1 and "estat" = $2',
    );
    expect(queries[0]?.parameters).toEqual(['p1', 'PUBLICAT']);
  });
});

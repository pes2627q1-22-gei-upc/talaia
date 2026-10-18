import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
} from 'kysely';
import type { DB } from '@talaia/db';

import { createPuntsRepository } from '../puntsRepository';

/** Sense base de dades: el DummyDriver no retorna files, però el log captura l'SQL. */
function dummyDb() {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<DB>({
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
  return { db, queries };
}

describe('puntsRepository.listPublished', () => {
  it("només llegeix els punts amb estat = 'PUBLICAT'", async () => {
    const { db, queries } = dummyDb();

    await createPuntsRepository(db).listPublished();

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "id", "nom", "municipi", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat" from "punts_observacio" where "estat" = $1 order by "slug"',
    );
    expect(queries[0]?.parameters).toEqual(['PUBLICAT']);
  });
});

describe('puntsRepository.findPublished', () => {
  it('llegeix el punt per id, només si és PUBLICAT, amb la foscor (sqm)', async () => {
    const { db, queries } = dummyDb();

    const punt = await createPuntsRepository(db).findPublished('id-1');

    expect(punt).toBeUndefined();
    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "id", "nom", "municipi", "descripcio", "altitud", "horitzo_obert", "accessibilitat", "sqm", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat" from "punts_observacio" where "id" = $1 and "estat" = $2',
    );
    expect(queries[0]?.parameters).toEqual(['id-1', 'PUBLICAT']);
  });
});

describe('puntsRepository.indexHores', () => {
  it("llegeix l'índex del punt en el rang [desDe, finsA), per hora", async () => {
    const { db, queries } = dummyDb();
    const desDe = new Date('2026-10-18T21:00:00Z');
    const finsA = new Date('2026-10-19T22:00:00Z');

    expect(await createPuntsRepository(db).indexHores('id-1', desDe, finsA)).toEqual([]);

    expect(queries[0]?.sql).toBe(
      'select "hora", "valor", "franja", "factors", "foscor_estimada" from "index_visibilitat" where "punt_id" = $1 and "hora" >= $2 and "hora" < $3 order by "hora"',
    );
    expect(queries[0]?.parameters).toEqual(['id-1', desDe, finsA]);
  });
});

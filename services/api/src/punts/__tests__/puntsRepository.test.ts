import { fakeDb as dummyDb } from '../../testing/fakeDb';
import { createPuntsRepository } from '../puntsRepository';

/** Una fila de `punts_observacio` tal com la retorna `pg`: `numeric` arriba com a text. */
const FILA_PUNT = {
  id: 'id-1',
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  descripcio: 'Parc Astronòmic del Montsec.',
  altitud: 800,
  horitzo_obert: ['S', 'SW'],
  accessibilitat: null,
  sqm: '21.40',
  lon: 0.7364,
  lat: 42.0244,
};

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

  it("converteix sqm (numeric, que pg retorna com a text) a number: '21.40' → 21.4", async () => {
    const { db } = dummyDb([FILA_PUNT]);

    const punt = await createPuntsRepository(db).findPublished('id-1');

    expect(punt?.sqm).toBe(21.4);
    expect(punt).toMatchObject({ horitzoObert: ['S', 'SW'], altitud: 800 });
  });

  it('manté sqm null si la foscor encara no està calculada', async () => {
    const { db } = dummyDb([{ ...FILA_PUNT, sqm: null }]);

    expect((await createPuntsRepository(db).findPublished('id-1'))?.sqm).toBeNull();
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

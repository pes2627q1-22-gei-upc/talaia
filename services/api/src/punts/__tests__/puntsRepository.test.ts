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
  const HORA = new Date('2026-10-19T11:00:00.000Z');

  it("només llegeix els punts publicats, amb l'índex de l'hora que se li passa", async () => {
    const { db, queries } = dummyDb();

    await createPuntsRepository(db).listPublished(HORA);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "p"."id", "p"."nom", "p"."municipi", st_x("p"."ubicacio"::geometry) as "lon", st_y("p"."ubicacio"::geometry) as "lat", "iv"."valor", "iv"."franja", "iv"."factors" from "punts_observacio" as "p" left join "index_visibilitat" as "iv" on "iv"."punt_id" = "p"."id" and "iv"."hora" = $1 where "p"."estat" = $2 order by "p"."slug"',
    );
    expect(queries[0]?.parameters).toEqual([HORA, 'PUBLICAT']);
  });

  it("un punt sense fila d'índex (valor i franja nuls) surt amb index: null", async () => {
    const punt = { id: 'a', nom: 'Montsec', municipi: 'Àger', lon: 0.71, lat: 42.03 };
    const { db } = dummyDb([
      { ...punt, valor: null, franja: null, factors: null },
      { ...punt, id: 'b', valor: 82, franja: 'ras', factors: { sol: 1 } },
    ]);

    await expect(createPuntsRepository(db).listPublished(HORA)).resolves.toEqual([
      { ...punt, index: null },
      { ...punt, id: 'b', index: { valor: 82, franja: 'ras', deDia: false } },
    ]);
  });

  it('amb el Sol amunt (factor sol 0) marca deDia', async () => {
    const punt = { id: 'a', nom: 'Montsec', municipi: 'Àger', lon: 0.71, lat: 42.03 };
    const { db } = dummyDb([
      { ...punt, valor: 0, franja: 'tap', factors: { sol: 0 } },
      { ...punt, id: 'b', valor: 20, franja: 'tap', factors: { sol: 0.5 } },
    ]);

    const [dia, crepuscle] = await createPuntsRepository(db).listPublished(HORA);
    expect(dia?.index?.deDia).toBe(true);
    expect(crepuscle?.index?.deDia).toBe(false);
  });
});

describe('puntsRepository.indexVersion', () => {
  it("llegeix l'última execució del worker que ha desat algun punt", async () => {
    const { db, queries } = dummyDb();

    await expect(createPuntsRepository(db).indexVersion()).resolves.toBeNull();

    expect(queries[0]?.sql).toBe(
      'select max("acabada_el") as "acabada_el" from "execucions_worker" where "punts" > $1',
    );
    expect(queries[0]?.parameters).toEqual([0]);
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

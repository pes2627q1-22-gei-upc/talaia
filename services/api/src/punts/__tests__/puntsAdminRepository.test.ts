import { fakeDb } from '../../testing/fakeDb';
import { createPuntsAdminRepository, MATEIX_LLOC_M } from '../puntsAdminRepository';

const COLUMNES =
  '"id", "slug", "nom", "municipi", "descripcio", "altitud", "horitzo_obert", "accessibilitat", "sqm", "estat", "origen", "data_creacio", "data_actualitzacio", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat"';

/** Una fila de `punts_observacio` tal com la retorna `pg`: `numeric` com a text i dates com a `Date`. */
const FILA = {
  id: '7d3f2c1a-5b4e-4f6a-9c8d-1e2f3a4b5c6d',
  slug: 'mirador-del-montsec',
  nom: 'Mirador del Montsec',
  municipi: 'Àger',
  descripcio: 'Mirador sobre la Noguera.',
  altitud: 1200,
  horitzo_obert: ['S', 'SW'],
  accessibilitat: null,
  sqm: '21.40',
  estat: 'DESACTIVAT',
  origen: 'OFICIAL',
  data_creacio: new Date('2026-11-11T10:00:00.000Z'),
  data_actualitzacio: new Date('2026-11-12T08:30:00.000Z'),
  lon: 0.7364,
  lat: 42.0244,
};

const PUNT = {
  id: FILA.id,
  slug: FILA.slug,
  nom: FILA.nom,
  municipi: FILA.municipi,
  descripcio: FILA.descripcio,
  altitud: 1200,
  horitzoObert: ['S', 'SW'],
  accessibilitat: null,
  sqm: 21.4,
  estat: 'DESACTIVAT',
  origen: 'OFICIAL',
  dataCreacio: '2026-11-11T10:00:00.000Z',
  dataActualitzacio: '2026-11-12T08:30:00.000Z',
  lon: 0.7364,
  lat: 42.0244,
};

describe('puntsAdminRepository.list', () => {
  it('llegeix tots els punts, en qualsevol estat, per slug', async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createPuntsAdminRepository(db).list()).resolves.toEqual([PUNT]);

    expect(queries[0]?.sql).toBe(`select ${COLUMNES} from "punts_observacio" order by "slug"`);
    expect(queries[0]?.parameters).toEqual([]);
  });
});

describe('puntsAdminRepository.find', () => {
  it("llegeix el punt per id sense mirar l'estat", async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createPuntsAdminRepository(db).find(FILA.id)).resolves.toEqual(PUNT);

    expect(queries[0]?.sql).toBe(`select ${COLUMNES} from "punts_observacio" where "id" = $1`);
    expect(queries[0]?.parameters).toEqual([FILA.id]);
  });

  it('sense fila, undefined', async () => {
    const { db } = fakeDb([]);
    await expect(createPuntsAdminRepository(db).find(FILA.id)).resolves.toBeUndefined();
  });
});

describe('puntsAdminRepository.create', () => {
  const NOU = {
    slug: 'mirador-del-montsec',
    nom: 'Mirador del Montsec',
    municipi: 'Àger',
    descripcio: 'Mirador sobre la Noguera.',
    lat: 42.0244,
    lon: 0.7364,
  };

  it('insereix un punt OFICIAL sense creador i no trepitja un slug que ja existeix', async () => {
    const { db, queries } = fakeDb([{ ...FILA, estat: 'PUBLICAT', sqm: null }]);

    const punt = await createPuntsAdminRepository(db).create({ ...NOU, estat: 'PUBLICAT' });

    expect(punt).toMatchObject({ estat: 'PUBLICAT', sqm: null });
    expect(queries[0]?.sql).toBe(
      `insert into "punts_observacio" ("slug", "nom", "municipi", "descripcio", "altitud", "horitzo_obert", "accessibilitat", "sqm", "origen", "estat", "ubicacio") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, st_setsrid(st_makepoint($11, $12), 4326)::geography) on conflict ("slug") do nothing returning ${COLUMNES}`,
    );
    // Els camps opcionals que falten són null (foscor estimada); la geometria és [lon, lat].
    expect(queries[0]?.parameters).toEqual([
      NOU.slug,
      NOU.nom,
      NOU.municipi,
      NOU.descripcio,
      null,
      null,
      null,
      null,
      'OFICIAL',
      'PUBLICAT',
      NOU.lon,
      NOU.lat,
    ]);
  });

  it('desa els camps opcionals que es donen', async () => {
    const { db, queries } = fakeDb([FILA]);

    await createPuntsAdminRepository(db).create({
      ...NOU,
      altitud: 1200,
      horitzoObert: ['S', 'SW'],
      accessibilitat: 'Pista asfaltada',
      sqm: 21.4,
      estat: 'DESACTIVAT',
    });

    expect(queries[0]?.parameters.slice(4, 10)).toEqual([
      1200,
      ['S', 'SW'],
      'Pista asfaltada',
      21.4,
      'OFICIAL',
      'DESACTIVAT',
    ]);
  });

  it('si el slug ja existeix (cap fila), undefined', async () => {
    const { db } = fakeDb([]);
    await expect(
      createPuntsAdminRepository(db).create({ ...NOU, estat: 'PUBLICAT' }),
    ).resolves.toBeUndefined();
  });
});

describe('puntsAdminRepository.update', () => {
  it('només canvia els camps que es donen, sense tocar la ubicació ni el que en depèn', async () => {
    const { db, queries } = fakeDb([FILA]);

    const punt = await createPuntsAdminRepository(db).update(FILA.id, {
      estat: 'DESACTIVAT',
      accessibilitat: null,
    });

    expect(punt).toEqual(PUNT);
    expect(queries[0]?.sql).toBe(
      `update "punts_observacio" set "estat" = $1, "accessibilitat" = $2 where "id" = $3 returning ${COLUMNES}`,
    );
    expect(queries[0]?.parameters).toEqual(['DESACTIVAT', null, FILA.id]);
  });

  it(`si el punt es mou més de ${MATEIX_LLOC_M} m, horitzo, estacio_xema i sqm tornen a null`, async () => {
    const { db, queries } = fakeDb([FILA]);

    await createPuntsAdminRepository(db).update(FILA.id, { lat: 42.1, lon: 0.8 });

    // La dreta del `set` llegeix la ubicació d'abans: si la nova és a prop, es queda el valor.
    const siNoEsMou = (columna: string, n: number) =>
      `"${columna}" = case when st_dwithin("ubicacio", st_setsrid(st_makepoint($${n}, $${n + 1}), 4326)::geography, $${n + 2}) then "${columna}" else null end`;
    expect(queries[0]?.sql).toBe(
      `update "punts_observacio" set "ubicacio" = st_setsrid(st_makepoint($1, $2), 4326)::geography, ${siNoEsMou('horitzo', 3)}, ${siNoEsMou('estacio_xema', 6)}, ${siNoEsMou('sqm', 9)} where "id" = $12 returning ${COLUMNES}`,
    );
    expect(queries[0]?.parameters).toEqual([
      0.8,
      42.1,
      ...[0.8, 42.1, MATEIX_LLOC_M],
      ...[0.8, 42.1, MATEIX_LLOC_M],
      ...[0.8, 42.1, MATEIX_LLOC_M],
      FILA.id,
    ]);
  });

  it("si el punt es mou i porta l'sqm, desa l'sqm nou", async () => {
    const { db, queries } = fakeDb([FILA]);

    await createPuntsAdminRepository(db).update(FILA.id, { lat: 42.1, lon: 0.8, sqm: 20.5 });

    expect(queries[0]?.sql).toMatch(/^update "punts_observacio" set "sqm" = \$1, "ubicacio" = /);
    expect(queries[0]?.sql).not.toContain('then "sqm"');
    expect(queries[0]?.parameters[0]).toBe(20.5);
  });

  it('si no hi ha cap punt amb aquest id (cap fila), undefined', async () => {
    const { db } = fakeDb([]);
    await expect(
      createPuntsAdminRepository(db).update(FILA.id, { nom: 'Nou nom' }),
    ).resolves.toBeUndefined();
  });
});

import { fakeDb } from '../../testing/fakeDb';
import { createPuntsAdminRepository, MATEIX_LLOC_M } from '../puntsAdminRepository';

/** L'SQL sense salts de línia ni espais repetits, per comparar-lo. */
const pla = (sql: string | undefined) => sql?.replace(/\s+/g, ' ').trim();

/** La subconsulta de l'estació XEMA més propera (`@talaia/db`), sobre el punt `$n, $n+1`. */
const estacioMesPropera = (n: number) =>
  `( select e.codi from estacions_xema e where e.operativa order by e.ubicacio <-> st_setsrid(st_makepoint($${n}, $${n + 1}), 4326)::geography limit 1 )`;

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

  it("insereix un punt OFICIAL sense creador, amb l'estació XEMA més propera, i no trepitja un slug que ja existeix", async () => {
    const { db, queries } = fakeDb([{ ...FILA, estat: 'PUBLICAT', sqm: null }]);

    const punt = await createPuntsAdminRepository(db).create({ ...NOU, estat: 'PUBLICAT' });

    expect(punt).toMatchObject({ estat: 'PUBLICAT', sqm: null });
    expect(pla(queries[0]?.sql)).toBe(
      `insert into "punts_observacio" ("slug", "nom", "municipi", "descripcio", "altitud", "horitzo_obert", "accessibilitat", "sqm", "origen", "estat", "ubicacio", "estacio_xema") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, st_setsrid(st_makepoint($11, $12), 4326)::geography, ${estacioMesPropera(13)}) on conflict ("slug") do nothing returning ${COLUMNES}`,
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
  /** La fila d'abans del canvi, bloquejada, i si la ubicació nova és a menys de `MATEIX_LLOC_M`. */
  const selectActual = (mateixLloc: string) =>
    `select ${COLUMNES}, ${mateixLloc} as "mateix_lloc" from "punts_observacio" where "id" = $${mateixLloc === 'true' ? 1 : 4} for update`;
  const DINS_RADI = 'st_dwithin("ubicacio", st_setsrid(st_makepoint($1, $2), 4326)::geography, $3)';

  it('sense moure el punt, només canvia els camps que es donen', async () => {
    const { db, queries } = fakeDb([[{ ...FILA, mateix_lloc: true }], [FILA]]);

    const punt = await createPuntsAdminRepository(db).update(FILA.id, {
      estat: 'DESACTIVAT',
      accessibilitat: null,
    });

    expect(punt).toEqual(PUNT);
    expect(queries.map((q) => q.sql)).toEqual([
      selectActual('true'),
      `update "punts_observacio" set "estat" = $1, "accessibilitat" = $2 where "id" = $3 returning ${COLUMNES}`,
    ]);
    expect(queries[1]?.parameters).toEqual(['DESACTIVAT', null, FILA.id]);
  });

  it('comprova rep el punt abans del canvi; si llança, no canvia res', async () => {
    const { db, queries } = fakeDb([[{ ...FILA, mateix_lloc: true }], [FILA]]);
    const comprova = jest.fn(() => {
      throw new Error('no es pot');
    });

    await expect(
      createPuntsAdminRepository(db).update(FILA.id, { estat: 'PUBLICAT' }, comprova),
    ).rejects.toThrow('no es pot');

    expect(comprova).toHaveBeenCalledWith(PUNT);
    expect(queries).toHaveLength(1);
  });

  it(`a menys de ${MATEIX_LLOC_M} m és el mateix lloc: es desa la ubicació i es queda la resta`, async () => {
    const { db, queries } = fakeDb([[{ ...FILA, mateix_lloc: true }], [FILA]]);

    await createPuntsAdminRepository(db).update(FILA.id, { lat: 42.02441, lon: 0.73641 });

    expect(queries[0]?.sql).toBe(selectActual(DINS_RADI));
    expect(queries[0]?.parameters).toEqual([0.73641, 42.02441, MATEIX_LLOC_M, FILA.id]);
    expect(queries[1]?.sql).toBe(
      `update "punts_observacio" set "ubicacio" = st_setsrid(st_makepoint($1, $2), 4326)::geography where "id" = $3 returning ${COLUMNES}`,
    );
    expect(queries).toHaveLength(2);
  });

  it(`si es mou més de ${MATEIX_LLOC_M} m: horitzo i sqm a null, l'estació més propera i fora l'índex`, async () => {
    const { db, queries } = fakeDb([[{ ...FILA, mateix_lloc: false }], [FILA]]);

    await createPuntsAdminRepository(db).update(FILA.id, { lat: 42.1, lon: 0.8 });

    expect(queries).toHaveLength(3);
    expect(pla(queries[1]?.sql)).toBe(
      `update "punts_observacio" set "ubicacio" = st_setsrid(st_makepoint($1, $2), 4326)::geography, "horitzo" = $3, "estacio_xema" = ${estacioMesPropera(4)}, "sqm" = $6 where "id" = $7 returning ${COLUMNES}`,
    );
    expect(queries[1]?.parameters).toEqual([0.8, 42.1, null, 0.8, 42.1, null, FILA.id]);
    // L'índex era del lloc d'abans: el worker el torna a calcular a la propera hora.
    expect(queries[2]?.sql).toBe('delete from "index_visibilitat" where "punt_id" = $1');
    expect(queries[2]?.parameters).toEqual([FILA.id]);
  });

  it.each<[string, number | null, number | null]>([
    ['el mateix sqm que hi havia (el formulari envia el punt sencer): no compta', 21.4, null],
    ['el mateix sqm amb més decimals: tampoc', 21.4001, null],
    ['un sqm diferent: es desa', 20.5, 20.5],
    ['sqm null: null', null, null],
  ])('si es mou amb %s', async (_cas, sqm, desat) => {
    const { db, queries } = fakeDb([[{ ...FILA, mateix_lloc: false }], [FILA]]);

    await createPuntsAdminRepository(db).update(FILA.id, { lat: 42.1, lon: 0.8, sqm });

    expect(pla(queries[1]?.sql)).toMatch(
      /^update "punts_observacio" set "sqm" = \$1, "ubicacio" = /,
    );
    expect(queries[1]?.parameters[0]).toBe(desat);
  });

  it('si no hi ha cap punt amb aquest id, undefined i cap canvi', async () => {
    const { db, queries } = fakeDb([]);
    await expect(
      createPuntsAdminRepository(db).update(FILA.id, { nom: 'Nou nom' }),
    ).resolves.toBeUndefined();
    expect(queries).toHaveLength(1);
  });
});

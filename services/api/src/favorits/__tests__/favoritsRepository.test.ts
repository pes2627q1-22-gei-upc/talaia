import { fakeDb } from '../../testing/fakeDb';
import { createFavoritsRepository } from '../favoritsRepository';

const PERFIL = 'aaaaaaaa-0000-4000-8000-000000000001';
const MONTSEC = 'bbbbbbbb-0000-4000-8000-000000000001';
const HORA = new Date('2026-11-11T21:00:00.000Z');

/** Una fila de la consulta de favorits tal com la retorna `pg`: snake_case, dates com a `Date`. */
const FILA = {
  id: MONTSEC,
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  lon: 0.7364,
  lat: 42.0244,
  valor: 82,
  franja: 'ras',
  factors: { nuvols: 1, sol: 1, foscor: 0.9, lluna: 0.7 },
  data_creacio: new Date('2026-11-11T18:00:00.000Z'),
};

const FAVORIT = {
  id: MONTSEC,
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  lon: 0.7364,
  lat: 42.0244,
  index: { valor: 82, franja: 'ras', deDia: false },
  dataCreacio: '2026-11-11T18:00:00.000Z',
};

/** El punt publicat, amb l'índex de l'hora, dels favorits del perfil. */
const SELECT_FAVORITS =
  'select "p"."id", "p"."nom", "p"."municipi", st_x("p"."ubicacio"::geometry) as "lon", st_y("p"."ubicacio"::geometry) as "lat", "iv"."valor", "iv"."franja", "iv"."factors", "f"."data_creacio" ' +
  'from "favorits" as "f" inner join "punts_observacio" as "p" on "p"."id" = "f"."punt_id" ' +
  'left join "index_visibilitat" as "iv" on "iv"."punt_id" = "p"."id" and "iv"."hora" = $1 ' +
  'where "f"."perfil_id" = $2 and "p"."estat" = $3';

describe('favoritsRepository.list', () => {
  it("només llegeix els favorits publicats del perfil, els més nous primer, amb l'índex de l'hora", async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createFavoritsRepository(db).list(PERFIL, HORA)).resolves.toEqual([FAVORIT]);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(`${SELECT_FAVORITS} order by "f"."data_creacio" desc, "p"."id"`);
    expect(queries[0]?.parameters).toEqual([HORA, PERFIL, 'PUBLICAT']);
  });

  it('un punt sense índex surt amb index: null, i de dia (factor sol 0) amb deDia', async () => {
    const { db } = fakeDb([
      { ...FILA, valor: null, franja: null, factors: null },
      { ...FILA, valor: 0, franja: 'tap', factors: { sol: 0 } },
    ]);

    const [senseIndex, deDia] = await createFavoritsRepository(db).list(PERFIL, HORA);
    expect(senseIndex?.index).toBeNull();
    expect(deDia?.index).toEqual({ valor: 0, franja: 'tap', deDia: true });
  });

  it('torna una llista buida si no en té cap', async () => {
    const { db } = fakeDb([]);
    await expect(createFavoritsRepository(db).list(PERFIL, HORA)).resolves.toEqual([]);
  });
});

describe('favoritsRepository.add', () => {
  const INSERT =
    'insert into "favorits" ("perfil_id", "punt_id") ' +
    'select $1 as "perfil_id", "id" from "punts_observacio" where "id" = $2 and "estat" = $3 ' +
    'on conflict ("perfil_id", "punt_id") do nothing returning "punt_id"';

  it('insereix el favorit només si el punt és publicat i el torna amb created: true', async () => {
    const { db, queries } = fakeDb([[{ punt_id: MONTSEC }], [FILA]]);

    await expect(createFavoritsRepository(db).add(PERFIL, MONTSEC, HORA)).resolves.toEqual({
      created: true,
      favorit: FAVORIT,
    });

    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toBe(INSERT);
    expect(queries[0]?.parameters).toEqual([PERFIL, MONTSEC, 'PUBLICAT']);
    expect(queries[1]?.sql).toBe(`${SELECT_FAVORITS} and "p"."id" = $4`);
    expect(queries[1]?.parameters).toEqual([HORA, PERFIL, 'PUBLICAT', MONTSEC]);
  });

  it('si ja hi era (on conflict no retorna cap fila), created: false', async () => {
    const { db } = fakeDb([[], [FILA]]);
    await expect(createFavoritsRepository(db).add(PERFIL, MONTSEC, HORA)).resolves.toEqual({
      created: false,
      favorit: FAVORIT,
    });
  });

  it('torna undefined si el punt no existeix o no és publicat', async () => {
    const { db, queries } = fakeDb([[], []]);
    await expect(createFavoritsRepository(db).add(PERFIL, MONTSEC, HORA)).resolves.toBeUndefined();
    expect(queries).toHaveLength(2);
  });
});

describe('favoritsRepository.remove', () => {
  it('esborra només la fila del perfil i el punt', async () => {
    const { db, queries } = fakeDb([]);

    await createFavoritsRepository(db).remove(PERFIL, MONTSEC);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'delete from "favorits" where "perfil_id" = $1 and "punt_id" = $2',
    );
    expect(queries[0]?.parameters).toEqual([PERFIL, MONTSEC]);
  });
});

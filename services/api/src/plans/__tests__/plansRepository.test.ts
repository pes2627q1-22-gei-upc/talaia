import { fakeDb } from '../../testing/fakeDb';
import { createPlansRepository, MAX_PLANS_FUTURS } from '../plansRepository';

/**
 * L'SQL de `plansRepository` (TG-156) amb el fake de Kysely: la CI no té Postgres. El que s'hi
 * comprova és la garantia de seguretat: totes les lectures filtren per `perfil_id` amb el perfil que
 * rep (el del JWT), i el pla d'un punt retirat no es filtra.
 */
const PERFIL = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLA = 'cccccccc-0000-4000-8000-000000000001';
const MONTSEC = 'bbbbbbbb-0000-4000-8000-000000000001';
const ARA = new Date('2026-11-16T12:00:00.000Z');

/** Una fila tal com la retorna `pg`: snake_case i dates com a `Date`. */
const FILA = {
  id: PLA,
  punt_id: MONTSEC,
  punt_nom: 'Observatori del Montsec',
  punt_municipi: 'Àger',
  punt_textos: { ca: { nom: 'Observatori del Montsec' } },
  punt_estat: 'PUBLICAT',
  esdeveniment_id: 'leonides-2026',
  data_hora_inici: new Date('2026-11-20T21:00:00.000Z'),
  data_hora_fi: new Date('2026-11-21T01:00:00.000Z'),
  calendari_event_id: null,
  notes: 'Portar el trípode',
  data_creacio: new Date('2026-11-16T10:00:00.000Z'),
  data_actualitzacio: new Date('2026-11-16T10:00:00.000Z'),
};

const PLA_AMB_TEXTOS = {
  id: PLA,
  punt: {
    id: MONTSEC,
    nom: 'Observatori del Montsec',
    municipi: 'Àger',
    textos: FILA.punt_textos,
    publicat: true,
  },
  esdevenimentId: 'leonides-2026',
  dataHoraInici: '2026-11-20T21:00:00.000Z',
  dataHoraFi: '2026-11-21T01:00:00.000Z',
  calendariEventId: null,
  notes: 'Portar el trípode',
  dataCreacio: '2026-11-16T10:00:00.000Z',
  dataActualitzacio: '2026-11-16T10:00:00.000Z',
};

/** Els plans del perfil amb el punt, sense filtrar per l'estat del punt. */
const SELECT_PLANS =
  'select "pl"."id", "p"."id" as "punt_id", "p"."nom" as "punt_nom", "p"."municipi" as "punt_municipi", "p"."textos" as "punt_textos", "p"."estat" as "punt_estat", ' +
  '"pl"."esdeveniment_id", "pl"."data_hora_inici", "pl"."data_hora_fi", "pl"."calendari_event_id", "pl"."notes", "pl"."data_creacio", "pl"."data_actualitzacio" ' +
  'from "plans" as "pl" inner join "punts_observacio" as "p" on "p"."id" = "pl"."punt_id" ' +
  'where "pl"."perfil_id" = $1';

/** Quan s'acaba un pla: `data_hora_fi` o, sense, el migdia de després de la nit de l'inici. */
const FI_EFECTIU =
  'coalesce("pl"."data_hora_fi", ((("pl"."data_hora_inici" at time zone $2) - interval \'12 hours\')::date + 1 + time \'12:00\') at time zone $3)';
const TZ = 'Europe/Madrid';

describe('plansRepository.list', () => {
  it('sense quan, tots els plans del perfil per data, també els d’un punt retirat', async () => {
    const { db, queries } = fakeDb([FILA, { ...FILA, id: 'altre', punt_estat: 'RETIRAT' }]);

    const plans = await createPlansRepository(db).list(PERFIL, undefined, ARA);

    expect(plans).toEqual([
      PLA_AMB_TEXTOS,
      { ...PLA_AMB_TEXTOS, id: 'altre', punt: { ...PLA_AMB_TEXTOS.punt, publicat: false } },
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(`${SELECT_PLANS} order by "pl"."data_hora_inici" asc, "pl"."id"`);
    expect(queries[0]?.parameters).toEqual([PERFIL]);
  });

  it('futurs: els que no s’han acabat (sense fi, fins al final de la seva nit), del més proper', async () => {
    const { db, queries } = fakeDb([]);

    await createPlansRepository(db).list(PERFIL, 'futurs', ARA);

    expect(queries[0]?.sql).toBe(
      `${SELECT_PLANS} and ${FI_EFECTIU} >= $4 order by "pl"."data_hora_inici" asc, "pl"."id"`,
    );
    expect(queries[0]?.parameters).toEqual([PERFIL, TZ, TZ, ARA]);
  });

  it('passats: els acabats, del més recent al més antic', async () => {
    const { db, queries } = fakeDb([]);

    await createPlansRepository(db).list(PERFIL, 'passats', ARA);

    expect(queries[0]?.sql).toBe(
      `${SELECT_PLANS} and ${FI_EFECTIU} < $4 order by "pl"."data_hora_inici" desc, "pl"."id"`,
    );
    expect(queries[0]?.parameters).toEqual([PERFIL, TZ, TZ, ARA]);
  });

  it('un pla sense data de fi surt amb dataHoraFi: null', async () => {
    const { db } = fakeDb([{ ...FILA, data_hora_fi: null }]);
    const [pla] = await createPlansRepository(db).list(PERFIL, undefined, ARA);
    expect(pla?.dataHoraFi).toBeNull();
  });
});

describe('plansRepository.findById', () => {
  it('busca el pla pel seu id i pel perfil: el d’un altre usuari no el troba', async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createPlansRepository(db).findById(PERFIL, PLA)).resolves.toEqual(PLA_AMB_TEXTOS);
    expect(queries[0]?.sql).toBe(`${SELECT_PLANS} and "pl"."id" = $2`);
    expect(queries[0]?.parameters).toEqual([PERFIL, PLA]);
  });

  it('sense cap fila, undefined', async () => {
    const { db } = fakeDb([]);
    await expect(createPlansRepository(db).findById(PERFIL, PLA)).resolves.toBeUndefined();
  });
});

describe('plansRepository.setCalendarEvent', () => {
  it('actualitza només el vincle del pla propi, filtrant per perfil i id a l’SQL', async () => {
    const { db, queries } = fakeDb([{ id: PLA }]);
    await expect(createPlansRepository(db).setCalendarEvent(PERFIL, PLA, 'event-1')).resolves.toBe(
      true,
    );
    expect(queries[0]?.sql).toBe(
      'update "plans" set "calendari_event_id" = $1 where "perfil_id" = $2 and "id" = $3 returning "id"',
    );
    expect(queries[0]?.parameters).toEqual(['event-1', PERFIL, PLA]);
  });

  it('no modifica cap fila si el pla no existeix o no és del perfil', async () => {
    const { db } = fakeDb([]);
    await expect(createPlansRepository(db).setCalendarEvent(PERFIL, PLA, 'event-1')).resolves.toBe(
      false,
    );
  });
});

describe('plansRepository.create', () => {
  const NOU = {
    puntId: MONTSEC,
    esdevenimentId: 'leonides-2026',
    dataHoraInici: '2026-11-20T22:00:00+01:00',
    dataHoraFi: '2026-11-21T01:00:00Z',
    notes: 'Portar el trípode',
  };

  const sqls = (queries: { sql: string }[]) => queries.map((q) => q.sql);

  it('bloqueja el perfil, comprova punt, esdeveniment i límit, insereix i retorna el pla', async () => {
    const { db, queries } = fakeDb([
      [{ id: PERFIL }],
      [{ id: MONTSEC }],
      [{ codi: 'leonides-2026' }],
      [{ total: '0' }],
      [{ id: PLA }],
      [FILA],
    ]);

    await expect(createPlansRepository(db).create(PERFIL, NOU, ARA)).resolves.toEqual({
      ok: true,
      pla: PLA_AMB_TEXTOS,
    });

    const [perfil, punt, esdeveniment, total, insert, select] = queries;
    expect(perfil?.sql).toBe('select "id" from "perfils" where "id" = $1 for update');
    expect(perfil?.parameters).toEqual([PERFIL]);
    expect(punt?.sql).toBe(
      'select "id" from "punts_observacio" where "id" = $1 and "estat" = $2 for share',
    );
    expect(punt?.parameters).toEqual([MONTSEC, 'PUBLICAT']);
    // Els mateixos filtres que `GET /esdeveniments/{id}`: rellevant, publicable i d'un tipus públic.
    expect(esdeveniment?.sql).toMatch(
      /^select "e"\."codi" from "esdeveniments_astronomics" as "e" inner join "fenomens_astronomics" as "f" on "f"\."codi" = "e"\."fenomen_codi" where "e"\."rellevant_catalunya" = \$1 and "f"\."publicable_calendari" = \$2 and "f"\."tipus_codi" in \(.+\) and "e"\."codi" = \$\d+ for share$/,
    );
    expect(esdeveniment?.parameters?.slice(0, 2)).toEqual([true, true]);
    expect(esdeveniment?.parameters?.at(-1)).toBe('leonides-2026');
    // Només compten els plans que no s'han acabat.
    expect(total?.sql).toBe(
      `select count(*) as "total" from "plans" as "pl" where "pl"."perfil_id" = $1 and ${FI_EFECTIU} >= $4`,
    );
    expect(total?.parameters).toEqual([PERFIL, TZ, TZ, ARA]);
    expect(insert?.sql).toBe(
      'insert into "plans" ("perfil_id", "punt_id", "esdeveniment_id", "data_hora_inici", "data_hora_fi", "calendari_event_id", "notes") values ($1, $2, $3, $4, $5, $6, $7) ' +
        'on conflict ("perfil_id", "punt_id", "data_hora_inici") do nothing returning "id"',
    );
    // Les dates en UTC, sigui quina sigui la zona de l'entrada.
    expect(insert?.parameters).toEqual([
      PERFIL,
      MONTSEC,
      'leonides-2026',
      new Date('2026-11-20T21:00:00.000Z'),
      new Date('2026-11-21T01:00:00.000Z'),
      null,
      'Portar el trípode',
    ]);
    expect(select?.sql).toBe(`${SELECT_PLANS} and "pl"."id" = $2`);
    expect(select?.parameters).toEqual([PERFIL, PLA]);
  });

  it('sense esdeveniment no el busca i desa els opcionals a null', async () => {
    const { db, queries } = fakeDb([
      [{ id: PERFIL }],
      [{ id: MONTSEC }],
      [{ total: '0' }],
      [{ id: PLA }],
      [FILA],
    ]);

    await createPlansRepository(db).create(
      PERFIL,
      {
        puntId: MONTSEC,
        dataHoraInici: '2026-11-20T21:00:00Z',
      },
      ARA,
    );

    expect(sqls(queries).some((sql) => sql.includes('esdeveniments_astronomics'))).toBe(false);
    const insert = queries.find((q) => q.sql.startsWith('insert'));
    expect(insert?.parameters).toEqual([
      PERFIL,
      MONTSEC,
      null,
      new Date('2026-11-20T21:00:00.000Z'),
      null,
      null,
      null,
    ]);
  });

  it('amb un punt que no és publicat (o no existeix), punt_not_found i no insereix', async () => {
    const { db, queries } = fakeDb([[{ id: PERFIL }], []]);

    await expect(createPlansRepository(db).create(PERFIL, NOU, ARA)).resolves.toEqual({
      ok: false,
      reason: 'punt_not_found',
    });
    expect(sqls(queries).some((sql) => sql.startsWith('insert'))).toBe(false);
  });

  it('amb un esdeveniment que no existeix o no és públic, event_not_found i no insereix', async () => {
    const { db, queries } = fakeDb([[{ id: PERFIL }], [{ id: MONTSEC }], []]);

    await expect(createPlansRepository(db).create(PERFIL, NOU, ARA)).resolves.toEqual({
      ok: false,
      reason: 'event_not_found',
    });
    expect(sqls(queries).some((sql) => sql.startsWith('insert'))).toBe(false);
  });

  it(`amb ${MAX_PLANS_FUTURS} plans pendents, limit i no insereix`, async () => {
    const { db, queries } = fakeDb([
      [{ id: PERFIL }],
      [{ id: MONTSEC }],
      [{ codi: 'leonides-2026' }],
      [{ total: String(MAX_PLANS_FUTURS) }],
    ]);

    await expect(createPlansRepository(db).create(PERFIL, NOU, ARA)).resolves.toEqual({
      ok: false,
      reason: 'limit',
    });
    expect(sqls(queries).some((sql) => sql.startsWith('insert'))).toBe(false);
  });

  it('si ja hi ha un pla al mateix punt i hora (on conflict no retorna res), duplicate', async () => {
    const { db, queries } = fakeDb([
      [{ id: PERFIL }],
      [{ id: MONTSEC }],
      [{ codi: 'leonides-2026' }],
      [{ total: '1' }],
      [],
    ]);

    await expect(createPlansRepository(db).create(PERFIL, NOU, ARA)).resolves.toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(queries).toHaveLength(5);
  });
});

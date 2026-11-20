import { fakeDb } from '../../testing/fakeDb';
import { createKyselyEnviamentRepository } from '../enviamentRepository';

const ARA = new Date('2026-11-11T19:05:00.000Z');

describe('createKyselyEnviamentRepository', () => {
  it('claim: reserva en un sol update les files sense enviar que encara tenen sentit, amb l’índex actual', async () => {
    const { db, queries } = fakeDb([
      {
        alerta_id: 'alerta-2',
        nit: '2026-11-11',
        perfil_id: 'perfil-1',
        punt_id: 'prades',
        punt_nom: 'Prades',
        hora: new Date('2026-11-11T23:00:00.000Z'),
        index: 70,
      },
      {
        alerta_id: 'alerta-1',
        nit: '2026-11-11',
        perfil_id: 'perfil-1',
        punt_id: 'montsec',
        punt_nom: 'Montsec',
        hora: new Date('2026-11-11T22:00:00.000Z'),
        index: 75,
      },
    ]);
    const desDe = new Date('2026-11-11T19:00:00.000Z');

    const reservades = await createKyselyEnviamentRepository(db).claim(desDe, ARA);

    expect(reservades.map((n) => n.alertaId)).toEqual(['alerta-1', 'alerta-2']);
    expect(reservades[0]).toEqual({
      alertaId: 'alerta-1',
      nit: '2026-11-11',
      perfilId: 'perfil-1',
      puntId: 'montsec',
      puntNom: 'Montsec',
      hora: '2026-11-11T22:00:00.000Z',
      index: 75,
    });
    expect(queries[0]!.sql).toBe(
      'update "notificacions_alertes" as "n" set "enviada_el" = $1 ' +
        'from "alertes" as "a", "perfils" as "pf", "punts_observacio" as "p", "index_visibilitat" as "iv" ' +
        'where "a"."id" = "n"."alerta_id" and "pf"."id" = "a"."perfil_id" and "p"."id" = "n"."punt_id" ' +
        'and "iv"."punt_id" = "n"."punt_id" and "iv"."hora" = "n"."hora" ' +
        'and "n"."enviada_el" is null and "n"."hora" >= $2 and "a"."activa" = $3 ' +
        'and "pf"."bloquejat" = $4 and "p"."estat" = $5 and "iv"."valor" > $6 ' +
        'and "iv"."valor" >= "a"."index_minim" ' +
        'returning "n"."alerta_id", n.nit::text as "nit", "a"."perfil_id", "n"."punt_id", ' +
        '"p"."nom" as "punt_nom", "n"."hora", "iv"."valor" as "index"',
    );
    expect(queries[0]!.parameters).toEqual([ARA, desDe, true, false, 'PUBLICAT', 0]);
  });

  it('tokens: els dispositius dels perfils; sense perfils, cap consulta', async () => {
    const { db, queries } = fakeDb([{ perfil_id: 'perfil-1', token: 'ExponentPushToken[a]' }]);
    const repository = createKyselyEnviamentRepository(db);

    await expect(repository.tokens([])).resolves.toEqual([]);
    expect(queries).toHaveLength(0);
    await expect(repository.tokens(['perfil-1', 'perfil-2'])).resolves.toEqual([
      { perfilId: 'perfil-1', token: 'ExponentPushToken[a]' },
    ]);
    expect(queries[0]!.sql).toBe(
      'select "perfil_id", "token" from "dispositius_push" where "perfil_id" in ($1, $2) order by "token"',
    );
  });

  it('saveTickets: desa els tickets de la fila (alerta_id, nit)', async () => {
    const { db, queries } = fakeDb();

    await createKyselyEnviamentRepository(db).saveTickets(
      { alertaId: 'alerta-1', nit: '2026-11-11' },
      ['ticket-1'],
    );
    expect(queries[0]!.sql).toBe(
      'update "notificacions_alertes" set "ticket_ids" = $1 ' +
        'where "alerta_id" = $2 and "nit" = cast($3 as date)',
    );
    expect(queries[0]!.parameters).toEqual([['ticket-1'], 'alerta-1', '2026-11-11']);
  });

  it('release: desfà només la reserva pròpia', async () => {
    const { db, queries } = fakeDb();

    await createKyselyEnviamentRepository(db).release(
      { alertaId: 'alerta-1', nit: '2026-11-11' },
      ARA,
    );
    expect(queries[0]!.sql).toBe(
      'update "notificacions_alertes" set "enviada_el" = $1 ' +
        'where "alerta_id" = $2 and "nit" = cast($3 as date) and "enviada_el" = $4',
    );
    expect(queries[0]!.parameters).toEqual([null, 'alerta-1', '2026-11-11', ARA]);
  });

  it('deleteTokens: esborra els tokens; sense tokens, cap consulta', async () => {
    const { db, queries } = fakeDb();
    const repository = createKyselyEnviamentRepository(db);

    await repository.deleteTokens([]);
    expect(queries).toHaveLength(0);
    await repository.deleteTokens(['ExponentPushToken[a]']);
    expect(queries[0]!.sql).toBe('delete from "dispositius_push" where "token" in ($1)');
    expect(queries[0]!.parameters).toEqual(['ExponentPushToken[a]']);
  });
});

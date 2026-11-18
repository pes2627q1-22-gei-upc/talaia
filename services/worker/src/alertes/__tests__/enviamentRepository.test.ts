import { fakeDb } from '../../testing/fakeDb';
import { createKyselyEnviamentRepository } from '../enviamentRepository';

describe('createKyselyEnviamentRepository', () => {
  it('pending: les files sense enviar amb hora ≥ desDe, d’alertes actives, comptes no bloquejats i punts publicats', async () => {
    const { db, queries } = fakeDb([
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

    await expect(createKyselyEnviamentRepository(db).pending(desDe)).resolves.toEqual([
      {
        alertaId: 'alerta-1',
        nit: '2026-11-11',
        perfilId: 'perfil-1',
        puntId: 'montsec',
        puntNom: 'Montsec',
        hora: '2026-11-11T22:00:00.000Z',
        index: 75,
      },
    ]);
    expect(queries[0]!.sql).toBe(
      'select "n"."alerta_id", n.nit::text as "nit", "a"."perfil_id", "n"."punt_id", ' +
        '"p"."nom" as "punt_nom", "n"."hora", "n"."index" ' +
        'from "notificacions_alertes" as "n" ' +
        'inner join "alertes" as "a" on "a"."id" = "n"."alerta_id" ' +
        'inner join "perfils" as "pf" on "pf"."id" = "a"."perfil_id" ' +
        'inner join "punts_observacio" as "p" on "p"."id" = "n"."punt_id" ' +
        'where "n"."enviada_el" is null and "n"."hora" >= $1 and "a"."activa" = $2 ' +
        'and "pf"."bloquejat" = $3 and "p"."estat" = $4 ' +
        'order by "n"."alerta_id", "n"."nit"',
    );
    expect(queries[0]!.parameters).toEqual([desDe, true, false, 'PUBLICAT']);
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

  it('markSent: omple enviada_el i ticket_ids de la fila (alerta_id, nit)', async () => {
    const { db, queries } = fakeDb();
    const ara = new Date('2026-11-11T19:05:00.000Z');

    await createKyselyEnviamentRepository(db).markSent(
      { alertaId: 'alerta-1', nit: '2026-11-11' },
      ['ticket-1'],
      ara,
    );
    expect(queries[0]!.sql).toBe(
      'update "notificacions_alertes" set "enviada_el" = $1, "ticket_ids" = $2 ' +
        'where "alerta_id" = $3 and "nit" = cast($4 as date)',
    );
    expect(queries[0]!.parameters).toEqual([ara, ['ticket-1'], 'alerta-1', '2026-11-11']);
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

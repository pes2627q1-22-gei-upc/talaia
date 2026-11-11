import { fakeDb } from '../../testing/fakeDb';
import type { NotificacioAlerta } from '../avaluacio';
import { createKyselyAlertesRepository } from '../repository';

const FINESTRA = {
  nit: '2026-11-11',
  from: new Date('2026-11-11T19:00:00.000Z'),
  to: new Date('2026-11-12T11:00:00.000Z'),
};

const notificacio = (alertaId: string, puntId = 'montsec'): NotificacioAlerta => ({
  alertaId,
  perfilId: 'perfil-1',
  objectiu: 'cel_estrellat',
  nit: '2026-11-11',
  puntId,
  puntNom: 'Montsec',
  distanciaKm: 20,
  hora: '2026-11-11T22:00:00.000Z',
  index: 75,
});

describe('createKyselyAlertesRepository.candidates', () => {
  it('fa una sola consulta per a totes les alertes, amb el radi de cada una i les hores de la finestra', async () => {
    const { db, queries } = fakeDb();

    await createKyselyAlertesRepository(db).candidates(FINESTRA);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "a"."id" as "alerta_id", "a"."perfil_id", "a"."objectiu", "a"."activa", ' +
        '"a"."index_minim", "a"."distancia_max_km", "p"."id" as "punt_id", "p"."nom" as "punt_nom", ' +
        'st_distance("a"."origen", "p"."ubicacio") as "distancia_m", "iv"."hora", "iv"."valor" as "index" ' +
        'from "alertes" as "a" ' +
        'inner join "punts_observacio" as "p" on "p"."estat" = $1 ' +
        'and st_dwithin("a"."origen", "p"."ubicacio", "a"."distancia_max_km" * 1000) ' +
        'inner join "index_visibilitat" as "iv" on "iv"."punt_id" = "p"."id" ' +
        'where "a"."activa" = $2 and "iv"."hora" >= $3 and "iv"."hora" < $4 and "iv"."valor" > $5 ' +
        'and "iv"."valor" >= "a"."index_minim" ' +
        'and not exists (select "n"."alerta_id" from "notificacions_alertes" as "n" ' +
        'where "n"."alerta_id" = "a"."id" and "n"."nit" = cast($6 as date))',
    );
    expect(queries[0]?.parameters).toEqual([
      'PUBLICAT',
      true,
      FINESTRA.from,
      FINESTRA.to,
      0,
      '2026-11-11',
    ]);
  });

  it('converteix les files: distància en km i hora en ISO 8601', async () => {
    const { db } = fakeDb([
      {
        alerta_id: 'alerta-1',
        perfil_id: 'perfil-1',
        objectiu: 'via_lactia',
        activa: true,
        index_minim: 60,
        distancia_max_km: 50,
        punt_id: 'montsec',
        punt_nom: 'Montsec',
        distancia_m: 20_500.5,
        hora: new Date('2026-11-11T22:00:00.000Z'),
        index: 75,
      },
    ]);

    await expect(createKyselyAlertesRepository(db).candidates(FINESTRA)).resolves.toEqual([
      {
        alertaId: 'alerta-1',
        perfilId: 'perfil-1',
        objectiu: 'via_lactia',
        activa: true,
        indexMinim: 60,
        distanciaMaxKm: 50,
        puntId: 'montsec',
        puntNom: 'Montsec',
        distanciaKm: 20.5005,
        hora: '2026-11-11T22:00:00.000Z',
        index: 75,
      },
    ]);
  });
});

describe('createKyselyAlertesRepository.saveNotifications', () => {
  it('insereix totes les notificacions en una consulta i no en repeteix cap (alerta, nit)', async () => {
    const { db, queries } = fakeDb([{ alerta_id: 'alerta-1' }, { alerta_id: 'alerta-2' }]);

    await createKyselyAlertesRepository(db).saveNotifications([
      notificacio('alerta-1'),
      notificacio('alerta-2', 'siurana'),
    ]);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'insert into "notificacions_alertes" ("alerta_id", "nit", "punt_id", "hora", "index") ' +
        'values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10) ' +
        'on conflict ("alerta_id", "nit") do nothing returning "alerta_id"',
    );
    expect(queries[0]?.parameters).toEqual([
      'alerta-1',
      '2026-11-11',
      'montsec',
      '2026-11-11T22:00:00.000Z',
      75,
      'alerta-2',
      '2026-11-11',
      'siurana',
      '2026-11-11T22:00:00.000Z',
      75,
    ]);
  });

  it("torna només les que s'han inserit: les que ja hi eren aquesta nit no s'han d'enviar", async () => {
    // Postgres només torna les files inserides: l'alerta 1 ja tenia notificació.
    const { db } = fakeDb([{ alerta_id: 'alerta-2' }]);

    const noves = await createKyselyAlertesRepository(db).saveNotifications([
      notificacio('alerta-1'),
      notificacio('alerta-2', 'siurana'),
    ]);

    expect(noves).toEqual([notificacio('alerta-2', 'siurana')]);
  });

  it('sense notificacions no fa cap consulta', async () => {
    const { db, queries } = fakeDb();
    await expect(createKyselyAlertesRepository(db).saveNotifications([])).resolves.toEqual([]);
    expect(queries).toHaveLength(0);
  });
});

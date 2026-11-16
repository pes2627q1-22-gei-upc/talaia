import { fakeDb } from '../../testing/fakeDb';
import type { NotificacioAlerta } from '../avaluacio';
import { createKyselyAlertesRepository } from '../repository';

/** Les 20:05 locals: les alertes que avisen en arribar-hi i les de les 20 h. */
const PLA = {
  nit: '2026-11-11',
  from: new Date('2026-11-11T19:00:00.000Z'),
  to: new Date('2026-11-12T11:00:00.000Z'),
  enArribar: true,
  horaAvis: 20,
};

const notificacio = (
  alertaId: string,
  puntId = 'montsec',
  nit = '2026-11-11',
): NotificacioAlerta => ({
  alertaId,
  perfilId: 'perfil-1',
  objectiu: 'cel_estrellat',
  nit,
  puntId,
  puntNom: 'Montsec',
  distanciaKm: 20,
  hora: '2026-11-11T22:00:00.000Z',
  index: 75,
});

describe('createKyselyAlertesRepository.candidates', () => {
  const SELECT =
    'select "a"."id" as "alerta_id", "a"."perfil_id", "a"."objectiu", "a"."activa", ' +
    '"a"."avisa_en_arribar", "a"."hora_avis", "pf"."bloquejat" as "perfil_bloquejat", ' +
    '"a"."index_minim", "a"."distancia_max_km", "p"."id" as "punt_id", "p"."nom" as "punt_nom", ' +
    'st_distance("a"."origen", "p"."ubicacio") as "distancia_m", "iv"."hora", "iv"."valor" as "index" ' +
    'from "alertes" as "a" ' +
    'inner join "perfils" as "pf" on "pf"."id" = "a"."perfil_id" ' +
    'inner join "punts_observacio" as "p" on "p"."estat" = $1 ' +
    'and st_dwithin("a"."origen", "p"."ubicacio", "a"."distancia_max_km" * 1000) ' +
    'inner join "index_visibilitat" as "iv" on "iv"."punt_id" = "p"."id" ';
  const NOT_EXISTS = (n: number) =>
    'and not exists (select "n"."alerta_id" from "notificacions_alertes" as "n" ' +
    `where "n"."alerta_id" = "a"."id" and "n"."nit" = cast($${n} as date))`;

  it('fa una sola consulta per a totes les alertes del pla, amb el radi de cada una i les hores de la finestra', async () => {
    const { db, queries } = fakeDb();

    await createKyselyAlertesRepository(db).candidates(PLA);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      SELECT +
        'where "a"."activa" = $2 and ("a"."avisa_en_arribar" = $3 or "a"."hora_avis" = $4) ' +
        'and "pf"."bloquejat" = $5 ' +
        'and "iv"."hora" >= $6 and "iv"."hora" < $7 and "iv"."valor" > $8 ' +
        'and "iv"."valor" >= "a"."index_minim" ' +
        NOT_EXISTS(9),
    );
    expect(queries[0]?.parameters).toEqual([
      'PUBLICAT',
      true,
      true,
      20,
      false,
      PLA.from,
      PLA.to,
      0,
      '2026-11-11',
    ]);
  });

  it("el pla de la nit d'avui abans del migdia només demana les alertes de l'hora", async () => {
    const { db, queries } = fakeDb();

    await createKyselyAlertesRepository(db).candidates({ ...PLA, enArribar: false, horaAvis: 9 });

    expect(queries[0]?.sql).toContain('where "a"."activa" = $2 and "a"."hora_avis" = $3 and');
    expect(queries[0]?.parameters.slice(0, 4)).toEqual(['PUBLICAT', true, 9, false]);
  });

  it("el pla de la nit que s'acaba només demana les que avisen en arribar-hi", async () => {
    const { db, queries } = fakeDb();

    await createKyselyAlertesRepository(db).candidates({ ...PLA, horaAvis: null });

    expect(queries[0]?.sql).toContain(
      'where "a"."activa" = $2 and "a"."avisa_en_arribar" = $3 and',
    );
  });

  it('converteix les files: distància en km i hora en ISO 8601', async () => {
    const { db } = fakeDb([
      {
        alerta_id: 'alerta-1',
        perfil_id: 'perfil-1',
        objectiu: 'via_lactia',
        activa: true,
        avisa_en_arribar: false,
        hora_avis: 20,
        perfil_bloquejat: false,
        index_minim: 60,
        distancia_max_km: 50,
        punt_id: 'montsec',
        punt_nom: 'Montsec',
        distancia_m: 20_500.5,
        hora: new Date('2026-11-11T22:00:00.000Z'),
        index: 75,
      },
    ]);

    await expect(createKyselyAlertesRepository(db).candidates(PLA)).resolves.toEqual([
      {
        alertaId: 'alerta-1',
        perfilId: 'perfil-1',
        objectiu: 'via_lactia',
        activa: true,
        avisaEnArribar: false,
        horaAvis: 20,
        perfilBloquejat: false,
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
    const { db, queries } = fakeDb([
      { alerta_id: 'alerta-1', nit: '2026-11-11' },
      { alerta_id: 'alerta-2', nit: '2026-11-11' },
    ]);

    await createKyselyAlertesRepository(db).saveNotifications([
      notificacio('alerta-1'),
      notificacio('alerta-2', 'siurana'),
    ]);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'insert into "notificacions_alertes" ("alerta_id", "nit", "punt_id", "hora", "index") ' +
        'values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10) ' +
        'on conflict ("alerta_id", "nit") do nothing returning "alerta_id", nit::text as "nit"',
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
    const { db } = fakeDb([{ alerta_id: 'alerta-2', nit: '2026-11-11' }]);

    const noves = await createKyselyAlertesRepository(db).saveNotifications([
      notificacio('alerta-1'),
      notificacio('alerta-2', 'siurana'),
    ]);

    expect(noves).toEqual([notificacio('alerta-2', 'siurana')]);
  });

  it("compara per alerta i nit: d'una alerta amb dues nits només torna la que s'ha inserit", async () => {
    // Abans del migdia: la nit de l'11 ja tenia notificació, la del 12 és nova.
    const { db } = fakeDb([{ alerta_id: 'alerta-1', nit: '2026-11-12' }]);

    const noves = await createKyselyAlertesRepository(db).saveNotifications([
      notificacio('alerta-1', 'montsec', '2026-11-11'),
      notificacio('alerta-1', 'montsec', '2026-11-12'),
    ]);

    expect(noves).toEqual([notificacio('alerta-1', 'montsec', '2026-11-12')]);
  });

  it('sense notificacions no fa cap consulta', async () => {
    const { db, queries } = fakeDb();
    await expect(createKyselyAlertesRepository(db).saveNotifications([])).resolves.toEqual([]);
    expect(queries).toHaveLength(0);
  });
});

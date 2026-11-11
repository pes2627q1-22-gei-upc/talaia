import { fakeDb } from '../../testing/fakeDb';
import { createKyselyRecalculRepositories } from '../repository';

describe('createKyselyRecalculRepositories', () => {
  it("llegeix els punts publicats i converteix el numeric de l'SQM a number", async () => {
    const { db, queries } = fakeDb([
      { id: 'a', altitud: 1570, sqm: '21.56', lon: 0.7112, lat: 42.0294 },
      { id: 'b', altitud: null, sqm: null, lon: 2.17, lat: 41.38 },
    ]);

    const punts = await createKyselyRecalculRepositories(db).punts.listPublicats();

    expect(queries[0]?.sql).toBe(
      'select "id", "altitud", "sqm", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat" from "punts_observacio" where "estat" = $1 order by "slug"',
    );
    expect(queries[0]?.parameters).toEqual(['PUBLICAT']);
    expect(punts).toEqual([
      { id: 'a', altitud: 1570, sqm: 21.56, lon: 0.7112, lat: 42.0294 },
      { id: 'b', altitud: null, sqm: null, lon: 2.17, lat: 41.38 },
    ]);
  });

  it("esborra només l'índex anterior a la data", async () => {
    const { db, queries } = fakeDb();
    const abans = new Date('2026-10-15T21:00:00.000Z');

    await createKyselyRecalculRepositories(db).indexs.esborraAnteriors(abans);

    expect(queries[0]?.sql).toBe('delete from "index_visibilitat" where "hora" < $1');
    expect(queries[0]?.parameters).toEqual([abans]);
  });

  it("registra l'execució amb l'error o amb null", async () => {
    const { db, queries } = fakeDb();
    const { execucions } = createKyselyRecalculRepositories(db);
    const iniciadaEl = new Date('2026-10-16T21:05:00.000Z');
    const acabadaEl = new Date('2026-10-16T21:05:02.000Z');

    await execucions.registra({ iniciadaEl, acabadaEl, estat: 'ok', punts: 32, hores: 2720 });
    await execucions.registra({
      iniciadaEl,
      acabadaEl,
      estat: 'error',
      punts: 0,
      hores: 0,
      error: 'Open-Meteo 503',
    });

    expect(queries[0]?.sql).toBe(
      'insert into "execucions_worker" ("iniciada_el", "acabada_el", "estat", "punts", "hores", "error", "notificacions", "error_alertes") values ($1, $2, $3, $4, $5, $6, $7, $8)',
    );
    expect(queries[0]?.parameters).toEqual([
      iniciadaEl,
      acabadaEl,
      'ok',
      32,
      2720,
      null,
      null,
      null,
    ]);
    expect(queries[1]?.parameters).toEqual([
      iniciadaEl,
      acabadaEl,
      'error',
      0,
      0,
      'Open-Meteo 503',
      null,
      null,
    ]);
  });

  it("registra les notificacions d'alertes noves o l'error de les alertes (TG-153)", async () => {
    const { db, queries } = fakeDb();
    const { execucions } = createKyselyRecalculRepositories(db);
    const iniciadaEl = new Date('2026-11-11T19:05:00.000Z');
    const acabadaEl = new Date('2026-11-11T19:05:03.000Z');
    const base = { iniciadaEl, acabadaEl, estat: 'ok', punts: 32, hores: 2720 } as const;

    await execucions.registra({ ...base, notificacions: 3 });
    await execucions.registra({ ...base, errorAlertes: 'BD caiguda' });

    expect(queries[0]?.parameters.slice(5)).toEqual([null, 3, null]);
    expect(queries[1]?.parameters.slice(5)).toEqual([null, null, 'BD caiguda']);
  });
});

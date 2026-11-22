import { fakeDb } from '../../testing/fakeDb';
import { createKyselyXemaRepository } from '../repository';

describe('repositori de la XEMA: el biaix de la humitat (TG-184, ADR-0038)', () => {
  it('estacionsAssignades torna les estacions dels punts amb coordenades i el biaix', async () => {
    const calculatEl = new Date('2026-11-19T06:15:00.000Z');
    const { db, queries } = fakeDb([
      {
        codi: 'CC',
        altitud: 300,
        biaix_humitat: 4.5,
        biaix_calculat_el: calculatEl,
        lat: 41.7,
        lon: 1.8,
      },
      {
        codi: 'UG',
        altitud: null,
        biaix_humitat: null,
        biaix_calculat_el: null,
        lat: '42.1',
        lon: '1.2',
      },
    ]);

    const estacions = await createKyselyXemaRepository(db).estacionsAssignades();

    expect(queries[0]?.sql).toContain('exists (select 1 from punts_observacio p');
    expect(estacions).toEqual([
      {
        codi: 'CC',
        lat: 41.7,
        lon: 1.8,
        altitud: 300,
        biaixHumitat: 4.5,
        biaixCalculatEl: calculatEl,
      },
      { codi: 'UG', lat: 42.1, lon: 1.2, altitud: null, biaixHumitat: null, biaixCalculatEl: null },
    ]);
  });

  it('lecturesHumitat filtra per estació i per interval, i torna la data en ISO', async () => {
    const desDe = new Date('2026-11-06T00:00:00.000Z');
    const fins = new Date('2026-11-20T06:15:00.000Z');
    const { db, queries } = fakeDb([
      { data: new Date('2026-11-19T22:30:00.000Z'), humitat: 80 },
      { data: new Date('2026-11-19T23:00:00.000Z'), humitat: null },
    ]);

    const lectures = await createKyselyXemaRepository(db).lecturesHumitat('CC', desDe, fins);

    expect(queries[0]?.sql).toContain('from "lectures_xema"');
    expect(queries[0]?.parameters).toEqual(['CC', desDe, fins]);
    expect(lectures).toEqual([
      { data: '2026-11-19T22:30:00.000Z', humitat: 80 },
      { data: '2026-11-19T23:00:00.000Z', humitat: null },
    ]);
  });

  it('desaBiaix desa el biaix, les mostres i l’instant del càlcul de l’estació', async () => {
    const calculatEl = new Date('2026-11-20T06:15:00.000Z');
    const { db, queries } = fakeDb();

    await createKyselyXemaRepository(db).desaBiaix('CC', {
      biaix: -2.5,
      mostres: 60,
      calculatEl,
    });

    expect(queries[0]?.sql).toBe(
      'update "estacions_xema" set "biaix_humitat" = $1, "biaix_mostres" = $2, "biaix_calculat_el" = $3 where "codi" = $4',
    );
    expect(queries[0]?.parameters).toEqual([-2.5, 60, calculatEl, 'CC']);
  });

  it('ultimCalcul torna l’instant del darrer biaix, o null si no n’hi ha cap', async () => {
    const calculatEl = new Date('2026-11-20T06:15:00.000Z');
    const amb = fakeDb([{ calculat_el: calculatEl }]);
    expect(await createKyselyXemaRepository(amb.db).ultimCalcul()).toEqual(calculatEl);

    const buit = fakeDb([{ calculat_el: null }]);
    expect(await createKyselyXemaRepository(buit.db).ultimCalcul()).toBeNull();
  });
});

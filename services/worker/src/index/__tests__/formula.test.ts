import type { EfemeridesHora, PrevisioMeteoHora } from '@talaia/shared';

import {
  calculaIndex,
  calculaIndexHores,
  factorFoscor,
  factorLluna,
  factorNuvols,
  factorSol,
  franjaDe,
} from '../formula';

const HORA = '2026-10-16T22:00:00.000Z';

const meteo = (canvis: Partial<PrevisioMeteoHora> = {}): PrevisioMeteoHora => ({
  hora: HORA,
  nuvolsTotal: 0,
  nuvolsBaixos: 0,
  nuvolsMitjans: 0,
  nuvolsAlts: 0,
  humitat: 60,
  visibilitat: 30_000,
  temperatura: 8,
  puntRosada: 2,
  precipitacio: 0,
  probabilitatPrecipitacio: 0,
  ventVelocitat: 5,
  ventRafegues: 10,
  ventDireccio: 0,
  ...canvis,
});

const efemerides = (
  canvis: {
    crepuscle?: EfemeridesHora['crepuscle'];
    llunaAlcada?: number;
    illuminada?: number;
  } = {},
): EfemeridesHora => ({
  hora: HORA,
  sol: { alcada: -40, azimut: 0 },
  crepuscle: canvis.crepuscle ?? 'nit',
  lluna: {
    alcada: canvis.llunaAlcada ?? -10,
    azimut: 120,
    fraccioIlluminada: canvis.illuminada ?? 0,
    angleFase: 0,
    fase: 'nova',
  },
});

describe('fórmula de l’índex v1 (ADR-0018)', () => {
  it('cel ras, de nit, sense Lluna i un cel fosc de debò: 100', () => {
    const i = calculaIndex({ meteo: meteo(), efemerides: efemerides(), sqm: 21.5 });
    expect(i).toMatchObject({ valor: 100, franja: 'ras', foscorEstimada: false });
    expect(i.factors).toEqual({ nuvols: 1, sol: 1, foscor: 1, lluna: 1 });
  });

  it('l’exemple de l’ADR: Lluna mig il·luminada a 20°, foscor estimada → 63 · jus', () => {
    const i = calculaIndex({
      meteo: meteo(),
      efemerides: efemerides({ llunaAlcada: 20, illuminada: 0.5 }),
      sqm: null,
    });
    expect(i).toMatchObject({ valor: 63, franja: 'jus', foscorEstimada: true });
    expect(i.factors.lluna).toBe(0.67);
  });

  it('els núvols i el Sol multipliquen: tapat o de dia és 0, faci la nit que faci', () => {
    expect(
      calculaIndex({ meteo: meteo({ nuvolsBaixos: 100 }), efemerides: efemerides(), sqm: 22 })
        .valor,
    ).toBe(0);
    expect(
      calculaIndex({ meteo: meteo(), efemerides: efemerides({ crepuscle: 'dia' }), sqm: 22 }).valor,
    ).toBe(0);
    expect(
      calculaIndex({ meteo: meteo(), efemerides: efemerides({ crepuscle: 'civil' }), sqm: 22 })
        .valor,
    ).toBe(0);
    expect(
      calculaIndex({ meteo: meteo(), efemerides: efemerides({ crepuscle: 'nautic' }), sqm: 21.5 })
        .valor,
    ).toBe(50);
  });

  it('la capa que més tapa mana: els núvols alts compten la meitat', () => {
    expect(factorNuvols(meteo({ nuvolsAlts: 100 }))).toBe(0.5);
    expect(factorNuvols(meteo({ nuvolsMitjans: 100 }))).toBeCloseTo(0.15);
    expect(factorNuvols(meteo({ nuvolsBaixos: 30, nuvolsAlts: 80 }))).toBeCloseTo(0.6);
  });

  it('si plou, el cel és tapat', () => {
    expect(factorNuvols(meteo({ precipitacio: 0.4 }))).toBe(0);
    expect(factorNuvols(meteo({ precipitacio: 0.1 }))).toBe(1);
  });

  it('sense capes es fa servir la coberta total; sense cap dada, 0', () => {
    const senseCapes = { nuvolsBaixos: null, nuvolsMitjans: null, nuvolsAlts: null };
    expect(factorNuvols(meteo({ ...senseCapes, nuvolsTotal: 40 }))).toBeCloseTo(0.6);
    expect(factorNuvols(meteo({ ...senseCapes, nuvolsTotal: null }))).toBe(0);
  });

  it('la Lluna resta segons la llum i l’alçada; sota l’horitzó no compta', () => {
    expect(factorLluna(efemerides({ llunaAlcada: -5, illuminada: 1 }))).toBe(1);
    expect(factorLluna(efemerides({ llunaAlcada: 60, illuminada: 1 }))).toBe(0);
    expect(factorLluna(efemerides({ llunaAlcada: 15, illuminada: 1 }))).toBeCloseTo(0.5);
  });

  it('la foscor va de 17,5 (ciutat) a 21,5 (fosc), i sense SQM és l’estimada', () => {
    expect(factorFoscor(17)).toEqual({ valor: 0, estimada: false });
    expect(factorFoscor(19.5)).toEqual({ valor: 0.5, estimada: false });
    expect(factorFoscor(23)).toEqual({ valor: 1, estimada: false });
    expect(factorFoscor(null)).toEqual({ valor: 0.6, estimada: true });
  });

  it('el Sol segons el crepuscle', () => {
    expect(factorSol(efemerides({ crepuscle: 'astronomic' }))).toBe(1);
    expect(factorSol(efemerides({ crepuscle: 'nautic' }))).toBe(0.5);
  });

  it('franges: 0–39 tap, 40–69 jus, 70–100 ras', () => {
    expect([0, 39, 40, 69, 70, 100].map(franjaDe)).toEqual([
      'tap',
      'tap',
      'jus',
      'jus',
      'ras',
      'ras',
    ]);
  });

  it('no barreja hores: la previsió i les efemèrides han de ser del mateix instant', () => {
    expect(() =>
      calculaIndex({
        meteo: meteo(),
        efemerides: { ...efemerides(), hora: '2026-10-16T23:00:00.000Z' },
        sqm: null,
      }),
    ).toThrow(RangeError);
  });

  it('calculaIndexHores creua les hores que tenen totes dues i manté l’ordre de la previsió', () => {
    const h = (iso: string) => ({ ...meteo(), hora: iso });
    const e = (iso: string) => ({ ...efemerides(), hora: iso });
    const hores = calculaIndexHores(
      [h('2026-10-16T21:00:00.000Z'), h('2026-10-16T22:00:00.000Z'), h('2026-10-16T23:00:00.000Z')],
      [e('2026-10-16T22:00:00Z'), e('2026-10-16T21:00:00.000Z')],
      null,
    );
    expect(hores.map((i) => i.hora)).toEqual([
      '2026-10-16T21:00:00.000Z',
      '2026-10-16T22:00:00.000Z',
    ]);
  });
});

/**
 * Tests de l'índex v2 (TG-185, ADR-0038): els exemples de l'ADR amb efemèrides reals i les
 * propietats que l'ADR promet (la v2 és la v1 quan no hi ha motiu per canviar, la humitat només
 * fa baixar l'índex, la Lluna amagada només el fa pujar).
 */
import type { EfemeridesHora, FranjaCrepuscle, PrevisioMeteoHora } from '@talaia/shared';

import { efemeridesHores } from '../astronomia';
import { FORMULA_V1, calculaIndex, calculaIndexHores } from '../formula';
import { GRAUS_PERFIL, amagatPelRelleu, horitzoA } from '../horitzo';

const HORA_MS = 3_600_000;

const pla = (alcada: number): number[] => Array.from({ length: GRAUS_PERFIL }, () => alcada);

const meteo = (hora: string, canvis: Partial<PrevisioMeteoHora> = {}): PrevisioMeteoHora => ({
  hora,
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

const hores = (desDe: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(desDe) + i * HORA_MS).toISOString());

/** Pantà de Cavallers (`data/punts_observacio.geojson`): el punt de l'exemple de l'ADR-0038. */
const CAVALLERS = { lat: 42.589489, lon: 0.856611, altitud: 1756 };
const SQM_CAVALLERS = 21.71;

/**
 * El perfil d'horitzó real de Cavallers entre els azimuts 85° i 130° (la carena de l'est, per on
 * surt la Lluna a l'exemple). La resta del perfil és a 0°: no hi passa la Lluna en aquestes hores.
 */
const ARC_EST_CAVALLERS = [
  32, 32.5, 33, 33.2, 33, 33, 33, 33, 32.9, 32.8, 32.8, 32.8, 33.1, 33.1, 33, 32.9, 33, 33, 33.2,
  33.5, 33.7, 33.6, 34.4, 34.5, 35.4, 35.4, 35.5, 35.4, 35.1, 34.7, 34.3, 34.2, 34, 34.2, 34.2,
  34.3, 34.5, 34.6, 34.8, 34.8, 35.1, 35.4, 34.8, 34.4, 34.3, 33.9,
];
const perfilCavallers = (): number[] => {
  const perfil = pla(0);
  ARC_EST_CAVALLERS.forEach((alcada, i) => {
    perfil[85 + i] = alcada;
  });
  return perfil;
};

/** La v1 de l'ADR-0018 calculada a mà amb els pesos de `FORMULA_V1`, sense passar per la v2. */
const indexV1 = (m: PrevisioMeteoHora, e: EfemeridesHora, sqm: number | null): number => {
  const {
    capes,
    sol,
    sqm: escala,
    foscorEstimada,
    llunaAlcadaPlena,
    pesFoscor,
    pesLluna,
  } = FORMULA_V1;
  const nuvols =
    (m.precipitacio ?? 0) > FORMULA_V1.plujaMm
      ? 0
      : 1 -
        Math.max(
          capes.baixos * (m.nuvolsBaixos ?? 0),
          capes.mitjans * (m.nuvolsMitjans ?? 0),
          capes.alts * (m.nuvolsAlts ?? 0),
        ) /
          100;
  const foscor =
    sqm === null ? foscorEstimada : Math.min(1, Math.max(0, (sqm - escala.min) / escala.rang));
  const lluna =
    e.lluna.alcada <= 0
      ? 1
      : 1 - e.lluna.fraccioIlluminada * Math.min(1, e.lluna.alcada / llunaAlcadaPlena);
  return Math.round(100 * nuvols * sol[e.crepuscle] * (pesFoscor * foscor + pesLluna * lluna));
};

describe('exemples de l’ADR-0038 (TG-185)', () => {
  it('Cavallers, 30/11/2026 a les 02:00: la Lluna darrere la carena fa pujar l’índex de 75 a 87', () => {
    const [unaHora, duesHores] = efemeridesHores(CAVALLERS, hores('2026-11-30T01:00:00.000Z', 2));
    if (!unaHora || !duesHores) throw new Error('falten efemèrides');

    // La Lluna de l'exemple: il·luminada al 63 %, a 30,7° d'alçada i a l'azimut 100°, on la
    // carena fa 32,9°.
    expect(unaHora.crepuscle).toBe('nit');
    expect(unaHora.lluna.fraccioIlluminada).toBeCloseTo(0.63, 2);
    expect(unaHora.lluna.alcada).toBeCloseTo(30.7, 1);
    expect(unaHora.lluna.azimut).toBeCloseTo(100, 0);
    expect(horitzoA(perfilCavallers(), unaHora.lluna.azimut)).toBeCloseTo(32.9, 1);
    expect(amagatPelRelleu(unaHora.lluna, perfilCavallers())).toBe(true);

    const cel = meteo(unaHora.hora);
    const v1 = calculaIndex({ meteo: cel, efemerides: unaHora, sqm: SQM_CAVALLERS });
    const v2 = calculaIndex({
      meteo: cel,
      efemerides: unaHora,
      sqm: SQM_CAVALLERS,
      horitzo: perfilCavallers(),
    });
    expect(v1).toMatchObject({ valor: 75, franja: 'ras', versio: 2 });
    expect(v1.factors.lluna).toBeCloseTo(0.37, 2);
    expect(v2).toMatchObject({ valor: 87, franja: 'ras', versio: 2 });
    expect(v2.factors.lluna).toBeCloseTo(0.68, 2);
  });

  it('Cavallers, una hora més tard: la Lluna ja és sobre la carena i la v1 i la v2 donen 75', () => {
    const [efemerides] = efemeridesHores(CAVALLERS, ['2026-11-30T02:00:00.000Z']);
    if (!efemerides) throw new Error('falten efemèrides');

    // 40,9° contra 35,3° de carena a l'azimut de la Lluna.
    expect(efemerides.lluna.alcada).toBeCloseTo(40.9, 1);
    expect(horitzoA(perfilCavallers(), efemerides.lluna.azimut)).toBeCloseTo(35.3, 1);
    expect(amagatPelRelleu(efemerides.lluna, perfilCavallers())).toBe(false);

    const cel = meteo(efemerides.hora);
    expect(calculaIndex({ meteo: cel, efemerides, sqm: SQM_CAVALLERS }).valor).toBe(75);
    expect(
      calculaIndex({ meteo: cel, efemerides, sqm: SQM_CAVALLERS, horitzo: perfilCavallers() })
        .valor,
    ).toBe(75);
  });

  it('cel ras i fosc sense Lluna: 84 % d’humitat i un biaix de +8 la deixen al 92 % i l’índex a 86', () => {
    const efemerides: EfemeridesHora = {
      hora: '2026-11-30T23:00:00.000Z',
      sol: { alcada: -40, azimut: 0 },
      crepuscle: 'nit',
      lluna: { alcada: -10, azimut: 0, fraccioIlluminada: 0, angleFase: 0, fase: 'nova' },
    };
    const cel = meteo(efemerides.hora, { humitat: 84 });

    expect(calculaIndex({ meteo: cel, efemerides, sqm: 21.5 })).toMatchObject({
      valor: 100,
      humitatCorregida: false,
      factors: { humitat: 1 },
    });
    expect(calculaIndex({ meteo: cel, efemerides, sqm: 21.5, biaixHumitat: 8 })).toMatchObject({
      valor: 86,
      humitatCorregida: true,
      factors: { humitat: 0.86 },
    });
  });
});

describe('propietats de la v2 (TG-185)', () => {
  const CREPUSCLES: FranjaCrepuscle[] = ['dia', 'civil', 'nautic', 'astronomic', 'nit'];

  it('sense perfil i amb la humitat per sota del 85 %, la v2 dona exactament la v1', () => {
    const hora = '2026-11-30T23:00:00.000Z';
    let casos = 0;
    for (const crepuscle of CREPUSCLES)
      for (const llunaAlcada of [-5, 0, 10, 30, 60])
        for (const fraccioIlluminada of [0, 0.5, 1])
          for (const sqm of [null, 17, 19.3, 21.71, 22.5])
            for (const nuvols of [0, 35, 100])
              for (const humitat of [null, 20, 84.9]) {
                const efemerides: EfemeridesHora = {
                  hora,
                  sol: { alcada: -20, azimut: 0 },
                  crepuscle,
                  lluna: {
                    alcada: llunaAlcada,
                    azimut: 180,
                    fraccioIlluminada,
                    angleFase: 0,
                    fase: 'plena',
                  },
                };
                const m = meteo(hora, { nuvolsBaixos: nuvols, humitat });
                expect(calculaIndex({ meteo: m, efemerides, sqm }).valor).toBe(
                  indexV1(m, efemerides, sqm),
                );
                casos++;
              }
    expect(casos).toBe(5 * 5 * 3 * 5 * 3 * 3);
  });

  it('un perfil pla a 0° dona el mateix que no tenir perfil: la refracció sempre treu la Lluna', () => {
    // Un mes sencer d'hores reals a Cavallers, amb la Lluna sortint i ponent-se cada dia.
    const efemerides = efemeridesHores(CAVALLERS, hores('2026-11-15T00:00:00.000Z', 30 * 24));
    const previsio = efemerides.map((e) => meteo(e.hora));

    const sense = calculaIndexHores(previsio, efemerides, SQM_CAVALLERS);
    const amb = calculaIndexHores(previsio, efemerides, SQM_CAVALLERS, { horitzo: pla(0) });

    expect(amb).toEqual(sense);
    expect(efemerides.some((e) => e.lluna.alcada > 0 && e.lluna.alcada < 1)).toBe(true);
  });

  it('el relleu només pot fer pujar l’índex: amaga la Lluna, mai no fa més fosc ni més clar el Sol', () => {
    const efemerides = efemeridesHores(CAVALLERS, hores('2026-11-29T16:00:00.000Z', 3 * 24));
    const previsio = efemerides.map((e) => meteo(e.hora));

    const v1 = calculaIndexHores(previsio, efemerides, SQM_CAVALLERS);
    const v2 = calculaIndexHores(previsio, efemerides, SQM_CAVALLERS, {
      horitzo: perfilCavallers(),
    });

    let pugen = 0;
    v2.forEach((hora, i) => {
      const abans = v1[i];
      if (!abans) throw new Error(`falta l’hora ${i}`);
      expect(hora.valor).toBeGreaterThanOrEqual(abans.valor);
      expect(hora.factors.sol).toBe(abans.factors.sol);
      expect(hora.factors.foscor).toBe(abans.factors.foscor);
      if (hora.valor > abans.valor) pugen++;
    });
    // La Lluna surt cada nit per la carena de l'est i s'hi està amagada una estona.
    expect(pugen).toBeGreaterThan(0);
  });

  it('la humitat només pot fer baixar l’índex, i com més humitat (o més biaix), més baix', () => {
    const efemerides: EfemeridesHora = {
      hora: '2026-11-30T23:00:00.000Z',
      sol: { alcada: -40, azimut: 0 },
      crepuscle: 'nit',
      lluna: { alcada: 20, azimut: 90, fraccioIlluminada: 0.4, angleFase: 0, fase: 'creixent' },
    };
    const valor = (humitat: number | null, biaixHumitat: number | null = null) =>
      calculaIndex({
        meteo: meteo(efemerides.hora, { humitat }),
        efemerides,
        sqm: 20,
        biaixHumitat,
      }).valor;

    const senseHumitat = valor(null);
    let anterior = senseHumitat;
    for (let humitat = 0; humitat <= 100; humitat += 2.5) {
      const actual = valor(humitat);
      expect(actual).toBeLessThanOrEqual(anterior);
      anterior = actual;
    }
    // Al 100 % el cel val un 70 %: la calitja no l'esborra del tot.
    expect(valor(100)).toBe(Math.round(senseHumitat * 0.7));

    let ambBiaix = valor(80, -15);
    for (let biaix = -14; biaix <= 15; biaix++) {
      const actual = valor(80, biaix);
      expect(actual).toBeLessThanOrEqual(ambBiaix);
      ambBiaix = actual;
    }
  });

  it('calculaIndexHores aplica el perfil i el biaix a totes les hores', () => {
    const efemerides = efemeridesHores(CAVALLERS, hores('2026-11-30T00:00:00.000Z', 3));
    const previsio = efemerides.map((e) => meteo(e.hora, { humitat: 90 }));

    const resultat = calculaIndexHores(previsio, efemerides, SQM_CAVALLERS, {
      horitzo: perfilCavallers(),
      biaixHumitat: 5,
    });

    expect(resultat).toHaveLength(3);
    resultat.forEach((hora, i) => {
      const e = efemerides[i];
      const m = previsio[i];
      if (!e || !m) throw new Error(`falta l’hora ${i}`);
      expect(hora).toEqual(
        calculaIndex({
          meteo: m,
          efemerides: e,
          sqm: SQM_CAVALLERS,
          horitzo: perfilCavallers(),
          biaixHumitat: 5,
        }),
      );
      expect(hora.humitatCorregida).toBe(true);
      // 90 % + 5 = 95 %: H = 1 − 0,3 × 10/15 = 0,8.
      expect(hora.factors.humitat).toBeCloseTo(0.8, 10);
    });
  });

  it('un azimut que no és un nombre és un error', () => {
    expect(() => horitzoA(pla(0), Number.NaN)).toThrow(RangeError);
    expect(() => horitzoA(pla(0), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

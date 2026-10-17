/**
 * Fórmula de l'índex de visibilitat v1 (TG-98, ADR-0018). Codi pur: rep la previsió i les
 * efemèrides d'una hora i la foscor del punt, i torna l'índex de 0 a 100 amb els factors.
 *
 *   índex = 100 × núvols × sol × (0,6 · foscor + 0,4 · lluna)
 *
 * Els núvols i el Sol multipliquen: amb el cel tapat o de dia no hi ha res a veure, faci la
 * nit que faci. La foscor i la Lluna diuen com de bo és un cel ras.
 */
import type {
  EfemeridesHora,
  FactorsIndex,
  FranjaCrepuscle,
  FranjaIndex,
  IndexHora,
  PrevisioMeteoHora,
} from '@talaia/shared';

export const FORMULA_V1 = {
  pesFoscor: 0.6,
  pesLluna: 0.4,
  /** Quant tapa cada capa: els núvols baixos, del tot; els alts (cirrus), la meitat. */
  capes: { baixos: 1, mitjans: 0.85, alts: 0.5 },
  /** Precipitació a partir de la qual el cel es dona per tapat, en mm a l'hora. */
  plujaMm: 0.1,
  sol: { nit: 1, astronomic: 1, nautic: 0.5, civil: 0, dia: 0 } satisfies Record<
    FranjaCrepuscle,
    number
  >,
  /** Brillantor del cel (SQM, mag/arcsec²): 17,5 és cel de ciutat (0) i 21,5 o més, cel fosc (1). */
  sqm: { min: 17.5, rang: 4 },
  /** Foscor mentre no hi hagi la del mapa de contaminació lumínica (TG-97). */
  foscorEstimada: 0.6,
  /** Alçada a partir de la qual la Lluna fa tota la llum que pot, en graus. */
  llunaAlcadaPlena: 30,
  /** Primer valor de cada franja. */
  franges: { jus: 40, ras: 70 },
} as const;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const dues = (x: number): number => Math.round(x * 100) / 100;

export function franjaDe(valor: number): FranjaIndex {
  if (valor >= FORMULA_V1.franges.ras) return 'ras';
  if (valor >= FORMULA_V1.franges.jus) return 'jus';
  return 'tap';
}

/**
 * 1 − la capa que més tapa. Si la font no dona cap capa es fa servir la coberta total; sense cap
 * dada de núvols el factor és 0: millor no recomanar res que recomanar a cegues.
 */
export function factorNuvols(meteo: PrevisioMeteoHora): number {
  if ((meteo.precipitacio ?? 0) > FORMULA_V1.plujaMm) return 0;
  const { baixos, mitjans, alts } = FORMULA_V1.capes;
  const capes = [
    meteo.nuvolsBaixos === null ? null : baixos * meteo.nuvolsBaixos,
    meteo.nuvolsMitjans === null ? null : mitjans * meteo.nuvolsMitjans,
    meteo.nuvolsAlts === null ? null : alts * meteo.nuvolsAlts,
  ].filter((c): c is number => c !== null);
  const coberta = capes.length > 0 ? Math.max(...capes) : meteo.nuvolsTotal;
  if (coberta === null) return 0;
  return clamp01(1 - coberta / 100);
}

export const factorSol = (efemerides: EfemeridesHora): number =>
  FORMULA_V1.sol[efemerides.crepuscle];

/** Foscor del cel a partir de l'SQM del punt; sense SQM, el valor provisional. */
export function factorFoscor(sqm: number | null): { valor: number; estimada: boolean } {
  if (sqm === null) return { valor: FORMULA_V1.foscorEstimada, estimada: true };
  return { valor: clamp01((sqm - FORMULA_V1.sqm.min) / FORMULA_V1.sqm.rang), estimada: false };
}

/** 1 − la llum de la Lluna: la fracció il·luminada, a ple a partir de 30° d'alçada; 1 si és sota l'horitzó. */
export function factorLluna(efemerides: EfemeridesHora): number {
  const { alcada, fraccioIlluminada } = efemerides.lluna;
  if (alcada <= 0) return 1;
  return clamp01(1 - fraccioIlluminada * Math.min(1, alcada / FORMULA_V1.llunaAlcadaPlena));
}

export type EntradaIndex = {
  meteo: PrevisioMeteoHora;
  efemerides: EfemeridesHora;
  /** SQM del punt (TG-97), o `null` mentre no n'hi hagi. */
  sqm: number | null;
};

export function calculaIndex({ meteo, efemerides, sqm }: EntradaIndex): IndexHora {
  if (Date.parse(meteo.hora) !== Date.parse(efemerides.hora)) {
    throw new RangeError(
      `La previsió (${meteo.hora}) i les efemèrides (${efemerides.hora}) no són de la mateixa hora`,
    );
  }
  const foscor = factorFoscor(sqm);
  const factors: FactorsIndex = {
    nuvols: dues(factorNuvols(meteo)),
    sol: factorSol(efemerides),
    foscor: dues(foscor.valor),
    lluna: dues(factorLluna(efemerides)),
  };
  const cru =
    100 *
    factorNuvols(meteo) *
    factors.sol *
    (FORMULA_V1.pesFoscor * foscor.valor + FORMULA_V1.pesLluna * factorLluna(efemerides));
  const valor = Math.round(Math.min(100, Math.max(0, cru)));
  return {
    hora: meteo.hora,
    valor,
    franja: franjaDe(valor),
    factors,
    foscorEstimada: foscor.estimada,
  };
}

/** L'índex de cada hora que tenen alhora la previsió i les efemèrides, en l'ordre de la previsió. */
export function calculaIndexHores(
  meteo: PrevisioMeteoHora[],
  efemerides: EfemeridesHora[],
  sqm: number | null,
): IndexHora[] {
  const perHora = new Map(efemerides.map((e) => [Date.parse(e.hora), e]));
  return meteo.flatMap((m) => {
    const e = perHora.get(Date.parse(m.hora));
    return e ? [calculaIndex({ meteo: m, efemerides: e, sqm })] : [];
  });
}

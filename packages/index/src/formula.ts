/**
 * Fórmula de l'índex de visibilitat (TG-98 i TG-184). Codi pur: rep la previsió i les efemèrides
 * d'una hora i el que se sap del lloc (foscor, perfil d'horitzó, biaix de la humitat), i torna
 * l'índex de 0 a 100 amb els factors.
 *
 *   v1 (ADR-0018):  índex = 100 × núvols × sol × (0,6 · foscor + 0,4 · lluna)
 *   v2 (ADR-0038):  índex = 100 × núvols × sol × (0,6 · foscor + 0,4 · lluna) × humitat
 *
 * Els núvols i el Sol multipliquen: amb el cel tapat o de dia no hi ha res a veure, faci la
 * nit que faci. La foscor i la Lluna diuen com de bo és un cel ras. A la v2, la Lluna amagada pel
 * relleu fa la meitat de llum, i la humitat (corregida amb la XEMA quan es pot) fa pitjor
 * qualsevol cel ras a partir del 85 %. Sense perfil i amb la humitat per sota del 85 %, la v2
 * dona el mateix valor que la v1.
 */
import type {
  EfemeridesHora,
  FactorsIndex,
  FranjaCrepuscle,
  FranjaIndex,
  IndexHora,
  PrevisioMeteoHora,
} from '@talaia/shared';

import { amagatPelRelleu } from './horitzo';

/** Pesos i llindars de la v1 (ADR-0018). La v2 els conserva tots i n'hi afegeix (`FORMULA_V2`). */
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
  /** Foscor dels punts sense SQM: fora del mapa de contaminació lumínica (ADR-0020). */
  foscorEstimada: 0.6,
  /** Alçada a partir de la qual la Lluna fa tota la llum que pot, en graus. */
  llunaAlcadaPlena: 30,
  /** Primer valor de cada franja. */
  franges: { jus: 40, ras: 70 },
} as const;

/** Pesos i llindars de la v2 (ADR-0038): els de la v1 més la Lluna amagada i la humitat. */
export const FORMULA_V2 = {
  ...FORMULA_V1,
  /**
   * Part de la llum de la Lluna que queda quan el relleu la tapa: el cel de sobre continua
   * il·luminat, però desapareixen l'enlluernament i la part més brillant del cel.
   */
  llunaAmagada: 0.5,
  /** Humitat relativa (%) a partir de la qual el factor baixa, i fins on; i el factor al 100 %. */
  humitat: { inici: 85, fi: 100, minim: 0.7 },
} as const;

/** La versió de la fórmula que calcula aquest mòdul (`index_visibilitat.versio`). */
export const VERSIO_INDEX = 2;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const dues = (x: number): number => Math.round(x * 100) / 100;

export function franjaDe(valor: number): FranjaIndex {
  if (valor >= FORMULA_V2.franges.ras) return 'ras';
  if (valor >= FORMULA_V2.franges.jus) return 'jus';
  return 'tap';
}

/**
 * 1 − la capa que més tapa. Si la font no dona cap capa es fa servir la coberta total; sense cap
 * dada de núvols el factor és 0: millor no recomanar res que recomanar a cegues.
 */
export function factorNuvols(meteo: PrevisioMeteoHora): number {
  if ((meteo.precipitacio ?? 0) > FORMULA_V2.plujaMm) return 0;
  const { baixos, mitjans, alts } = FORMULA_V2.capes;
  const capes = [
    meteo.nuvolsBaixos === null ? null : baixos * meteo.nuvolsBaixos,
    meteo.nuvolsMitjans === null ? null : mitjans * meteo.nuvolsMitjans,
    meteo.nuvolsAlts === null ? null : alts * meteo.nuvolsAlts,
  ].filter((c): c is number => c !== null);
  const coberta = capes.length > 0 ? Math.max(...capes) : meteo.nuvolsTotal;
  if (coberta === null) return 0;
  return clamp01(1 - coberta / 100);
}

/**
 * Segons la franja de crepuscle (alçada geomètrica del Sol). No fa servir el perfil d'horitzó: el
 * cel s'enfosqueix quan l'aire de sobre entra a l'ombra de la Terra, i una muntanya no hi fa res.
 */
export const factorSol = (efemerides: EfemeridesHora): number =>
  FORMULA_V2.sol[efemerides.crepuscle];

/** Foscor del cel a partir de l'SQM del punt; sense SQM, el valor provisional. */
export function factorFoscor(sqm: number | null): { valor: number; estimada: boolean } {
  if (sqm === null) return { valor: FORMULA_V2.foscorEstimada, estimada: true };
  return { valor: clamp01((sqm - FORMULA_V2.sqm.min) / FORMULA_V2.sqm.rang), estimada: false };
}

/**
 * 1 − la llum de la Lluna: la fracció il·luminada, a ple a partir de 30° d'alçada; 1 si és sota
 * l'horitzó astronòmic. Amb un perfil d'horitzó (v2), si el relleu la tapa en fa la meitat
 * (`llunaAmagada`). Sense perfil, el mateix que la v1.
 */
export function factorLluna(
  efemerides: EfemeridesHora,
  horitzo: readonly number[] | null = null,
): number {
  const { alcada, fraccioIlluminada } = efemerides.lluna;
  if (alcada <= 0) return 1;
  const amagada = amagatPelRelleu(efemerides.lluna, horitzo);
  const llum =
    fraccioIlluminada *
    Math.min(1, alcada / FORMULA_V2.llunaAlcadaPlena) *
    (amagada ? FORMULA_V2.llunaAmagada : 1);
  return clamp01(1 - llum);
}

/**
 * Humitat relativa corregida amb el biaix de l'estació de la XEMA (ADR-0038), dins de [0, 100].
 * Sense humitat prevista, `null`; sense biaix, la prevista tal qual.
 */
export function humitatAmbBiaix(humitat: number | null, biaix: number | null): number | null {
  if (humitat === null) return null;
  if (biaix === null) return humitat;
  return Math.min(100, Math.max(0, humitat + biaix));
}

/**
 * La calitja i la rosada: 1 fins al 85 % d'humitat relativa i 0,7 al 100 %, en línia recta. No
 * arriba a 0: la boira, que sí que esborra el cel, ja és als núvols baixos d'Open-Meteo. Sense
 * dada d'humitat, 1 (no es castiga el que no se sap).
 */
export function factorHumitat(humitat: number | null): number {
  if (humitat === null) return 1;
  const { inici, fi, minim } = FORMULA_V2.humitat;
  return 1 - (1 - minim) * clamp01((humitat - inici) / (fi - inici));
}

/** El que la v2 sap d'un lloc a més de l'SQM. Tot és opcional: sense res, la v2 d'un lloc qualsevol. */
export type OpcionsIndex = {
  /**
   * Perfil d'horitzó del lloc (`punts_observacio.horitzo`, ADR-0022): 360 alçades aparents, la
   * posició 0 és el nord. `null` o absent: sense relleu, la Lluna com a la v1.
   */
  horitzo?: readonly number[] | null;
  /**
   * Biaix de la humitat de l'estació de la XEMA, en punts de % (`estacions_xema.biaix_humitat`), si
   * s'hi pot aplicar (`biaixAplicable` del worker). `null` o absent: la humitat d'Open-Meteo tal qual.
   */
  biaixHumitat?: number | null;
};

export type EntradaIndex = OpcionsIndex & {
  meteo: PrevisioMeteoHora;
  efemerides: EfemeridesHora;
  /** SQM del punt (`punts_observacio.sqm`, TG-97), o `null` si és fora del mapa. */
  sqm: number | null;
};

export function calculaIndex({
  meteo,
  efemerides,
  sqm,
  horitzo = null,
  biaixHumitat = null,
}: EntradaIndex): IndexHora {
  if (Date.parse(meteo.hora) !== Date.parse(efemerides.hora)) {
    throw new RangeError(
      `La previsió (${meteo.hora}) i les efemèrides (${efemerides.hora}) no són de la mateixa hora`,
    );
  }
  const nuvols = factorNuvols(meteo);
  const sol = factorSol(efemerides);
  const foscor = factorFoscor(sqm);
  const lluna = factorLluna(efemerides, horitzo);
  const humitat = factorHumitat(humitatAmbBiaix(meteo.humitat, biaixHumitat));
  const factors: FactorsIndex = {
    nuvols: dues(nuvols),
    sol,
    foscor: dues(foscor.valor),
    lluna: dues(lluna),
    humitat: dues(humitat),
  };
  const cru =
    100 *
    nuvols *
    sol *
    (FORMULA_V2.pesFoscor * foscor.valor + FORMULA_V2.pesLluna * lluna) *
    humitat;
  const valor = Math.round(Math.min(100, Math.max(0, cru)));
  return {
    hora: meteo.hora,
    valor,
    franja: franjaDe(valor),
    factors,
    foscorEstimada: foscor.estimada,
    humitatCorregida: biaixHumitat !== null && meteo.humitat !== null,
    versio: VERSIO_INDEX,
  };
}

/** L'índex de cada hora que tenen alhora la previsió i les efemèrides, en l'ordre de la previsió. */
export function calculaIndexHores(
  meteo: PrevisioMeteoHora[],
  efemerides: EfemeridesHora[],
  sqm: number | null,
  opcions: OpcionsIndex = {},
): IndexHora[] {
  const perHora = new Map(efemerides.map((e) => [Date.parse(e.hora), e]));
  return meteo.flatMap((m) => {
    const e = perHora.get(Date.parse(m.hora));
    return e ? [calculaIndex({ meteo: m, efemerides: e, sqm, ...opcions })] : [];
  });
}

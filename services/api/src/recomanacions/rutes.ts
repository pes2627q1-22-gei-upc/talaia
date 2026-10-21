/**
 * Estimació del temps en cotxe mentre no hi ha el servei de rutes de Mobilicat
 * (`docs/serveis-externs.md`): distància en línia recta, un factor de desviament per les
 * carreteres i una velocitat mitjana. Quan arribi Mobilicat, se substitueix aquesta implementació.
 */
export type EstimadorRutes = {
  /** Radi en línia recta (km, 1 decimal) que es cobreix amb `minuts` de cotxe. */
  radiKm(minuts: number): number;
  /** Minuts de cotxe (enter) per a una distància en línia recta en km. */
  minuts(distanciaKm: number): number;
};

/** Velocitat mitjana per carretera, en km/h. */
export const VELOCITAT_MITJANA = 60;
/** Quant més llarga és la carretera que la línia recta. */
export const FACTOR_DESVIAMENT = 1.3;

const arrodoneix1 = (x: number) => Math.round(x * 10) / 10;

export const rutesEnLiniaRecta: EstimadorRutes = {
  radiKm: (minuts) => arrodoneix1((minuts / 60) * (VELOCITAT_MITJANA / FACTOR_DESVIAMENT)),
  minuts: (distanciaKm) => Math.round(((distanciaKm * FACTOR_DESVIAMENT) / VELOCITAT_MITJANA) * 60),
};

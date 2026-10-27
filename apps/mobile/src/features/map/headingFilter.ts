/** Constant de temps del suavitzat: prou curta per seguir un gir, prou llarga per treure el soroll. */
const SMOOTHING_MS = 150;

/** Diferència més curta d'`a` a `b` en graus, a [-180, 180): de 350 a 10 són +20, no −340. */
export function headingDelta(a: number, b: number) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/**
 * Mitjana exponencial circular de la brúixola, que per si sola salta uns quants graus a cada
 * lectura. Depèn del temps entre lectures i no de quantes n'arriben, que varia per dispositiu.
 */
export function smoothHeading(previous: number | null, next: number, elapsedMs: number) {
  if (previous === null) return next;
  const weight = 1 - Math.exp(-Math.max(elapsedMs, 0) / SMOOTHING_MS);
  return (previous + weight * headingDelta(previous, next) + 360) % 360;
}

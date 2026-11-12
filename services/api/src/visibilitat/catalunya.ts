/**
 * Si una ubicació és dins de Catalunya (HU05, ADR-0031). Codi pur, sense base de dades.
 *
 * El contorn és el límit oficial de l'ICGC (la unió de les quatre províncies, 1:50.000),
 * simplificat a `TOLERANCIA_CONTORN_M` i generat per `data/scripts/build-contorn-catalunya.ts`
 * (`contornCatalunya.ts`): inclou l'enclavament de Llívia i deixa fora Andorra. Un lloc és dins si
 * és dins del contorn o a `MARGE_M` o menys de la ratlla. Com que el marge és més gran que la
 * tolerància, cap lloc de Catalunya no queda fora; a l'altra banda de la ratlla (o mar endins),
 * compten com a dins els llocs a menys d'1,3–1,7 km.
 */
import { CONTORN_CATALUNYA, TOLERANCIA_CONTORN_M } from './contornCatalunya';

/** Distància a la ratlla, cap enfora, que encara compta com a Catalunya. */
export const MARGE_M = 1_500;

// El marge ha de cobrir la simplificació: si no, un lloc de la ratlla podria quedar fora.
if (MARGE_M <= TOLERANCIA_CONTORN_M) {
  throw new Error(`MARGE_M (${MARGE_M}) ha de ser més gran que la tolerància del contorn`);
}

/** Latitud de referència per passar graus a metres: el centre de Catalunya (±2 % a tot el país). */
const LAT_REFERENCIA = 41.7;
const METRES_PER_GRAU_LON = 111_320 * Math.cos((LAT_REFERENCIA * Math.PI) / 180);
const METRES_PER_GRAU_LAT = 110_574;

/** Cada anell en metres locals, amb dues taules planes: `x` i `y`. */
const ANELLS = CONTORN_CATALUNYA.flat().map((anell) => ({
  x: Float64Array.from(anell, ([lon]) => lon * METRES_PER_GRAU_LON),
  y: Float64Array.from(anell, ([, lat]) => lat * METRES_PER_GRAU_LAT),
}));

/** La caixa del contorn amb el marge: el que en queda fora es descarta sense recórrer els anells. */
const CAIXA = ANELLS.reduce(
  (c, { x, y }) => ({
    minX: Math.min(c.minX, ...x.map((v) => v - MARGE_M)),
    maxX: Math.max(c.maxX, ...x.map((v) => v + MARGE_M)),
    minY: Math.min(c.minY, ...y.map((v) => v - MARGE_M)),
    maxY: Math.max(c.maxY, ...y.map((v) => v + MARGE_M)),
  }),
  { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
);

const metres = (lat: number, lon: number): [number, number] => [
  lon * METRES_PER_GRAU_LON,
  lat * METRES_PER_GRAU_LAT,
];

/** Cert si el punt és dins del contorn: regla parell-senar sobre tots els anells, forats inclosos. */
function dinsDelContorn(px: number, py: number): boolean {
  let dins = false;
  for (const { x, y } of ANELLS) {
    for (let i = 0, j = x.length - 1; i < x.length; j = i++) {
      const xi = x[i] as number;
      const yi = y[i] as number;
      const xj = x[j] as number;
      const yj = y[j] as number;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dins = !dins;
    }
  }
  return dins;
}

/** Distància mínima del punt a la ratlla, en metres. */
function distanciaALaRatlla(px: number, py: number): number {
  let minima2 = Infinity;
  for (const { x, y } of ANELLS) {
    for (let i = 0; i + 1 < x.length; i++) {
      const ax = x[i] as number;
      const ay = y[i] as number;
      const dx = (x[i + 1] as number) - ax;
      const dy = (y[i + 1] as number) - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      const ex = px - (ax + t * dx);
      const ey = py - (ay + t * dy);
      minima2 = Math.min(minima2, ex * ex + ey * ey);
    }
  }
  return Math.sqrt(minima2);
}

/** Distància de la ubicació a Catalunya en metres: 0 si és dins del contorn; si no, fins a la ratlla. */
export function distanciaACatalunyaM(lat: number, lon: number): number {
  const [px, py] = metres(lat, lon);
  return dinsDelContorn(px, py) ? 0 : distanciaALaRatlla(px, py);
}

/** Cert si la ubicació (graus WGS84) és dins de Catalunya o a `MARGE_M` o menys de la ratlla. */
export function isInCatalonia(lat: number, lon: number): boolean {
  const [px, py] = metres(lat, lon);
  if (px < CAIXA.minX || px > CAIXA.maxX || py < CAIXA.minY || py > CAIXA.maxY) return false;
  return dinsDelContorn(px, py) || distanciaALaRatlla(px, py) <= MARGE_M;
}

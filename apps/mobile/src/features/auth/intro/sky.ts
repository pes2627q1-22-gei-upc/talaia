/**
 * Geometria del cel de la intro, en coordenades del frame de la benvinguda del Figma (393 d'amplada).
 * Tot és determinista: la mateixa intro cada cop.
 */

/** Pseudoaleatori estable a partir d'un índex i una llavor. */
export function noise(index: number, salt: number) {
  'worklet';
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** On és l'estel de la torre (centre), d'on surten el feix, l'esclat i el salt final. */
export const TOWER_STAR_CENTER = { x: 55.7 + 108.9 + 31.9, y: 130 + 7.7 + 31.9 } as const;

/**
 * Cassiopea, la «W»: es veu tot l'any des de Catalunya. De Segin a Caph, amb les proporcions
 * aproximades del cel, a la part alta i esquerra, per on passa el feix.
 */
export const CASSIOPEIA = [
  { name: 'Segin', x: 34, y: 78 },
  { name: 'Ruchbah', x: 72, y: 112 },
  { name: 'Navi', x: 104, y: 86 },
  { name: 'Schedar', x: 136, y: 122 },
  { name: 'Caph', x: 172, y: 72 },
] as const;

/** Moment (0–1 del dibuix) en què cada estel de Cassiopea queda unit a l'anterior. */
export function constellationJoins(count: number = CASSIOPEIA.length) {
  return Array.from({ length: count - 1 }, (_, i) => (i + 1) / (count - 1));
}

/** Estels fugaços: un cada `METEOR.every` ms, en un lloc i una direcció diferents cada vegada. */
export const METEOR = { every: 5200, duration: 850, length: 120 } as const;

export type Meteor = { x: number; y: number; angle: number; progress: number };

/**
 * L'estel fugaç que toca en un moment del rellotge ambient, o `null` si ara no en passa cap.
 * Comencen a la part alta del cel i cauen cap a l'esquerra.
 */
export function meteorAt(clock: number, since: number): Meteor | null {
  'worklet';
  const elapsed = clock - since;
  if (elapsed < 0) return null;
  const index = Math.floor(elapsed / METEOR.every);
  const progress = (elapsed - index * METEOR.every) / METEOR.duration;
  if (progress > 1) return null;
  return {
    x: 150 + noise(index, 1) * 230,
    y: 20 + noise(index, 2) * 110,
    angle: 140 + noise(index, 3) * 25,
    progress,
  };
}

/** Raigs del salt a la velocitat de la llum: surten de l'estel de la torre en totes direccions. */
export const WARP_RAYS = Array.from({ length: 90 }, (_, i) => ({
  angle: noise(i, 4) * Math.PI * 2,
  radius: 20 + noise(i, 5) * 360,
  length: 0.4 + noise(i, 6) * 0.9,
}));

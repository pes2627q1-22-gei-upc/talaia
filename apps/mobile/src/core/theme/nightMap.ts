/**
 * Mode nit als mapes (ADR-0032). Les DOM components no veuen el context del tema: reben `night`, i
 * el contenidor de MapLibre passa a escala de grisos amb una capa vermella a sobre (`multiply`). Així
 * cada píxel queda amb la seva lluminositat només al canal vermell: les tessel·les de l'ICGC, el
 * relleu, els marcadors i els controls, sense tocar l'estil.
 *
 * La capa ha d'anar fora del contenidor filtrat: si no, el filtre també la passaria a gris.
 */
export const NIGHT_MAP_FILTER = 'grayscale(1)';

export const NIGHT_MAP_TINT = {
  inset: 0,
  background: '#FF0000',
  mixBlendMode: 'multiply',
  pointerEvents: 'none',
} as const;

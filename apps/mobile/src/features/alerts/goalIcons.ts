import type { ObjectiuObservacio } from '@talaia/shared';

/** Icones de cada fenomen (mockup 02), exportades del Figma: les comparteixen les dues pantalles d'alertes. */
export const GOAL_ICONS: Record<ObjectiuObservacio, number> = {
  pluja_estels: require('@/assets/images/explora/pluja-estels.svg'),
  eclipsi: require('@/assets/images/explora/eclipsi.svg'),
  via_lactia: require('@/assets/images/explora/via-lactia.svg'),
  posta_sol: require('@/assets/images/explora/posta-sol.svg'),
  sortida_sol: require('@/assets/images/explora/sortida-sol.svg'),
  cel_estrellat: require('@/assets/images/explora/cel-estrellat.svg'),
  constellacions: require('@/assets/images/explora/constellacions.svg'),
};

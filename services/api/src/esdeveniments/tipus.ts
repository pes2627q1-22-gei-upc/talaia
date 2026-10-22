import type { TipusFenomen } from '@talaia/shared';

/** Catàleg públic tancat acordat amb Aprop; la taula interna pot contenir altres tipus. */
export const TIPUS_FENOMEN = [
  'fase_llunar',
  'pluja_estels',
  'eclipsi_solar',
  'eclipsi_llunar',
  'conjuncio',
  'superlluna',
] as const satisfies readonly TipusFenomen[];

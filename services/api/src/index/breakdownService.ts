import type { DesglossamentIndex } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import type { PuntsRepository } from '../punts/puntsRepository';
import { defaultNight, nightWindow } from './night';

export type BreakdownService = {
  /**
   * El desglossament d'un punt publicat per a una nit (`YYYY-MM-DD`; si no se'n dona cap, la
   * d'avui). 404 `punt_not_found` si el punt no existeix o no és públic; 503 si la base de dades falla.
   */
  getBreakdown(puntId: string, night?: string): Promise<DesglossamentIndex>;
};

export type BreakdownServiceOptions = {
  /** Per fixar «avui» als tests. */
  now?: () => Date;
};

export function createBreakdownService(
  repository: Pick<PuntsRepository, 'findPublished' | 'indexHores'>,
  { now = () => new Date() }: BreakdownServiceOptions = {},
): BreakdownService {
  return {
    async getBreakdown(puntId, night = defaultNight(now())) {
      const { from, to } = nightWindow(night);
      let punt: Awaited<ReturnType<PuntsRepository['findPublished']>>;
      let hores: DesglossamentIndex['hores'] = [];
      try {
        punt = await repository.findPublished(puntId);
        if (punt) hores = await repository.indexHores(puntId, from, to);
      } catch (err) {
        console.error("[index] no s'ha pogut llegir el desglossament", err);
        throw new ApiError(
          503,
          'database_unavailable',
          "Ara mateix no es pot llegir l'índex de visibilitat",
        );
      }
      if (!punt) {
        throw new ApiError(404, 'punt_not_found', `No hi ha cap punt publicat amb id ${puntId}`);
      }
      // Només el que identifica el punt: la fitxa sencera (sqm, descripció, lat/lon…) és /punts/{id}.
      const { id, nom, municipi } = punt;
      return { punt: { id, nom, municipi }, nit: night, hores };
    },
  };
}

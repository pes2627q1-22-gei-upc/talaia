import type { DesglossamentIndex } from '@talaia/shared';
import { z } from 'zod';

import { ApiError } from '../middleware/errors';
import type { PuntsRepository } from '../punts/puntsRepository';
import type { IndexRepository } from './indexRepository';
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

const Uuid = z.guid();

export function createBreakdownService(
  punts: Pick<PuntsRepository, 'findPublished'>,
  index: IndexRepository,
  { now = () => new Date() }: BreakdownServiceOptions = {},
): BreakdownService {
  return {
    async getBreakdown(puntId, night = defaultNight(now())) {
      // Un id que no és un UUID no pot ser de cap punt: 404 sense molestar la base de dades.
      if (!Uuid.safeParse(puntId).success) throw notFound(puntId);
      let breakdown: DesglossamentIndex | undefined;
      try {
        const punt = await punts.findPublished(puntId);
        if (punt) {
          breakdown = {
            punt,
            nit: night,
            hores: await index.listHours(puntId, nightWindow(night)),
          };
        }
      } catch (err) {
        console.error("[index] no s'ha pogut llegir el desglossament", err);
        throw new ApiError(
          503,
          'database_unavailable',
          "Ara mateix no es pot llegir l'índex de visibilitat",
        );
      }
      if (!breakdown) throw notFound(puntId);
      return breakdown;
    },
  };
}

const notFound = (puntId: string) =>
  new ApiError(404, 'punt_not_found', `No hi ha cap punt publicat amb id ${puntId}`);

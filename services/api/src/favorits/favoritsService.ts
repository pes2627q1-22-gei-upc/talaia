import type { Favorit } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { iniciHora } from '../punts/puntsService';
import type { FavoritsRepository } from './favoritsRepository';

/**
 * Els favorits del perfil `perfilId` (HU25–HU27, TG-169). El perfil surt sempre del JWT: la ruta
 * el pren de `requireUser`, mai de la petició.
 */
export type FavoritsService = {
  /** Els favorits amb punts publicats, els més nous primer, amb l'índex de l'hora en curs. */
  list(perfilId: string): Promise<Favorit[]>;
  /**
   * Desa el punt (idempotent): `created` diu si és nou. 404 `punt_not_found` si el punt no existeix
   * o no és `PUBLICAT`.
   */
  add(perfilId: string, puntId: string): Promise<{ created: boolean; favorit: Favorit }>;
  /** Treu el punt dels favorits (idempotent: si no hi era, no passa res). */
  remove(perfilId: string, puntId: string): Promise<void>;
};

export type FavoritsServiceOptions = {
  /** Per fixar l'hora en curs als tests. */
  now?: () => Date;
};

/** Un error de la base de dades arriba al client com a 503, i el detall queda al log. */
async function fromDatabase<T>(context: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error(`[favorits] ${context}`, err);
    throw new ApiError(503, 'database_unavailable', 'Ara mateix no es poden llegir els favorits');
  }
}

export function createFavoritsService(
  repository: FavoritsRepository,
  { now = () => new Date() }: FavoritsServiceOptions = {},
): FavoritsService {
  return {
    list(perfilId) {
      return fromDatabase("no s'han pogut llegir els favorits", () =>
        repository.list(perfilId, iniciHora(now())),
      );
    },

    async add(perfilId, puntId) {
      const result = await fromDatabase(`no s'ha pogut desar el favorit ${puntId}`, () =>
        repository.add(perfilId, puntId, iniciHora(now())),
      );
      if (!result) {
        throw new ApiError(404, 'punt_not_found', `No hi ha cap punt publicat amb id ${puntId}`);
      }
      return result;
    },

    remove(perfilId, puntId) {
      return fromDatabase(`no s'ha pogut treure el favorit ${puntId}`, () =>
        repository.remove(perfilId, puntId),
      );
    },
  };
}

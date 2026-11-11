import type { PuntAdmin, PuntAdminCanvis, PuntAdminNou } from '@talaia/shared';

import { SLUG_PUNT_REFERENCIA } from '../esdeveniments/esdevenimentsRepository';
import { ApiError } from '../middleware/errors';
import type { PuntsAdminRepository } from './puntsAdminRepository';
import type { PuntsService } from './puntsService';

/** Gestió del catàleg des de la web d'administració (HU39, TG-174). */
export type PuntsAdminService = {
  /** Tots els punts, en qualsevol estat. */
  list(): Promise<PuntAdmin[]>;
  /** 404 `punt_not_found` si no existeix. */
  get(id: string): Promise<PuntAdmin>;
  /** Un punt `OFICIAL`, `PUBLICAT` si no es diu el contrari. 409 `slug_already_exists`. */
  create(nou: PuntAdminNou): Promise<PuntAdmin>;
  /**
   * Edita o retira (`estat: 'DESACTIVAT'`) un punt. 404 `punt_not_found`; 409
   * `reference_point_required` si es vol retirar el punt de referència de `/esdeveniments`.
   */
  update(id: string, canvis: PuntAdminCanvis): Promise<PuntAdmin>;
};

export type PuntsAdminServiceDeps = {
  /**
   * El document del mapa en memòria (ADR-0012): es descarta després de cada canvi, perquè un punt
   * retirat deixi de sortir a `/punts` a la petició següent.
   */
  mapa: Pick<PuntsService, 'invalidateMapDocument'>;
};

const notFound = (id: string) =>
  new ApiError(404, 'punt_not_found', `No hi ha cap punt amb id ${id}`);

/** Un error de la base de dades arriba al client com a 503, i el detall queda al log. */
async function fromDatabase<T>(context: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error(`[admin/punts] ${context}`, err);
    throw new ApiError(
      503,
      'database_unavailable',
      'Ara mateix no es pot accedir al catàleg de punts',
    );
  }
}

export function createPuntsAdminService(
  repository: PuntsAdminRepository,
  { mapa }: PuntsAdminServiceDeps,
): PuntsAdminService {
  return {
    list() {
      return fromDatabase("no s'ha pogut llegir el catàleg", () => repository.list());
    },

    async get(id) {
      const punt = await fromDatabase(`no s'ha pogut llegir el punt ${id}`, () =>
        repository.find(id),
      );
      if (!punt) throw notFound(id);
      return punt;
    },

    async create(nou) {
      const punt = await fromDatabase(`no s'ha pogut crear el punt ${nou.slug}`, () =>
        repository.create({ ...nou, estat: nou.estat ?? 'PUBLICAT' }),
      );
      if (!punt) {
        throw new ApiError(409, 'slug_already_exists', `Ja hi ha un punt amb l'slug ${nou.slug}`);
      }
      mapa.invalidateMapDocument();
      return punt;
    },

    async update(id, canvis) {
      if (canvis.estat === 'DESACTIVAT') {
        const actual = await fromDatabase(`no s'ha pogut llegir el punt ${id}`, () =>
          repository.find(id),
        );
        if (!actual) throw notFound(id);
        // Sense aquest punt publicat, `/esdeveniments` (Aprop) respondria 503 (ADR-0026).
        if (actual.slug === SLUG_PUNT_REFERENCIA) {
          throw new ApiError(
            409,
            'reference_point_required',
            `${actual.nom} és el punt de referència del calendari d'Aprop i no es pot retirar`,
          );
        }
      }
      const punt = await fromDatabase(`no s'ha pogut actualitzar el punt ${id}`, () =>
        repository.update(id, canvis),
      );
      if (!punt) throw notFound(id);
      mapa.invalidateMapDocument();
      return punt;
    },
  };
}

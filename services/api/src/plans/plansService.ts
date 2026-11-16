import type { Pla, PlaNou, QuanPlans } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { puntLocalitzat } from '../punts/localitzacio';
import type { PlaAmbTextos, PlansRepository } from './plansRepository';

/**
 * Els plans del perfil `perfilId` (HU12, TG-156). El perfil surt sempre del JWT: la ruta el pren de
 * `requireUser`, mai de la petició. El nom del punt segueix `acceptLanguage` (ca, es, en; reserva ca).
 */
export type PlansService = {
  /** 422 `punt_not_found` o `esdeveniment_not_found` si les referències no són vàlides. */
  create(perfilId: string, pla: PlaNou, acceptLanguage?: string): Promise<Pla>;
  list(perfilId: string, quan?: QuanPlans, acceptLanguage?: string): Promise<Pla[]>;
  /** 404 `plan_not_found` si no existeix o és d'un altre usuari (no se'n revela l'existència). */
  get(perfilId: string, id: string, acceptLanguage?: string): Promise<Pla>;
};

export type PlansServiceOptions = {
  /** Per fixar l'hora actual als tests (`?quan=`). */
  now?: () => Date;
};

/** Un error de la base de dades arriba al client com a 503, i el detall queda al log. */
async function fromDatabase<T>(context: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error(`[plans] ${context}`, err);
    throw new ApiError(503, 'database_unavailable', 'Ara mateix no es poden llegir els plans');
  }
}

function localitzat({ punt, ...pla }: PlaAmbTextos, acceptLanguage?: string): Pla {
  return { ...pla, punt: puntLocalitzat(punt, acceptLanguage) };
}

export function createPlansService(
  repository: PlansRepository,
  { now = () => new Date() }: PlansServiceOptions = {},
): PlansService {
  return {
    async create(perfilId, pla, acceptLanguage) {
      const result = await fromDatabase("no s'ha pogut crear el pla", () =>
        repository.create(perfilId, pla),
      );
      if (!result.ok) {
        throw result.reason === 'punt_not_found'
          ? new ApiError(422, 'punt_not_found', `No hi ha cap punt publicat amb id ${pla.puntId}`)
          : new ApiError(
              422,
              'esdeveniment_not_found',
              `No hi ha cap esdeveniment amb id ${pla.esdevenimentId}`,
            );
      }
      return localitzat(result.pla, acceptLanguage);
    },

    async list(perfilId, quan, acceptLanguage) {
      const plans = await fromDatabase("no s'han pogut llegir els plans", () =>
        repository.list(perfilId, quan, now()),
      );
      return plans.map((pla) => localitzat(pla, acceptLanguage));
    },

    async get(perfilId, id, acceptLanguage) {
      const pla = await fromDatabase(`no s'ha pogut llegir el pla ${id}`, () =>
        repository.findById(perfilId, id),
      );
      if (!pla) throw new ApiError(404, 'plan_not_found', 'No tens cap pla amb aquest id');
      return localitzat(pla, acceptLanguage);
    },
  };
}

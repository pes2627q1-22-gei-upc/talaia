import type { Pla, PlaNou, QuanPlans } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { puntLocalitzat } from '../punts/localitzacio';
import { MAX_PLANS_FUTURS, type PlaAmbTextos, type PlansRepository } from './plansRepository';

/**
 * Els plans del perfil `perfilId` (HU12, TG-156). El perfil surt sempre del JWT: la ruta el pren de
 * `requireUser`, mai de la petició. El nom del punt segueix `acceptLanguage` (ca, es, en; reserva ca).
 */
export type PlansService = {
  /**
   * 422 `punt_not_found` o `event_not_found` si les referències no són vàlides; 409
   * `plan_limit_reached` (massa plans pendents) o `plan_already_exists` (mateix punt i hora).
   */
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

function createError(
  reason: 'punt_not_found' | 'event_not_found' | 'limit' | 'duplicate',
  pla: PlaNou,
): ApiError {
  switch (reason) {
    case 'punt_not_found':
      return new ApiError(422, 'punt_not_found', `No hi ha cap punt publicat amb id ${pla.puntId}`);
    case 'event_not_found':
      return new ApiError(
        422,
        'event_not_found',
        `No hi ha cap esdeveniment amb id ${pla.esdevenimentId}`,
      );
    case 'limit':
      return new ApiError(
        409,
        'plan_limit_reached',
        `Com a molt pots tenir ${MAX_PLANS_FUTURS} plans pendents`,
      );
    case 'duplicate':
      return new ApiError(
        409,
        'plan_already_exists',
        'Ja tens un pla en aquest punt a la mateixa hora',
      );
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
        repository.create(perfilId, pla, now()),
      );
      if (!result.ok) throw createError(result.reason, pla);
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

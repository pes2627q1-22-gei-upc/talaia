import type { Pla, PlaCanvis, PlaNou, QuanPlans } from '@talaia/shared';

import { defaultNight, nightWindow } from '../index/night';
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
  /** Desa el vincle al calendari del mòbil; 404 si el pla no és del perfil. */
  setCalendarEvent(perfilId: string, id: string, eventId: string): Promise<void>;
  /**
   * Modifica un pla propi (HU14, TG-161) i el retorna com el GET. 404 `plan_not_found`; 409
   * `plan_finished` o `plan_already_exists`; 422 `punt_not_found` o `event_not_found`; 400
   * `validation_error` si el pla resultant no té el final després de l'inici o si l'inici nou ja ha
   * passat.
   */
  update(perfilId: string, id: string, canvis: PlaCanvis, acceptLanguage?: string): Promise<Pla>;
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
  pla: Pick<PlaNou, 'puntId' | 'esdevenimentId'>,
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

const planNotFound = () => new ApiError(404, 'plan_not_found', 'No tens cap pla amb aquest id');

/**
 * Quan s'acaba un pla: `dataHoraFi` o, si no en té, el migdia de després de la nit de l'inici (com
 * `fiEfectiu` a l'SQL de `plansRepository`).
 */
export function fiEfectiu(pla: Pick<Pla, 'dataHoraInici' | 'dataHoraFi'>): Date {
  return pla.dataHoraFi
    ? new Date(pla.dataHoraFi)
    : nightWindow(defaultNight(new Date(pla.dataHoraInici))).to;
}

/**
 * Les regles de temps d'una edició, sobre el pla actual amb els canvis aplicats: un pla acabat no es
 * toca (409), un inici nou no pot haver passat (un pla començat es pot desar si no es mou l'inici) i
 * el final ha de ser posterior a l'inici resultant (400). `undefined` si es pot desar.
 */
export function validaCanvis(
  actual: Pick<Pla, 'dataHoraInici' | 'dataHoraFi'>,
  canvis: PlaCanvis,
  ara: Date,
): ApiError | undefined {
  if (fiEfectiu(actual) < ara) {
    return new ApiError(409, 'plan_finished', 'Aquest pla ja ha acabat: no es pot modificar');
  }
  const inici = Date.parse(canvis.dataHoraInici ?? actual.dataHoraInici);
  const iniciMogut =
    canvis.dataHoraInici !== undefined && inici !== Date.parse(actual.dataHoraInici);
  if (iniciMogut && inici < +ara) {
    return new ApiError(400, 'validation_error', 'dataHoraInici no pot ser una hora passada');
  }
  const fi = canvis.dataHoraFi === undefined ? actual.dataHoraFi : canvis.dataHoraFi;
  if (fi !== null && Date.parse(fi) <= inici) {
    return new ApiError(400, 'validation_error', 'dataHoraFi ha de ser posterior a dataHoraInici');
  }
  return undefined;
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
      if (!pla) throw planNotFound();
      return localitzat(pla, acceptLanguage);
    },

    async setCalendarEvent(perfilId, id, eventId) {
      const updated = await fromDatabase('no s’ha pogut vincular el calendari', () =>
        repository.setCalendarEvent(perfilId, id, eventId),
      );
      if (!updated) throw planNotFound();
    },

    async update(perfilId, id, canvis, acceptLanguage) {
      const actual = await fromDatabase(`no s'ha pogut llegir el pla ${id}`, () =>
        repository.findById(perfilId, id),
      );
      if (!actual) throw planNotFound();
      const error = validaCanvis(actual, canvis, now());
      if (error) throw error;

      const result = await fromDatabase(`no s'ha pogut modificar el pla ${id}`, () =>
        repository.update(perfilId, id, canvis),
      );
      if (result.ok) return localitzat(result.pla, acceptLanguage);
      if (result.reason === 'not_found') throw planNotFound();
      throw createError(result.reason, {
        puntId: canvis.puntId ?? actual.punt.id,
        esdevenimentId:
          canvis.esdevenimentId === undefined ? actual.esdevenimentId : canvis.esdevenimentId,
      });
    },
  };
}

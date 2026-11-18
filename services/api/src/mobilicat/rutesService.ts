import type { AlternativaRuta, RutesPunt, TramRuta } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import {
  MobilicatRoutesError,
  type MobilicatRoutesClient,
  type MobilicatRoute,
} from './routesClient';
import type { PuntsRepository } from '../punts/puntsRepository';

const MODES = ['WALK', 'BIKE', 'BIKE_SHARE', 'CAR', 'PUBLIC_TRANSPORT'] as const;
const LIMIT = 5;

export type RutesService = {
  getRutes(puntId: string, origen: { lat: number; lon: number }): Promise<RutesPunt>;
};

export type RutesServiceOptions = {
  /** Per fixar l'instant de sortida als tests. */
  now?: () => Date;
};

function alternativaDe(route: MobilicatRoute): AlternativaRuta {
  return {
    sortida: route.startTime,
    arribada: route.endTime,
    duradaSegons: route.durationSeconds,
    distanciaMetres: route.distanceMeters,
    transbordaments: route.transfers,
    trams: route.stretches.map(
      ({ sequence, mode, transitMode, lineShortName, lineLongName, agencyName }): TramRuta => ({
        sequence,
        mode,
        ...(transitMode === undefined ? {} : { transitMode }),
        ...(lineShortName === undefined ? {} : { lineShortName }),
        ...(lineLongName === undefined ? {} : { lineLongName }),
        ...(agencyName === undefined ? {} : { agencyName }),
      }),
    ),
  };
}

export function createRutesService(
  repository: Pick<PuntsRepository, 'findPublished'>,
  client: MobilicatRoutesClient,
  { now = () => new Date() }: RutesServiceOptions = {},
): RutesService {
  return {
    async getRutes(puntId, origen) {
      let punt: Awaited<ReturnType<PuntsRepository['findPublished']>>;
      try {
        punt = await repository.findPublished(puntId);
      } catch (error) {
        console.error(`[rutes] no s'ha pogut llegir el punt ${puntId}`, error);
        throw new ApiError(
          503,
          'database_unavailable',
          'Ara mateix no es pot llegir el catàleg de punts',
        );
      }
      if (!punt) {
        throw new ApiError(404, 'punt_not_found', `No hi ha cap punt publicat amb id ${puntId}`);
      }

      let routes: MobilicatRoute[];
      try {
        routes = await client.getRoutes({
          from: origen,
          to: { lat: punt.lat, lon: punt.lon },
          time: now().toISOString(),
          timePreference: 'DEPART_AT',
          modes: [...MODES],
          limit: LIMIT,
        });
      } catch (error) {
        if (!(error instanceof MobilicatRoutesError)) throw error;
        console.error('[rutes] Mobilicat no està disponible', error);
        return { estat: 'no_disponible', destacada: null, alternatives: [] };
      }

      const alternatives = routes.map(alternativaDe);
      const [destacada] = alternatives;
      if (!destacada) return { estat: 'sense_rutes', destacada: null, alternatives };
      return { estat: 'disponible', destacada, alternatives };
    },
  };
}

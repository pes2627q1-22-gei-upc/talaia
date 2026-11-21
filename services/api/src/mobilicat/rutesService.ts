import { MODES_RUTA, type AlternativaRuta, type RutesPunt, type TramRuta } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import {
  MobilicatRoutesError,
  type MobilicatRoutesClient,
  type MobilicatRoute,
} from './routesClient';
import type { PuntsRepository } from '../punts/puntsRepository';

const LIMIT = 5;
const PRECISIO_COORDENADES = 3;
export const MOBILICAT_INTERVAL_MINIM_MS = 5_000;

/** Minimitza la precisió de la ubicació enviada a Mobilicat (aproximadament 100 m). */
function arrodoneixCoordenada(value: number): number {
  const escala = 10 ** PRECISIO_COORDENADES;
  return Math.round(value * escala) / escala;
}

export type RutesService = {
  getRutes(
    puntId: string,
    origen: { lat: number; lon: number },
    usuariId: string,
  ): Promise<RutesPunt>;
};

export type RutesServiceOptions = {
  /** Per fixar l'instant de sortida als tests. */
  now?: () => Date;
};

function alternativaDe(route: MobilicatRoute): AlternativaRuta {
  return {
    sortida: new Date(route.startTime).toISOString(),
    arribada: new Date(route.endTime).toISOString(),
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
  /** Mobilicat veu la instància compartida de Talaia com un únic client. */
  let darreraConsultaMobilicat: number | undefined;
  const darreresConsultesUsuari = new Map<string, number>();

  const reservaConsulta = (usuariId: string, instant: number) => {
    const esperaUsuari =
      (darreresConsultesUsuari.get(usuariId) ?? -Infinity) + MOBILICAT_INTERVAL_MINIM_MS - instant;
    const esperaGlobal =
      (darreraConsultaMobilicat ?? -Infinity) + MOBILICAT_INTERVAL_MINIM_MS - instant;
    const espera = Math.max(esperaUsuari, esperaGlobal);

    if (espera > 0) {
      const segons = Math.max(1, Math.ceil(espera / 1000));
      throw new ApiError(
        429,
        'too_many_requests',
        `Cal esperar ${segons} s abans de tornar a consultar una ruta`,
        { 'Retry-After': String(segons) },
      );
    }

    // El límit global fa que només calgui conservar l'usuari de l'última finestra de 5 s.
    for (const [id, darreraConsulta] of darreresConsultesUsuari) {
      if (instant - darreraConsulta >= MOBILICAT_INTERVAL_MINIM_MS) {
        darreresConsultesUsuari.delete(id);
      }
    }
    darreresConsultesUsuari.set(usuariId, instant);
    darreraConsultaMobilicat = instant;
  };

  return {
    async getRutes(puntId, origen, usuariId) {
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

      const instantConsulta = now();
      reservaConsulta(usuariId, instantConsulta.getTime());

      let routes: MobilicatRoute[];
      try {
        routes = await client.getRoutes({
          from: {
            lat: arrodoneixCoordenada(origen.lat),
            lon: arrodoneixCoordenada(origen.lon),
          },
          to: { lat: punt.lat, lon: punt.lon },
          time: instantConsulta.toISOString(),
          timePreference: 'DEPART_AT',
          modes: [...MODES_RUTA],
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

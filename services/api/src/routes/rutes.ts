import type { RutesPunt } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { RutesService } from '../mobilicat/rutesService';
import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import { numeroAmb, senseBuits, type Numero } from './query';

const queryShape = (numero: Numero) =>
  z.object({
    lat: numero('lat ha de ser un número entre -90 i 90', { min: -90, max: 90 }).meta({
      description:
        'Latitud de l’origen de l’usuari (WGS84); Talaia l’arrodoneix a tres decimals abans d’enviar-la a Mobilicat',
      example: 41.3851,
    }),
    lon: numero('lon ha de ser un número entre -180 i 180', { min: -180, max: 180 }).meta({
      description:
        'Longitud de l’origen de l’usuari (WGS84); Talaia l’arrodoneix a tres decimals abans d’enviar-la a Mobilicat',
      example: 2.1734,
    }),
  });

const QueryDoc = queryShape(numeroAmb(z.number));
const QuerySchema: z.ZodType<{ lat: number; lon: number }> = z.preprocess(
  senseBuits,
  queryShape(numeroAmb(z.coerce.number)),
);

const ParamsSchema = z.object({
  id: z.uuid({ error: 'id ha de ser un UUID' }).meta({
    description: 'Id del punt (`properties.id` del GeoJSON del mapa)',
  }),
});

const TramRutaSchema = z.object({
  sequence: z.number().int().nonnegative(),
  mode: z.enum(['WALK', 'BIKE', 'BIKE_SHARE', 'CAR', 'PUBLIC_TRANSPORT']),
  transitMode: z.string().optional(),
  lineShortName: z.string().nullable().optional(),
  lineLongName: z.string().nullable().optional(),
  agencyName: z.string().nullable().optional(),
});

const AlternativaRutaSchema = z.object({
  sortida: z.iso.datetime({ offset: true }).meta({
    description: 'Instant ISO 8601 normalitzat a UTC (sufix Z)',
  }),
  arribada: z.iso.datetime({ offset: true }).meta({
    description: 'Instant ISO 8601 normalitzat a UTC (sufix Z)',
  }),
  duradaSegons: z.number().int().nonnegative(),
  distanciaMetres: z.number().int().nonnegative(),
  transbordaments: z.number().int().nonnegative(),
  trams: z.array(TramRutaSchema).min(1),
});

const RutesPuntSchema: z.ZodType<RutesPunt> = z
  .object({
    estat: z.enum(['disponible', 'sense_rutes', 'no_disponible']),
    destacada: AlternativaRutaSchema.nullable(),
    alternatives: z.array(AlternativaRutaSchema).max(5),
  })
  .meta({ id: 'RutesPunt' });

registry.registerPath({
  method: 'get',
  path: '/punts/{id}/rutes',
  tags: ['Punts'],
  summary: 'Alternatives de ruta des de la ubicació de l’usuari fins a un punt',
  description:
    'Consulta Mobilicat amb sortida a l’instant actual, els cinc modes disponibles i fins a cinc alternatives. `destacada` és la primera alternativa retornada (la que arriba abans amb `DEPART_AT`). `sense_rutes` és una resposta vàlida sense alternatives; `no_disponible` indica que Mobilicat no ha respost o ha retornat un error. La fallada del servei de rutes no afecta la fitxa `GET /punts/{id}`. Mobilicat demana almenys cinc segons entre consultes del mateix dispositiu.',
  request: {
    params: ParamsSchema,
    query: QueryDoc,
  },
  responses: {
    200: {
      description: 'Alternatives de ruta o estat de disponibilitat del servei extern',
      headers: z.object({
        'Cache-Control': z.string().meta({ example: 'private, no-store' }),
      }),
      content: { 'application/json': { schema: RutesPuntSchema } },
    },
    400: {
      description: '`id`, `lat` o `lon` invàlids (`validation_error`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'No hi ha cap punt publicat amb aquest `id` (`punt_not_found`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description: 'Sense accés a la base de dades (`database_unavailable`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

/** Sense servei (no hi ha `DATABASE_URL`), la ruta respon `503 database_unavailable`. */
export function createRutesRouter(service: RutesService | undefined): Router {
  const router = Router();

  router.get('/:id/rutes', async (req, res) => {
    const { id } = ParamsSchema.parse(req.params);
    const origen = QuerySchema.parse(req.query);
    if (!service) {
      throw new ApiError(
        503,
        'database_unavailable',
        "L'API no té DATABASE_URL: no es pot consultar el punt de destinació",
      );
    }
    const resposta = await service.getRutes(id, origen);
    res.set('Cache-Control', 'private, no-store');
    res.json(resposta);
  });

  return router;
}

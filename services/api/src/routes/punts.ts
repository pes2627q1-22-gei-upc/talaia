import type { PuntsMapaGeoJson } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import type { PuntsService } from '../punts/puntsService';

const Lon = z.number().min(-180).max(180);
const Lat = z.number().min(-90).max(90);

/** `minLon,minLat,maxLon,maxLat` en graus WGS84. */
export const BboxSchema = z
  .string()
  .transform((text) =>
    text.split(',').map((part) => (part.trim() === '' ? Number.NaN : Number(part))),
  )
  .pipe(
    z.tuple([Lon, Lat, Lon, Lat], {
      error: 'bbox ha de tenir 4 números: minLon,minLat,maxLon,maxLat',
    }),
  )
  .refine(([minLon, minLat, maxLon, maxLat]) => minLon <= maxLon && minLat <= maxLat, {
    error: 'bbox: el mínim ha de ser menor o igual que el màxim',
  })
  .transform(([minLon, minLat, maxLon, maxLat]) => ({ minLon, minLat, maxLon, maxLat }));

const QuerySchema = z.object({ bbox: BboxSchema.optional() });

// Tipat amb el tipus compartit: si l'esquema i @talaia/shared divergeixen, no compila.
const IndexSchema = z.object({
  valor: z.number().int().min(0).max(100),
  franja: z.enum(['tap', 'jus', 'ras']),
});

const PuntsMapaSchema: z.ZodType<PuntsMapaGeoJson> = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        geometry: z.object({
          type: z.literal('Point'),
          coordinates: z
            .tuple([z.number(), z.number()])
            .meta({ description: '`[lon, lat]`, WGS84, 6 decimals' }),
        }),
        properties: z.object({
          id: z.string(),
          nom: z.string(),
          municipi: z.string(),
          index: IndexSchema.nullable().meta({
            description:
              "Índex de l'hora en curs (worker horari, TG-99). `null` = encara no s'ha calculat: marcador gris.",
          }),
        }),
      }),
    ),
  })
  .meta({ id: 'PuntsMapa' });

registry.registerPath({
  method: 'get',
  path: '/punts',
  tags: ['Punts'],
  summary: 'Tots els punts publicats, en un sol GeoJSON per al mapa (ADR-0012)',
  description:
    "Respon amb `ETag` i `Cache-Control` fins a la propera hora. Amb `If-None-Match` igual a l'`ETag`, respon 304 sense cos.",
  request: {
    query: z.object({
      bbox: z.string().optional().meta({
        description:
          'Retalla la col·lecció: `minLon,minLat,maxLon,maxLat`. El mapa no el fa servir.',
        example: '0.15,40.5,3.35,42.9',
      }),
    }),
    headers: z.object({ 'If-None-Match': z.string().optional() }),
  },
  responses: {
    200: {
      description: 'El catàleg de punts publicats',
      headers: z.object({
        ETag: z.string().meta({ description: 'Versió del document' }),
        'Cache-Control': z.string().meta({ example: 'public, max-age=1800' }),
      }),
      content: { 'application/json': { schema: PuntsMapaSchema } },
    },
    304: { description: "El document no ha canviat des de l'`ETag` enviat" },
    400: {
      description: '`bbox` invàlid',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description: 'Sense accés a la base de dades (`database_unavailable`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

/** Segons fins a la propera hora en punt: el document només canvia un cop per hora. */
export function secondsToNextHour(now = Date.now()): number {
  return 3600 - (Math.floor(now / 1000) % 3600);
}

/** Comparació feble (RFC 9110): Nginx converteix els ETag en `W/"…"` quan comprimeix. */
export function matchesIfNoneMatch(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  const opac = (tag: string) => tag.trim().replace(/^W\//, '');
  return header.split(',').some((tag) => tag.trim() === '*' || opac(tag) === opac(etag));
}

/** Sense `service` (no hi ha `DATABASE_URL`) la ruta respon 503 `database_unavailable`. */
export function createPuntsRouter(service: PuntsService | undefined): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { bbox } = QuerySchema.parse(req.query);
    if (!service) {
      throw new ApiError(
        503,
        'database_unavailable',
        "L'API no té DATABASE_URL: el catàleg de punts no està disponible",
      );
    }
    const { geojson, etag } = await service.getMapDocument(bbox);
    res.set({ ETag: etag, 'Cache-Control': `public, max-age=${secondsToNextHour()}` });
    if (matchesIfNoneMatch(req.get('If-None-Match'), etag)) {
      res.status(304).end();
      return;
    }
    res.json(geojson);
  });

  return router;
}

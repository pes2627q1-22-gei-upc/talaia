import type { PuntFitxa, PuntsMapaGeoJson } from '@talaia/shared';
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

export const HORES_PER_DEFECTE = 24;
export const HORES_MAX = 48;

const FitxaParamsSchema = z.object({
  id: z
    .uuid({ error: 'id ha de ser un UUID' })
    .meta({ description: 'Id del punt (`properties.id` del GeoJSON del mapa)' }),
});

const FitxaQuerySchema = z.object({
  hores: z.coerce
    .number()
    .int()
    .min(1)
    .max(HORES_MAX)
    .default(HORES_PER_DEFECTE)
    .meta({
      description: `Quantes hores després de l'actual (1–${HORES_MAX})`,
      example: HORES_PER_DEFECTE,
    }),
});

const IndexHoraSchema = IndexSchema.extend({
  hora: z
    .string()
    .meta({ description: "Inici de l'hora, ISO 8601 en UTC", example: '2026-10-18T21:00:00.000Z' }),
  factors: z
    .object({ nuvols: z.number(), sol: z.number(), foscor: z.number(), lluna: z.number() })
    .meta({
      description: "Factors de l'índex v1, de 0 a 1 (ADR-0018): el desglossament de la fitxa",
    }),
  foscorEstimada: z
    .boolean()
    .meta({ description: 'La foscor del factor és provisional (sense SQM del punt)' }),
}).meta({ id: 'IndexHora' });

const PuntFitxaSchema: z.ZodType<PuntFitxa> = z
  .object({
    id: z.string(),
    nom: z.string(),
    municipi: z.string(),
    descripcio: z.string(),
    altitud: z.number().int().nullable().meta({ description: 'Metres sobre el nivell del mar' }),
    horitzoObert: z
      .array(z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']))
      .nullable()
      .meta({ description: "Direccions amb l'horitzó obert (aproximat). `null` si no és clar." }),
    accessibilitat: z.string().nullable(),
    lat: z.number(),
    lon: z.number(),
    sqm: z.number().nullable().meta({
      description:
        'Foscor del cel en mag/arcsec² (SQM, ADR-0020): com més alta, més fosc. `null` si encara no està calculada.',
      example: 21.3,
    }),
    index: z.object({
      actual: IndexHoraSchema.nullable().meta({
        description: "Índex de l'hora en curs. `null` si el worker encara no l'ha calculat.",
      }),
      properesHores: z
        .array(IndexHoraSchema)
        .meta({ description: "Les hores següents, en ordre. Buida si encara no n'hi ha cap." }),
    }),
  })
  .meta({ id: 'PuntFitxa' });

registry.registerPath({
  method: 'get',
  path: '/punts/{id}',
  tags: ['Punts'],
  summary: "Fitxa d'un punt publicat amb l'índex actual i el de les properes hores (HU07)",
  description: "`Cache-Control` fins a la propera hora: el worker recalcula l'índex cada hora.",
  request: { params: FitxaParamsSchema, query: FitxaQuerySchema },
  responses: {
    200: {
      description: 'La fitxa del punt',
      headers: z.object({ 'Cache-Control': z.string().meta({ example: 'public, max-age=1800' }) }),
      content: { 'application/json': { schema: PuntFitxaSchema } },
    },
    400: {
      description: '`id` no és un UUID o `hores` és fora de rang (`validation_error`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'No hi ha cap punt publicat amb aquest id (`punt_not_found`)',
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

const databaseUnavailable = () =>
  new ApiError(
    503,
    'database_unavailable',
    "L'API no té DATABASE_URL: el catàleg de punts no està disponible",
  );

/** Sense `service` (no hi ha `DATABASE_URL`) les rutes responen 503 `database_unavailable`. */
export function createPuntsRouter(service: PuntsService | undefined): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { bbox } = QuerySchema.parse(req.query);
    if (!service) throw databaseUnavailable();
    const { geojson, etag } = await service.getMapDocument(bbox);
    res.set({ ETag: etag, 'Cache-Control': `public, max-age=${secondsToNextHour()}` });
    if (matchesIfNoneMatch(req.get('If-None-Match'), etag)) {
      res.status(304).end();
      return;
    }
    res.json(geojson);
  });

  router.get('/:id', async (req, res) => {
    const { id } = FitxaParamsSchema.parse(req.params);
    const { hores } = FitxaQuerySchema.parse(req.query);
    if (!service) throw databaseUnavailable();
    const fitxa = await service.getFitxa(id, hores);
    res.set('Cache-Control', `public, max-age=${secondsToNextHour()}`);
    res.json(fitxa);
  });

  return router;
}

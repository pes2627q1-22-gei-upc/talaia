import type {
  ConsultaRecomanacions,
  ObjectiuObservacio,
  RecomanacionsResposta,
} from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import { diaUtc } from '../recomanacions/franja';
import type { RecomanacionsService } from '../recomanacions/recomanacionsService';
import { IndexHoraSchema } from '../index/indexSchemas';
import { secondsToNextHour } from './punts';

const OBJECTIUS = [
  'pluja_estels',
  'eclipsi',
  'via_lactia',
  'posta_sol',
  'sortida_sol',
  'cel_estrellat',
  'constellacions',
] as const satisfies readonly ObjectiuObservacio[];

export const TEMPS_MAXIM = 600;

/** Un número de la query: un text buit no és 0. */
const numero = (missatge: string) =>
  z
    .string({ error: missatge })
    .trim()
    .min(1, { error: missatge })
    .pipe(z.coerce.number({ error: missatge }));

const hora = (camp: string) =>
  numero(`${camp} ha de ser una hora entera de 0 a 23`).pipe(
    z
      .number()
      .int({ error: `${camp} ha de ser una hora entera de 0 a 23` })
      .min(0)
      .max(23),
  );

const QuerySchema = z
  .object({
    objectiu: z.enum(OBJECTIUS, { error: `objectiu ha de ser un de: ${OBJECTIUS.join(', ')}` }),
    lat: numero('lat ha de ser un número').pipe(z.number().min(-90).max(90)),
    lon: numero('lon ha de ser un número').pipe(z.number().min(-180).max(180)),
    data: z
      .string({ error: 'data ha de ser una data YYYY-MM-DD' })
      .refine((d) => !Number.isNaN(diaUtc(d)), { error: 'data ha de ser una data YYYY-MM-DD' }),
    desDe: hora('desDe'),
    finsA: hora('finsA'),
    tempsMaxim: numero('tempsMaxim ha de ser un nombre de minuts').pipe(
      z
        .number()
        .int({ error: 'tempsMaxim ha de ser un nombre enter de minuts' })
        .min(1)
        .max(TEMPS_MAXIM),
    ),
  })
  .refine((q) => q.desDe !== q.finsA, {
    error: 'desDe i finsA no poden ser iguals: la franja dura almenys una hora',
  })
  .transform(({ lat, lon, ...q }): ConsultaRecomanacions => ({ ...q, origen: { lat, lon } }));

const RecomanacionsSchema: z.ZodType<RecomanacionsResposta> = z
  .object({
    radiKm: z.number().meta({
      description: 'Radi en línia recta que correspon a `tempsMaxim` (60 km/h, desviament ×1,3)',
      example: 115.4,
    }),
    franja: z.object({ desDe: z.string(), finsA: z.string() }).meta({
      description:
        "Hores que entren al rànquing, `[desDe, finsA)` en UTC. Si la franja ja ha començat, `desDe` és l'hora en curs.",
    }),
    punts: z
      .array(
        z.object({
          id: z.string(),
          nom: z.string(),
          municipi: z.string(),
          lat: z.number(),
          lon: z.number(),
          distanciaKm: z
            .number()
            .meta({ description: "Distància en línia recta des de l'origen, en km" }),
          tempsEstimat: z.number().int().meta({
            description: 'Minuts aproximats en cotxe (sense el servei de rutes de Mobilicat)',
          }),
          millorHora: IndexHoraSchema.nullable().meta({
            description:
              "L'hora de la franja amb l'índex més alt. `null` si no n'hi ha cap de calculada (més enllà de la previsió).",
          }),
          mitjana: z.number().int().min(0).max(100).nullable().meta({
            description: "Mitjana de l'índex de les hores calculades de la franja",
          }),
        }),
      )
      .meta({
        description:
          'Punts publicats dins del radi, ordenats per `millorHora`, `mitjana` i distància. Els que no tenen índex, al final.',
      }),
  })
  .meta({ id: 'Recomanacions' });

registry.registerPath({
  method: 'get',
  path: '/recomanacions',
  tags: ['Recomanacions'],
  summary: 'Rànquing de punts per a un objectiu, un origen, una nit i un temps en cotxe (HU01)',
  description:
    "Ordena els punts publicats dins del radi per l'índex de visibilitat v1 de la franja horària (ADR-0018). " +
    "L'índex és el mateix per a tots els objectius fins que s'adapti per fenomen. " +
    'El radi surt de `tempsMaxim` amb una estimació en línia recta fins que hi hagi el servei de rutes de Mobilicat. ' +
    '`Cache-Control` fins a la propera hora.',
  request: {
    query: z.object({
      objectiu: z.enum(OBJECTIUS),
      lat: z.number().meta({ description: "Latitud de l'origen (WGS84)", example: 41.3874 }),
      lon: z.number().meta({ description: "Longitud de l'origen (WGS84)", example: 2.1686 }),
      data: z.string().meta({
        description: "Nit de l'observació: el dia del vespre, `YYYY-MM-DD`",
        example: '2026-10-21',
      }),
      desDe: z.number().int().min(0).max(23).meta({
        description: 'Inici de la franja, hora local de Catalunya',
        example: 22,
      }),
      finsA: z.number().int().min(0).max(23).meta({
        description: "Fi de la franja, hora local. Si és ≤ `desDe`, l'endemà",
        example: 6,
      }),
      tempsMaxim: z.number().int().min(1).max(TEMPS_MAXIM).meta({
        description: 'Temps màxim en cotxe, en minuts',
        example: 150,
      }),
    }),
  },
  responses: {
    200: {
      description: 'El rànquing de punts',
      headers: z.object({ 'Cache-Control': z.string().meta({ example: 'public, max-age=1800' }) }),
      content: { 'application/json': { schema: RecomanacionsSchema } },
    },
    400: {
      description:
        'Paràmetres invàlids (`validation_error`) o franja que ja ha passat (`franja_passada`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description: 'Sense accés a la base de dades (`database_unavailable`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

/** Sense `service` (no hi ha `DATABASE_URL`) la ruta respon 503 `database_unavailable`. */
export function createRecomanacionsRouter(service: RecomanacionsService | undefined): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const consulta = QuerySchema.parse(req.query);
    if (!service) {
      throw new ApiError(
        503,
        'database_unavailable',
        "L'API no té DATABASE_URL: les recomanacions no estan disponibles",
      );
    }
    const resposta = await service.getRecomanacions(consulta);
    res.set('Cache-Control', `public, max-age=${secondsToNextHour()}`);
    res.json(resposta);
  });

  return router;
}

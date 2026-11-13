import type {
  ObjectiuObservacio,
  ParametresRecomanacions,
  RecomanacionsResposta,
} from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import {
  NIGHT_YEAR_MAX as ANY_MAX,
  NIGHT_YEAR_MIN as ANY_MIN,
  UPCOMING_NIGHT_FROM_HOUR,
} from '../index/night';
import { INICI_NIT } from '../recomanacions/franja';
import {
  LIMIT_PER_DEFECTE,
  OBJECTIU_PER_DEFECTE,
  TEMPS_MAXIM_PER_DEFECTE,
  type RecomanacionsService,
} from '../recomanacions/recomanacionsService';
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
export const LIMIT_MAXIM = 100;

type Numero = (missatge: string, rang: { min: number; max: number; int?: boolean }) => z.ZodNumber;

/**
 * Un número amb el missatge en català per a qualsevol error (tipus, enter i rang). Per validar la
 * query es fa servir `z.coerce.number` (arriba com a text); per documentar-la, `z.number`, perquè
 * l'OpenAPI no el doni per opcional (`z.coerce.number` accepta `null`, que passa a 0).
 */
const numeroAmb =
  (base: (params: { error: string }) => z.ZodNumber): Numero =>
  (missatge, { min, max, int = false }) => {
    const n = base({ error: missatge });
    return (int ? n.int({ error: missatge }) : n)
      .min(min, { error: missatge })
      .max(max, { error: missatge });
  };

/** Un paràmetre buit (`?lat=`) és un que falta, no un 0 (`Number('')`). */
const senseBuits = (query: unknown) =>
  typeof query === 'object' && query !== null
    ? Object.fromEntries(
        Object.entries(query).filter(([, v]) => !(typeof v === 'string' && v.trim() === '')),
      )
    : query;

/**
 * La query de la ruta (ADR-0011): la mateixa definició valida (`z.coerce`) i documenta. Només
 * l'origen és obligatori («A prop meu», TG-133); la resta la completa el servei (`resolConsulta`).
 */
const queryShape = (numero: Numero) => {
  const hora = (camp: string) =>
    numero(`${camp} ha de ser una hora entera de 0 a 23`, { min: 0, max: 23, int: true });
  return z.object({
    objectiu: z
      .enum(OBJECTIUS, { error: `objectiu ha de ser un de: ${OBJECTIUS.join(', ')}` })
      .optional()
      .meta({
        description: `Què es vol veure. L'índex v1 encara és el mateix per a tots (ADR-0018). Per defecte, \`${OBJECTIU_PER_DEFECTE}\``,
      }),
    lat: numero('lat ha de ser un número entre -90 i 90', { min: -90, max: 90 }).meta({
      description: "Latitud de l'origen (WGS84)",
      example: 41.3874,
    }),
    lon: numero('lon ha de ser un número entre -180 i 180', { min: -180, max: 180 }).meta({
      description: "Longitud de l'origen (WGS84)",
      example: 2.1686,
    }),
    data: z.iso
      .date({ error: 'data ha de ser un dia del calendari en format YYYY-MM-DD' })
      .refine((d) => Number(d.slice(0, 4)) >= ANY_MIN && Number(d.slice(0, 4)) <= ANY_MAX, {
        error: `data ha de ser entre el ${ANY_MIN} i el ${ANY_MAX}`,
      })
      .optional()
      .meta({
        description: `Nit de l'observació, \`YYYY-MM-DD\` (el dia del vespre), entre el ${ANY_MIN} i el ${ANY_MAX}. La nit va de les ${INICI_NIT}:00 d'aquest dia a les ${INICI_NIT}:00 de l'endemà. Per defecte, la nit que toca: fins a les ${String(UPCOMING_NIGHT_FROM_HOUR).padStart(2, '0')}:00, la que s'acaba; després, la que ve`,
        example: '2026-10-21',
      }),
    desDe: hora('desDe')
      .optional()
      .meta({
        description: `Inici de la franja, hora local de Catalunya. Abans de les ${INICI_NIT}, és l'endemà de \`data\`. Va amb \`finsA\`: sense totes dues, la nit sencera des de l'hora en curs`,
        example: 22,
      }),
    finsA: hora('finsA').optional().meta({
      description:
        "Fi de la franja (no inclosa), hora local. Diferent de `desDe`; si és més petita, l'endemà de `desDe`. Va amb `desDe`",
      example: 6,
    }),
    tempsMaxim: numero(`tempsMaxim ha de ser un nombre enter de minuts de 1 a ${TEMPS_MAXIM}`, {
      min: 1,
      max: TEMPS_MAXIM,
      int: true,
    })
      .optional()
      .meta({
        description: `Temps màxim en cotxe, en minuts. Per defecte, ${TEMPS_MAXIM_PER_DEFECTE} («A prop meu»)`,
        example: 150,
      }),
    limit: numero(`limit ha de ser un nombre enter de 1 a ${LIMIT_MAXIM}`, {
      min: 1,
      max: LIMIT_MAXIM,
      int: true,
    })
      .optional()
      .meta({
        description: `Quants punts del rànquing es retornen (1–${LIMIT_MAXIM}). Per defecte, ${LIMIT_PER_DEFECTE}`,
        example: LIMIT_PER_DEFECTE,
      }),
  });
};

const QueryDoc = queryShape(numeroAmb(z.number));

const QuerySchema = z
  .preprocess(senseBuits, queryShape(numeroAmb(z.coerce.number)))
  .refine((q) => (q.desDe === undefined) === (q.finsA === undefined), {
    error: 'desDe i finsA van juntes: sense cap de les dues, la nit sencera',
  })
  .refine((q) => q.desDe === undefined || q.desDe !== q.finsA, {
    error: 'desDe i finsA no poden ser iguals: la franja dura almenys una hora',
  })
  .transform(({ lat, lon, ...q }): ParametresRecomanacions => ({ ...q, origen: { lat, lon } }));

const RecomanacionsSchema: z.ZodType<RecomanacionsResposta> = z
  .object({
    data: z.iso.date().meta({
      description: "La nit que s'ha fet servir (`YYYY-MM-DD`): la de la consulta o la que toca",
      example: '2026-10-21',
    }),
    tempsMaxim: z
      .number()
      .int()
      .meta({
        description: `Temps en cotxe que s'ha fet servir, en minuts: el de la consulta o ${TEMPS_MAXIM_PER_DEFECTE}`,
        example: TEMPS_MAXIM_PER_DEFECTE,
      }),
    radiKm: z.number().meta({
      description: 'Radi en línia recta que correspon a `tempsMaxim` (60 km/h, desviament ×1,3)',
      example: 115.4,
    }),
    franja: z.object({ desDe: z.string(), finsA: z.string() }).meta({
      description:
        "Hores que entren al rànquing, `[desDe, finsA)` en UTC. Si la franja ja ha començat, `desDe` és l'hora en curs.",
    }),
    total: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Punts publicats dins del radi, abans d’aplicar `limit`' }),
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
          // Sense `.meta()` al nullable: així surt com a `$ref` a `IndexHora`.
          millorHora: IndexHoraSchema.nullable(),
          mitjana: z.number().int().min(0).max(100).nullable().meta({
            description: "Mitjana de l'índex de les hores calculades de la franja",
          }),
          horesAmbIndex: z.number().int().min(0).meta({
            description:
              'Quantes hores de la franja tenen índex: a tocar del final de la previsió, la mitjana surt de menys hores',
          }),
        }),
      )
      .meta({
        description:
          'Els `limit` primers punts publicats dins del radi, ordenats per `millorHora`, `mitjana` i distància. Els que no tenen índex, al final.',
      }),
  })
  .meta({ id: 'Recomanacions' });

registry.registerPath({
  method: 'get',
  path: '/recomanacions',
  tags: ['Recomanacions'],
  summary:
    'Rànquing de punts per a un objectiu, un origen, una nit i un temps en cotxe (HU01, HU02)',
  description:
    "Només l'origen (`lat`, `lon`) és obligatori: amb només la ubicació de l'usuari («A prop meu», HU02) es fa el rànquing de la nit en curs des de l'hora actual, " +
    `a ${TEMPS_MAXIM_PER_DEFECTE} minuts en cotxe. ` +
    "Ordena els punts publicats dins del radi per l'índex de visibilitat v1 de la franja horària (ADR-0018). " +
    "L'índex és el mateix per a tots els objectius fins que s'adapti per fenomen. " +
    'El radi surt de `tempsMaxim` amb una estimació en línia recta fins que hi hagi el servei de rutes de Mobilicat. ' +
    '`Cache-Control` privat fins a la propera hora: la consulta porta la ubicació de qui la fa.',
  request: { query: QueryDoc },
  responses: {
    200: {
      description: 'El rànquing de punts',
      headers: z.object({ 'Cache-Control': z.string().meta({ example: 'private, max-age=1800' }) }),
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
    // `private`: la URL porta la ubicació de l'usuari, i cap memòria cau compartida no l'ha de desar.
    res.set('Cache-Control', `private, max-age=${secondsToNextHour()}`);
    res.json(resposta);
  });

  return router;
}

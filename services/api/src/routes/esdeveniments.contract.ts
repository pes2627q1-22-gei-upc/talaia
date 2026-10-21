import type {
  Esdeveniment,
  EsdevenimentsResponse,
  TipusFenomen,
  UbicacioEsdeveniment,
} from '@talaia/shared';
import { z } from 'zod';

import { ErrorSchema, registry } from '../openapi';
import { TIPUS_FENOMEN } from '../esdeveniments/tipus';

export const TipusFenomenSchema: z.ZodType<TipusFenomen> = z
  .enum(TIPUS_FENOMEN, { error: 'tipus ha de ser una categoria del calendari coneguda' })
  .meta({ id: 'TipusFenomen' });

const UbicacioEsdevenimentSchema: z.ZodType<UbicacioEsdeveniment> = z
  .object({
    nom: z.string().min(1),
    latitud: z.number().min(-90).max(90),
    longitud: z.number().min(-180).max(180),
  })
  .meta({ id: 'UbicacioEsdeveniment' });

const EsdevenimentSchema: z.ZodType<Esdeveniment> = z
  .object({
    id: z.string().min(1),
    tipus: TipusFenomenSchema,
    nom: z.string().min(1),
    inici: z.iso.datetime(),
    fi: z.iso.datetime(),
    maxim: z.iso.datetime().nullable(),
    descripcio: z.string().min(1),
    ubicacio: UbicacioEsdevenimentSchema,
    font: z.string().min(1),
  })
  .meta({ id: 'Esdeveniment' });

export const EsdevenimentsResponseSchema: z.ZodType<EsdevenimentsResponse> = z
  .object({ data: z.array(EsdevenimentSchema) })
  .meta({ id: 'EsdevenimentsResponse' });

/** Dies civils de Catalunya; 366 dies inclosos com a màxim, sense paginació en aquest contracte. */
export const EsdevenimentsQuerySchema = z
  .object({
    des_de: z.iso.date({ error: 'des_de ha de ser una data YYYY-MM-DD vàlida' }).meta({
      description: 'Primer dia civil a Europe/Madrid, inclòs.',
    }),
    fins_a: z.iso.date({ error: 'fins_a ha de ser una data YYYY-MM-DD vàlida' }).meta({
      description: 'Últim dia civil a Europe/Madrid, inclòs; màxim 366 dies de consulta.',
    }),
    tipus: TipusFenomenSchema.optional().meta({ description: 'Filtre opcional per tipus.' }),
  })
  .refine(
    ({ des_de, fins_a }) =>
      !z.iso.date().safeParse(des_de).success ||
      !z.iso.date().safeParse(fins_a).success ||
      des_de <= fins_a,
    {
      path: ['fins_a'],
      error: 'fins_a ha de ser igual o posterior a des_de',
    },
  )
  .refine(
    ({ des_de, fins_a }) =>
      !z.iso.date().safeParse(des_de).success ||
      !z.iso.date().safeParse(fins_a).success ||
      Date.parse(fins_a) - Date.parse(des_de) <= 365 * 86_400_000,
    {
      path: ['fins_a'],
      error: "L'interval no pot superar 366 dies civils",
    },
  );

registry.registerComponent('securitySchemes', 'ApiKeyAprop', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
  description: "Clau assignada a l'equip Aprop; no s'ha d'incloure en una aplicació client.",
});
registry.registerComponent('securitySchemes', 'BearerSupabase', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: "JWT d'accés de Supabase per a l'app de Talaia (ADR-0023).",
});

/** Contracte compartit per l'OpenAPI i el router d'esdeveniments. */
registry.registerPath({
  method: 'get',
  path: '/esdeveniments',
  operationId: 'listEsdeveniments',
  tags: ['Esdeveniments'],
  summary: "Consulta els esdeveniments astronòmics d'un període",
  description:
    'Les dates són dies civils de Catalunya ' +
    '(Europe/Madrid): [des_de 00:00, fins_a + 1 dia 00:00). Hi entra un esdeveniment si ' +
    'inici < final i fi > començament. La ubicació és un punt general recomanat per situar ' +
    "l'esdeveniment al mapa, no una garantia meteorològica.",
  security: [{ ApiKeyAprop: [] }, { BearerSupabase: [] }],
  request: { query: EsdevenimentsQuerySchema },
  responses: {
    200: {
      description: "Llista d'esdeveniments ordenada per inici ascendent.",
      content: { 'application/json': { schema: EsdevenimentsResponseSchema } },
    },
    400: {
      description: 'Paràmetres invàlids o interval incorrecte.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    401: {
      description: 'Credencial absent o invàlida (API key o JWT).',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description: 'Base de dades, punt de referència, clau API o validació JWT indisponibles.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    500: {
      description: 'Error intern.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

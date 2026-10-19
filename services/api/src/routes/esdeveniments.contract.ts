import type {
  Esdeveniment,
  EsdevenimentsResponse,
  TipusFenomen,
  UbicacioEsdeveniment,
} from '@talaia/shared';
import { z } from 'zod';

import { ErrorSchema, registry } from '../openapi';

const TipusFenomenSchema: z.ZodType<TipusFenomen> = z
  .enum([
    'fase_llunar',
    'pluja_estels',
    'eclipsi_solar',
    'eclipsi_llunar',
    'conjuncio',
    'superlluna',
  ])
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

const EsdevenimentsResponseSchema: z.ZodType<EsdevenimentsResponse> = z
  .object({ data: z.array(EsdevenimentSchema) })
  .meta({ id: 'EsdevenimentsResponse' });

const EsdevenimentsQuerySchema = z.object({
  des_de: z.iso.date().meta({ description: "Primer dia de l'interval, inclòs." }),
  fins_a: z.iso.date().meta({ description: "Últim dia de l'interval, inclòs." }),
  tipus: TipusFenomenSchema.optional().meta({ description: 'Filtre opcional per tipus.' }),
});

registry.registerComponent('securitySchemes', 'ApiKeyAprop', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
  description: "Clau assignada a l'equip Aprop; no s'ha d'incloure en una aplicació client.",
});

/**
 * Contracte primer: TG-109 el publica a l'OpenAPI i TG-108 n'afegeix el router i la consulta.
 * Registrar-lo no crea encara l'endpoint d'Express.
 */
registry.registerPath({
  method: 'get',
  path: '/esdeveniments',
  tags: ['Esdeveniments'],
  summary: "Consulta els esdeveniments astronòmics d'un període",
  description:
    "Retorna les ocurrències que intersecten l'interval demanat. La ubicació és un punt " +
    "general recomanat per situar l'esdeveniment al mapa, no una garantia meteorològica.",
  security: [{ ApiKeyAprop: [] }],
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
      description: "Falta la clau d'API.",
      content: { 'application/json': { schema: ErrorSchema } },
    },
    403: {
      description: "La clau d'API no és vàlida.",
      content: { 'application/json': { schema: ErrorSchema } },
    },
    429: {
      description: 'Límit de peticions superat.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    500: {
      description: 'Error intern.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

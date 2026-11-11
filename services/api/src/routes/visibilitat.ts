import type { ConsultaVisibilitat, VisibilitatUbicacio } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import { IndexHoraSchema } from '../index/indexSchemas';
import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import {
  HORES_CONSULTABLES,
  MAX_PREVISIONS_PER_HORA,
  RADI_SQM_M,
  type VisibilitatService,
} from '../visibilitat/visibilitatService';
import { secondsToNextHour } from './punts';
import { numeroAmb, senseBuits, type Numero } from './query';

/** La query de la ruta (ADR-0011): la mateixa definició valida (`z.coerce`) i documenta. */
const queryShape = (numero: Numero) =>
  z.object({
    lat: numero('lat ha de ser un número entre -90 i 90', { min: -90, max: 90 }).meta({
      description: 'Latitud del lloc (WGS84)',
      example: 41.9522,
    }),
    lon: numero('lon ha de ser un número entre -180 i 180', { min: -180, max: 180 }).meta({
      description: 'Longitud del lloc (WGS84)',
      example: 1.5237,
    }),
    hora: z.iso
      .datetime({
        offset: true,
        error: 'hora ha de ser un instant ISO 8601 amb zona, com 2026-11-12T21:00:00Z',
      })
      .optional()
      .meta({
        description: `Instant ISO 8601 amb zona; compta l'hora que el conté (en UTC). Des de l'hora en curs fins a ${HORES_CONSULTABLES} hores endavant. Per defecte, ara.`,
        example: '2026-11-12T21:00:00Z',
      }),
  });

const QueryDoc = queryShape(numeroAmb(z.number));

const QuerySchema: z.ZodType<ConsultaVisibilitat> = z.preprocess(
  senseBuits,
  queryShape(numeroAmb(z.coerce.number)),
);

// Tipat amb el tipus compartit: si l'esquema i @talaia/shared divergeixen, no compila.
const VisibilitatSchema: z.ZodType<VisibilitatUbicacio> = z
  .object({
    lat: z.number().meta({
      description: 'On s’ha calculat: la latitud consultada, arrodonida a 0,01° (~1 km)',
      example: 41.95,
    }),
    lon: z.number().meta({
      description: 'On s’ha calculat: la longitud consultada, arrodonida a 0,01° (~1 km)',
      example: 1.52,
    }),
    sqm: z
      .number()
      .nullable()
      .meta({
        description: `Foscor del cel (SQM, mag/arcsec²) del punt publicat més proper, si n'hi ha un a ${RADI_SQM_M / 1000} km o menys. \`null\`: foscor estimada (\`index.foscorEstimada\`).`,
        example: null,
      }),
    index: IndexHoraSchema,
    deDia: z.boolean().meta({
      description:
        "El Sol encara no s'ha post (factor `sol` 0): l'índex és 0 per l'hora, no pel cel",
    }),
  })
  .meta({ id: 'VisibilitatUbicacio' });

registry.registerPath({
  method: 'get',
  path: '/visibilitat',
  tags: ['Visibilitat'],
  summary: "Índex de visibilitat d'una ubicació qualsevol de Catalunya en una hora (HU05)",
  description:
    "Calcula al moment l'índex v1 (ADR-0018) d'un lloc del mapa que no és al catàleg (ADR-0031): la previsió d'Open-Meteo de la cel·la de 0,01°, " +
    "les efemèrides de l'hora i la foscor del punt publicat més proper. " +
    "La previsió de cada cel·la es guarda en memòria fins al minut 5 de l'hora següent: una segona consulta del mateix lloc, de qualsevol hora, surt de la memòria cau (`X-Cache: HIT`). " +
    `Com a molt ${MAX_PREVISIONS_PER_HORA} consultes noves a Open-Meteo per hora. ` +
    '`Cache-Control` privat fins a la propera hora: la consulta porta la ubicació de qui la fa.',
  request: { query: QueryDoc },
  responses: {
    200: {
      description: "L'índex de l'hora al lloc consultat",
      headers: z.object({
        'Cache-Control': z.string().meta({ example: 'private, max-age=1800' }),
        'X-Cache': z.enum(['HIT', 'MISS']).meta({
          description:
            '`HIT` si la previsió del lloc ja era a la memòria cau; `MISS` si s’ha demanat a Open-Meteo',
        }),
      }),
      content: { 'application/json': { schema: VisibilitatSchema } },
    },
    400: {
      description: 'Paràmetres invàlids (`validation_error`)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    422: {
      description: `La ubicació és fora de Catalunya (\`fora_de_catalunya\`) o l'hora no és entre l'hora en curs i ${HORES_CONSULTABLES} hores endavant (\`hora_sense_previsio\`)`,
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description:
        "Open-Meteo no respon o s'ha arribat al màxim de consultes d'aquesta hora (`meteo_unavailable`)",
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

/** Sense `service`, la ruta respon 503 `meteo_unavailable`. */
export function createVisibilitatRouter(service: VisibilitatService | undefined): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const consulta = QuerySchema.parse(req.query);
    if (!service) {
      throw new ApiError(
        503,
        'meteo_unavailable',
        "L'API no té configurat el càlcul de la visibilitat al moment",
      );
    }
    const { resposta, cache } = await service.getVisibilitat(consulta);
    // `private`: la URL porta la ubicació de l'usuari, i cap memòria cau compartida no l'ha de desar.
    res.set({ 'Cache-Control': `private, max-age=${secondsToNextHour()}`, 'X-Cache': cache });
    res.json(resposta);
  });

  return router;
}

import type { DesglossamentIndex } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { BreakdownService } from '../index/breakdownService';
import { IndexHoraSchema } from '../index/indexSchemas';
import { NIGHT_YEAR_MAX, NIGHT_YEAR_MIN, NightSchema } from '../index/night';
import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import { secondsToNextHour } from './punts';

const ParamsSchema = z.object({
  id: z
    .uuid({ error: 'id ha de ser un UUID' })
    .meta({ description: 'Id del punt (`properties.id` del GeoJSON del mapa)' }),
});
// El mateix esquema valida i documenta (ADR-0011): a l'OpenAPI surt amb `format: date`.
const QuerySchema = z.object({
  nit: NightSchema.meta({
    description: `La nit, \`YYYY-MM-DD\` (el dia del vespre), entre el ${NIGHT_YEAR_MIN} i el ${NIGHT_YEAR_MAX}. Per defecte, la d’avui.`,
    example: '2026-10-19',
  }).optional(),
});

const DesglossamentSchema: z.ZodType<DesglossamentIndex> = z
  .object({
    punt: z.object({ id: z.string(), nom: z.string(), municipi: z.string() }),
    nit: z
      .string()
      .meta({ description: 'La nit del desglossament: el dia del vespre', example: '2026-10-19' }),
    hores: z.array(IndexHoraSchema).meta({
      description:
        "De les 12:00 locals de `nit` a les 12:00 de l'endemà, en ordre. Només les hores que el worker ha calculat: buit si encara no n'hi ha cap. Les de dia porten `factors.sol = 0`.",
    }),
  })
  .meta({ id: 'DesglossamentIndex' });

registry.registerPath({
  method: 'get',
  path: '/punts/{id}/index',
  tags: ['Punts'],
  summary: "Desglossament de l'índex d'un punt per hores i factors (HU04)",
  description:
    "L'índex de visibilitat d'una nit hora a hora, amb els factors que l'expliquen (núvols, Sol, foscor del cel i Lluna). Una nit va de les 12:00 locals del dia `nit` a les 12:00 de l'endemà; sense `nit`, la d'avui (fins al migdia, la que s'està acabant). Respon amb `Cache-Control` fins a la propera hora, que és quan el worker recalcula.",
  request: {
    params: ParamsSchema,
    query: QuerySchema,
  },
  responses: {
    200: {
      description: "L'índex de la nit, hora a hora",
      headers: z.object({
        'Cache-Control': z.string().meta({ example: 'public, max-age=1800' }),
      }),
      content: { 'application/json': { schema: DesglossamentSchema } },
    },
    400: {
      description:
        '`id` no és un UUID o `nit` és invàlida o fora del 2000–2100 (`validation_error`)',
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

/** Sense `service` (no hi ha `DATABASE_URL`) la ruta respon 503 `database_unavailable`. */
export function createPuntIndexRouter(service: BreakdownService | undefined): Router {
  const router = Router();

  router.get('/:id/index', async (req, res) => {
    const { id } = ParamsSchema.parse(req.params);
    const { nit } = QuerySchema.parse(req.query);
    if (!service) {
      throw new ApiError(
        503,
        'database_unavailable',
        "L'API no té DATABASE_URL: l'índex de visibilitat no està disponible",
      );
    }
    const breakdown = await service.getBreakdown(id, nit);
    res.set('Cache-Control', `public, max-age=${secondsToNextHour()}`);
    res.json(breakdown);
  });

  return router;
}

import type { DesglossamentIndex, FactorsIndex, IndexHora } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { BreakdownService } from '../index/breakdownService';
import { NightSchema } from '../index/night';
import { ApiError } from '../middleware/errors';
import { ErrorSchema, registry } from '../openapi';
import { secondsToNextHour } from './punts';

const ParamsSchema = z.object({ id: z.string() });
const QuerySchema = z.object({ nit: NightSchema.optional() });

const Factor = z.number().min(0).max(1);

// Tipats amb els tipus compartits: si l'esquema i @talaia/shared divergeixen, no compila.
const FactorsSchema: z.ZodType<FactorsIndex> = z.object({
  nuvols: Factor.meta({ description: '1 amb el cel ras; 0 tapat o si plou.' }),
  sol: Factor.meta({
    description: '1 de nit o en el crepuscle astronòmic, 0,5 en el nàutic, 0 en el civil o de dia.',
  }),
  foscor: Factor.meta({
    description: 'Foscor del cel segons la contaminació lumínica: 1 com més fosc.',
  }),
  lluna: Factor.meta({ description: '1 sense Lluna; baixa com més il·luminada i alta és.' }),
});

const IndexHoraSchema: z.ZodType<IndexHora> = z
  .object({
    hora: z.iso.datetime().meta({
      description: "Inici de l'hora, ISO 8601 en UTC",
      example: '2026-10-19T21:00:00.000Z',
    }),
    valor: z.number().int().min(0).max(100),
    franja: z.enum(['tap', 'jus', 'ras']),
    factors: FactorsSchema.meta({
      description:
        'Els factors de la fórmula v1 (ADR-0018), de 0 a 1: `índex = 100 × nuvols × sol × (0,6 · foscor + 0,4 · lluna)`.',
    }),
    foscorEstimada: z.boolean().meta({
      description: 'La foscor és provisional: el punt no té SQM del mapa de contaminació lumínica.',
    }),
  })
  .meta({ id: 'IndexHora' });

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
    params: z.object({ id: z.string().meta({ description: '`id` del punt (UUID)' }) }),
    query: z.object({
      nit: z.string().optional().meta({
        description: 'La nit, `YYYY-MM-DD` (el dia del vespre). Per defecte, la d’avui.',
        example: '2026-10-19',
      }),
    }),
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
      description: '`nit` invàlid',
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

import type { HealthResponse } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import { version } from '../config/env';
import { registry } from '../openapi';

// Tipat amb el tipus compartit: si l'esquema i @talaia/shared divergeixen, no compila.
const HealthSchema: z.ZodType<HealthResponse> = z
  .object({ status: z.literal('ok'), version: z.string() })
  .meta({ id: 'Health' });

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Sistema'],
  summary: "Estat de l'API",
  responses: {
    200: {
      description: "L'API funciona",
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', version } satisfies HealthResponse);
});

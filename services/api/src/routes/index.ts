import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { version } from '../config/env';
import { buildOpenApiDocument } from '../openapi';
import type { PuntsService } from '../punts/puntsService';
import { healthRouter } from './health';
import { createPuntsRouter } from './punts';

/** Dependències dels routers. Sense `punts`, `/punts` respon 503 (no hi ha `DATABASE_URL`). */
export type ApiDeps = {
  punts?: PuntsService;
};

/** Router de `/api/v1`: un router per recurs (punts, recomanacions, esdeveniments…). */
export function createApiRouter({ punts }: ApiDeps = {}): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/punts', createPuntsRouter(punts));

  // Es genera quan ja s'han importat tots els routers, que són els que registren les rutes.
  const openapi = buildOpenApiDocument(version);
  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  return router;
}

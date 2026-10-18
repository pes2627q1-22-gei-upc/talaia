import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { version } from '../config/env';
import type { BreakdownService } from '../index/breakdownService';
import { buildOpenApiDocument } from '../openapi';
import type { PuntsService } from '../punts/puntsService';
import { healthRouter } from './health';
import { createPuntIndexRouter } from './puntIndex';
import { createPuntsRouter } from './punts';

/** Dependències dels routers. Sense elles (no hi ha `DATABASE_URL`), les rutes de dades responen 503. */
export type ApiDeps = {
  punts?: PuntsService;
  /** `GET /punts/{id}/index` (TG-104). */
  breakdown?: BreakdownService;
};

/** Router de `/api/v1`: un router per recurs (punts, recomanacions, esdeveniments…). */
export function createApiRouter({ punts, breakdown }: ApiDeps = {}): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/punts', createPuntsRouter(punts));
  router.use('/punts', createPuntIndexRouter(breakdown));

  // Es genera quan ja s'han importat tots els routers, que són els que registren les rutes.
  const openapi = buildOpenApiDocument(version);
  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  return router;
}

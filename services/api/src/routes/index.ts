import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { version } from '../config/env';
import type { EsdevenimentsService } from '../esdeveniments/esdevenimentsService';
import type { BreakdownService } from '../index/breakdownService';
import type { JwksSource } from '../middleware/auth';
import { buildOpenApiDocument } from '../openapi';
import type { PuntsService } from '../punts/puntsService';
import type { RecomanacionsService } from '../recomanacions/recomanacionsService';
import type { ProfileStore } from '../services/profileService';
import { createAuthRouter } from './auth';
import { createEsdevenimentsRouter } from './esdeveniments';
import './esdeveniments.contract';
import { healthRouter } from './health';
import { createPuntIndexRouter } from './puntIndex';
import { createPuntsRouter } from './punts';
import { createRecomanacionsRouter } from './recomanacions';

/** Dependències dels routers. Sense `punts` o `breakdown` (no hi ha `DATABASE_URL`), les seves rutes responen 503. */
export type ApiDeps = {
  punts?: PuntsService;
  /** `GET /punts/{id}/index` (TG-104). */
  breakdown?: BreakdownService;
  recomanacions?: RecomanacionsService;
  supabaseUrl?: string;
  jwks?: JwksSource;
  profileStore?: ProfileStore;
  esdeveniments?: EsdevenimentsService;
  apropApiKey?: string;
};

/** Router de `/api/v1`: un router per recurs (punts, recomanacions, esdeveniments…). */
export function createApiRouter({
  punts,
  breakdown,
  recomanacions,
  supabaseUrl,
  jwks,
  profileStore,
  esdeveniments,
  apropApiKey,
}: ApiDeps & { profileStore: ProfileStore }): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/punts', createPuntsRouter(punts));
  router.use('/punts', createPuntIndexRouter(breakdown));
  router.use('/recomanacions', createRecomanacionsRouter(recomanacions));
  router.use(
    '/esdeveniments',
    createEsdevenimentsRouter(esdeveniments, apropApiKey, { supabaseUrl, jwks }),
  );
  router.use(createAuthRouter({ supabaseUrl, profileStore, jwks }));

  // Es genera quan ja s'han importat tots els routers, que són els que registren les rutes.
  const openapi = buildOpenApiDocument(version);
  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  return router;
}

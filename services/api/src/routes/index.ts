import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { version } from '../config/env';
import { buildOpenApiDocument } from '../openapi';
import type { PuntsService } from '../punts/puntsService';
import type { JwksSource } from '../middleware/auth';
import type { ProfileStore } from '../services/profileService';
import { createAuthRouter } from './auth';
import { healthRouter } from './health';
import './esdeveniments.contract';
import { createPuntsRouter } from './punts';

/** Dependències dels routers. */
export type ApiDeps = {
  punts?: PuntsService;
  supabaseUrl?: string;
  jwks?: JwksSource;
  profileStore?: ProfileStore;
};

/** Router de `/api/v1`: un router per recurs (punts, recomanacions, esdeveniments…). */
export function createApiRouter({
  punts,
  supabaseUrl,
  jwks,
  profileStore,
}: ApiDeps & { profileStore: ProfileStore }): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/punts', createPuntsRouter(punts));
  router.use(createAuthRouter({ supabaseUrl, profileStore, jwks }));

  // Es genera quan ja s'han importat tots els routers, que són els que registren les rutes.
  const openapi = buildOpenApiDocument(version);
  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  return router;
}

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { version } from '../config/env';
import type { EsdevenimentsService } from '../esdeveniments/esdevenimentsService';
import type { BreakdownService } from '../index/breakdownService';
import { requireAuth, type JwksSource } from '../middleware/auth';
import { buildOpenApiDocument } from '../openapi';
import type { PuntsService } from '../punts/puntsService';
import type { RecomanacionsService } from '../recomanacions/recomanacionsService';
import type { ProfileStore } from '../services/profileService';
import type { VisibilitatService } from '../visibilitat/visibilitatService';
import { createAdminRouter } from './admin';
import { createAuthRouter } from './auth';
import { createEsdevenimentsRouter } from './esdeveniments';
import './esdeveniments.contract';
import { healthRouter } from './health';
import { createPuntIndexRouter } from './puntIndex';
import { createPuntsRouter } from './punts';
import { createRecomanacionsRouter } from './recomanacions';
import { createVisibilitatRouter } from './visibilitat';

/** Dependències dels routers. Sense `punts` o `breakdown` (no hi ha `DATABASE_URL`), les seves rutes responen 503. */
export type ApiDeps = {
  punts?: PuntsService;
  /** `GET /punts/{id}/index` (TG-104). */
  breakdown?: BreakdownService;
  recomanacions?: RecomanacionsService;
  /** `GET /visibilitat` (TG-130): l'índex d'una ubicació qualsevol, calculat al moment. Sense, 503. */
  visibilitat?: VisibilitatService;
  supabaseUrl?: string;
  jwks?: JwksSource;
  profileStore?: ProfileStore;
  esdeveniments?: EsdevenimentsService;
  apropApiKey?: string;
};

/** Router de `/api/v1`: un router per recurs (punts, recomanacions, visibilitat, esdeveniments…). */
export function createApiRouter({
  punts,
  breakdown,
  recomanacions,
  visibilitat,
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
  router.use('/visibilitat', createVisibilitatRouter(visibilitat));
  router.use(
    '/esdeveniments',
    createEsdevenimentsRouter(esdeveniments, apropApiKey, { supabaseUrl, jwks }),
  );
  // Totes les rutes d'usuari passen per aquí: JWT vàlid i compte no bloquejat (403
  // `account_blocked`, TG-177). Les rutes noves (alertes, plans, favorits) han de fer servir aquest.
  const requireUser = requireAuth({
    supabaseUrl,
    jwks,
    accountStatus: (authUserId) => profileStore.getAccountStatus(authUserId),
  });
  router.use(createAuthRouter({ requireUser, profileStore }));
  router.use('/admin', createAdminRouter({ requireUser, profileStore }));

  // Es genera quan ja s'han importat tots els routers, que són els que registren les rutes.
  const openapi = buildOpenApiDocument(version);
  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  return router;
}

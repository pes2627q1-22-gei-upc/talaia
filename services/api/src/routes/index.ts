import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { version } from '../config/env';
import type { AlertesStore } from '../alertes/alertesRepository';
import type { EsdevenimentsService } from '../esdeveniments/esdevenimentsService';
import type { FavoritsService } from '../favorits/favoritsService';
import type { BreakdownService } from '../index/breakdownService';
import { requireAuth, type JwksSource } from '../middleware/auth';
import { buildOpenApiDocument } from '../openapi';
import type { PuntsAdminService } from '../punts/puntsAdminService';
import type { PlansService } from '../plans/plansService';
import type { PuntsService } from '../punts/puntsService';
import type { RecomanacionsService } from '../recomanacions/recomanacionsService';
import type { ProfileStore } from '../services/profileService';
import type { PushDeviceStore } from '../services/pushDeviceService';
import type { VisibilitatService } from '../visibilitat/visibilitatService';
import { createAdminRouter } from './admin';
import { createAlertesRouter } from './alertes';
import { createAuthRouter } from './auth';
import { createDispositiusRouter } from './dispositius';
import { createEsdevenimentsRouter } from './esdeveniments';
import './esdeveniments.contract';
import { createFavoritsRouter } from './favorits';
import { healthRouter } from './health';
import { createPlansRouter } from './plans';
import { createPuntIndexRouter } from './puntIndex';
import { createPuntsRouter } from './punts';
import { createRecomanacionsRouter } from './recomanacions';
import { createVisibilitatRouter } from './visibilitat';

/**
 * Dependències dels routers. Sense `punts`, `breakdown`, `favorits` o `plans` (no hi ha `DATABASE_URL`), les
 * seves rutes responen 503.
 */
export type ApiDeps = {
  punts?: PuntsService;
  /** `GET /punts/{id}/index` (TG-104). */
  breakdown?: BreakdownService;
  recomanacions?: RecomanacionsService;
  /** `/admin/punts` (TG-174): ha de descartar el document del mapa de `punts` a cada canvi. */
  puntsAdmin?: PuntsAdminService;
  /** `GET /visibilitat` (TG-130): l'índex d'una ubicació qualsevol, calculat al moment. Sense, 503. */
  visibilitat?: VisibilitatService;
  supabaseUrl?: string;
  jwks?: JwksSource;
  profileStore?: ProfileStore;
  /** `POST`, `GET`, `PATCH` i `DELETE /alertes` (TG-145, TG-147, TG-150). */
  alertes?: AlertesStore;
  /** Expo push tokens (`/perfil/dispositius`, TG-152). */
  dispositius?: PushDeviceStore;
  esdeveniments?: EsdevenimentsService;
  apropApiKey?: string;
  /** `POST`, `GET` i `DELETE /favorits` (TG-169). */
  favorits?: FavoritsService;
  /** `POST` i `GET /plans` (TG-156). */
  plans?: PlansService;
};

/** Router de `/api/v1`: un router per recurs (punts, recomanacions, visibilitat, esdeveniments…). */
export function createApiRouter({
  punts,
  breakdown,
  recomanacions,
  puntsAdmin,
  visibilitat,
  supabaseUrl,
  jwks,
  profileStore,
  alertes,
  dispositius,
  esdeveniments,
  apropApiKey,
  favorits,
  plans,
}: ApiDeps & { profileStore: ProfileStore; alertes: AlertesStore }): Router {
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
  router.use(createDispositiusRouter({ requireUser, store: dispositius }));
  router.use('/admin', createAdminRouter({ requireUser, profileStore, puntsAdmin }));
  router.use('/alertes', createAlertesRouter({ requireUser, store: alertes }));
  router.use('/favorits', createFavoritsRouter({ requireUser, service: favorits }));
  router.use('/plans', createPlansRouter({ requireUser, service: plans }));

  // Es genera quan ja s'han importat tots els routers, que són els que registren les rutes.
  const openapi = buildOpenApiDocument(version);
  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  return router;
}

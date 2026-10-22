import { createHash, timingSafeEqual } from 'node:crypto';

import { Router, type RequestHandler } from 'express';

import type { EsdevenimentsService } from '../esdeveniments/esdevenimentsService';
import { requireAuth, type AuthMiddlewareOptions } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { EsdevenimentsQuerySchema } from './esdeveniments.contract';

const missingDatabase = () =>
  new ApiError(
    503,
    'database_unavailable',
    "L'API no té DATABASE_URL: el calendari no està disponible",
  );

/** Compara secrets sense exposar-ne la longitud ni fer una comparació de text variable. */
function validApiKey(provided: string, expected: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(provided).digest(),
    createHash('sha256').update(expected).digest(),
  );
}

export function createEsdevenimentsRouter(
  service: EsdevenimentsService | undefined,
  apiKey: string | undefined,
  auth: AuthMiddlewareOptions,
): Router {
  const router = Router();
  const requireJwt = requireAuth(auth);
  const authenticate: RequestHandler = (req, res, next) => {
    // Una capçalera Authorization present sempre es valida com a JWT: no es pot
    // evitar un token invàlid afegint també una API key correcta.
    if (req.get('authorization')) return requireJwt(req, res, next);
    const provided = req.get('X-API-Key');
    if (!provided) return next(new ApiError(401, 'unauthorized', 'Falta la credencial'));
    if (!apiKey) {
      return next(new ApiError(503, 'service_unavailable', "La clau d'Aprop no està configurada"));
    }
    if (!validApiKey(provided, apiKey)) {
      return next(new ApiError(401, 'unauthorized', 'API key invàlida'));
    }
    return next();
  };

  router.get('/', authenticate, async (req, res) => {
    const { des_de, fins_a, tipus } = EsdevenimentsQuerySchema.parse(req.query);
    if (!service) throw missingDatabase();
    res.json(await service.list(des_de, fins_a, tipus));
  });
  return router;
}

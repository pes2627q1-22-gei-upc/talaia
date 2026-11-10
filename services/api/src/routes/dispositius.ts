import type { DispositiuPush } from '@talaia/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import {
  requireAuth,
  type AuthenticatedRequest,
  type AuthMiddlewareOptions,
} from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import type { PushDeviceStore } from '../services/pushDeviceService';

/**
 * Expo push token (ADR-0028). `ExpoPushToken[…]` és el prefix nou que també accepta
 * `expo-server-sdk` (`Expo.isExpoPushToken`).
 */
const PushTokenSchema = z
  .string()
  .max(200)
  .regex(
    /^Expo(nent)?PushToken\[[^\]\s]+\]$/,
    'Ha de ser un Expo push token (ExponentPushToken[…])',
  );

const DispositiuPushSchema: z.ZodType<DispositiuPush> = z
  .strictObject({ token: PushTokenSchema, plataforma: z.enum(['ios', 'android']) })
  .meta({ id: 'DispositiuPush' });

const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorSchema } },
});
const ERRORS_AUTH = {
  401: errorResponse('JWT no vàlid o absent'),
  503: errorResponse('No es pot validar el JWT de Supabase o no hi ha base de dades'),
};

registry.registerPath({
  method: 'put',
  path: '/perfil/dispositius',
  tags: ['Auth'],
  summary: 'Registra o actualitza l’Expo push token d’un dispositiu de l’usuari (ADR-0028)',
  description:
    'Upsert idempotent per `token`: si el token era d’un altre perfil (una altra persona ha entrat al mateix mòbil), passa al de l’usuari del JWT.',
  request: {
    body: { required: true, content: { 'application/json': { schema: DispositiuPushSchema } } },
  },
  responses: {
    204: { description: 'Token desat' },
    400: errorResponse('El cos no és vàlid'),
    404: errorResponse('L’usuari encara no té perfil: l’app ha de fer abans `POST /perfil`'),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/perfil/dispositius/{token}',
  tags: ['Auth'],
  summary: 'Treu un Expo push token de l’usuari en tancar la sessió (ADR-0028)',
  request: {
    params: z.object({
      token: PushTokenSchema.meta({ description: 'El token, amb `encodeURIComponent`' }),
    }),
  },
  responses: {
    204: { description: 'El token ja no és de l’usuari (també si no hi era)' },
    400: errorResponse('El token no té el format d’un Expo push token'),
    ...ERRORS_AUTH,
  },
});

const missingDatabase = async (): Promise<never> => {
  throw new ApiError(
    503,
    'database_unavailable',
    "L'API no té DATABASE_URL: els dispositius no estan disponibles",
  );
};

/** `requireAuth` ja ha respost 401 si no hi ha usuari: aquí sempre hi és. */
function currentUserId(req: Request): string {
  const { user } = req as AuthenticatedRequest;
  if (!user) throw new ApiError(401, 'unauthorized', 'JWT invàlid o caducat');
  return user.id;
}

/** Sense `store` (no hi ha `DATABASE_URL`), les rutes responen 503 `database_unavailable`. */
export function createDispositiusRouter(
  store: PushDeviceStore | undefined,
  auth: AuthMiddlewareOptions,
): Router {
  const router = Router();
  const authenticate = requireAuth(auth);
  const devices: PushDeviceStore = store ?? {
    registerDevice: missingDatabase,
    removeDevice: missingDatabase,
  };

  router.put(
    '/perfil/dispositius',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authUserId = currentUserId(req);
        const device = DispositiuPushSchema.parse(req.body ?? {});
        const registered = await devices.registerDevice(authUserId, device);
        if (!registered) {
          return next(
            new ApiError(
              404,
              'profile_not_found',
              "L'usuari encara no té perfil (cal POST /perfil)",
            ),
          );
        }
        res.status(204).end();
        return undefined;
      } catch (error) {
        return next(error);
      }
    },
  );

  router.delete(
    '/perfil/dispositius/:token',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authUserId = currentUserId(req);
        // Express ja descodifica el paràmetre (`%5B` → `[`).
        const token = PushTokenSchema.parse(req.params.token);
        await devices.removeDevice(authUserId, token);
        res.status(204).end();
        return undefined;
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}

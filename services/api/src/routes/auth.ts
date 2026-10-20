import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import type { JwksSource } from '../middleware/auth';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import type { ProfileStore } from '../services/profileService';

export type AuthRouterOptions = {
  supabaseUrl?: string;
  /** Sense `DATABASE_URL`, `createApp` hi passa un store que respon 503. */
  profileStore: ProfileStore;
  jwks?: JwksSource;
};

/**
 * Dades que només té l'app. Apple només dona el nom el primer cop i no el posa al token: l'app
 * l'envia aquí (TG-249). Només s'aplica en crear el perfil.
 */
const ProfileEnsureBodySchema = z
  .object({ nom: z.string().trim().min(1).max(100).optional() })
  .meta({ id: 'ProfileEnsureBody' });

const ProfileEnsureResponseSchema = z
  .object({
    created: z.boolean(),
    profile: z.object({
      id: z.string(),
      authUserId: z.string(),
      email: z.string().nullable(),
      nom: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      dataCreacio: z.string(),
      dataActualitzacio: z.string(),
    }),
  })
  .meta({ id: 'ProfileEnsureResponse' });

registry.registerPath({
  method: 'post',
  path: '/perfil',
  tags: ['Auth'],
  summary: 'Assegura que l’usuari autenticat té un perfil a la base de dades',
  request: {
    body: {
      required: false,
      content: { 'application/json': { schema: ProfileEnsureBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'El perfil ja existia',
      content: { 'application/json': { schema: ProfileEnsureResponseSchema } },
    },
    201: {
      description: 'S’ha creat el perfil en aquest primer accés',
      content: { 'application/json': { schema: ProfileEnsureResponseSchema } },
    },
    401: {
      description: 'JWT no vàlid o absent',
      content: {
        'application/json': {
          schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        },
      },
    },
    503: {
      description: 'No es pot validar el JWT de Supabase',
      content: {
        'application/json': {
          schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        },
      },
    },
  },
});

export function createAuthRouter({ supabaseUrl, profileStore, jwks }: AuthRouterOptions): Router {
  const router = Router();
  const requireCurrentUser = requireAuth({ supabaseUrl, jwks });

  const handleProfileEnsure = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(new ApiError(401, 'unauthorized', 'JWT invàlid o caducat'));
    }

    try {
      // Sense cos (o sense Content-Type), Express deixa `req.body` buit.
      const { nom } = ProfileEnsureBodySchema.parse(req.body ?? {});
      const result = await profileStore.ensureProfile(authReq.user, { nom });
      res.status(result.created ? 201 : 200).json({
        created: result.created,
        profile: {
          id: result.profile.id,
          authUserId: result.profile.authUserId,
          email: result.profile.email,
          nom: result.profile.nom,
          avatarUrl: result.profile.avatarUrl,
          dataCreacio: result.profile.dataCreacio.toISOString(),
          dataActualitzacio: result.profile.dataActualitzacio.toISOString(),
        },
      });
      return undefined;
    } catch (error) {
      return next(error);
    }
  };

  router.post('/perfil', requireCurrentUser, handleProfileEnsure);

  return router;
}

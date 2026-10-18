import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import type { JwksSource } from '../middleware/auth';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import type { ProfileStore } from '../services/profileService';

export type AuthRouterOptions = {
  supabaseUrl?: string;
  profileStore?: ProfileStore;
  jwks?: JwksSource;
};

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
      content: { 'application/json': { schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }) } },
    },
    503: {
      description: 'No es pot validar el JWT de Supabase',
      content: { 'application/json': { schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }) } },
    },
  },
});

export function createAuthRouter({ supabaseUrl, profileStore, jwks }: AuthRouterOptions = {}): Router {
  const router = Router();
  const requireCurrentUser = requireAuth({ supabaseUrl, jwks });

  const handleProfileEnsure = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(new ApiError(401, 'unauthorized', 'JWT invàlid o caducat'));
    }

    if (!profileStore) {
      return next(
        new ApiError(503, 'database_unavailable', "L'API no té DATABASE_URL: el perfil d'usuari no està disponible"),
      );
    }

    try {
      const result = await profileStore.ensureProfile(authReq.user);
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

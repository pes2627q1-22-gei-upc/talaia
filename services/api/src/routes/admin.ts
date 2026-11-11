import type { UsuariAdmin, UsuariAdminCanvis } from '@talaia/shared';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import type { ProfileRecord, ProfileStore } from '../services/profileService';
import { ERRORS_AUTH, errorResponse, toPerfil } from './auth';

export type AdminRouterOptions = {
  /** El mateix `requireUser` que `/perfil`: un admin bloquejat tampoc no hi entra. */
  requireUser: RequestHandler;
  profileStore: ProfileStore;
};

const UsuariAdminSchema: z.ZodType<UsuariAdmin> = z
  .object({
    id: z.string(),
    rol: z.enum(['usuari', 'admin']),
    authUserId: z.string(),
    email: z.string().nullable(),
    nom: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    dataCreacio: z.string(),
    dataActualitzacio: z.string(),
    bloquejat: z.boolean(),
    dataBloqueig: z.string().nullable(),
  })
  .meta({ id: 'UsuariAdmin' });

const UsuariAdminCanvisSchema: z.ZodType<UsuariAdminCanvis> = z
  .strictObject({ bloquejat: z.boolean() })
  .meta({ id: 'UsuariAdminCanvis' });

const UsuariParamsSchema = z.object({
  id: z.uuid().meta({ description: 'L’`id` del perfil (`perfils.id`), no el de Supabase Auth' }),
});

const ERRORS_ADMIN = {
  ...ERRORS_AUTH,
  403: errorResponse(
    '`forbidden` si el compte no és administrador, o `account_blocked` si està bloquejat',
  ),
};

registry.registerPath({
  method: 'get',
  path: '/admin/usuaris',
  tags: ['Admin'],
  security: [{ BearerSupabase: [] }],
  summary: 'Comptes d’usuari, els més nous primer (només administradors, HU41)',
  responses: {
    200: {
      description: 'Tots els perfils, amb el rol i l’estat de bloqueig',
      content: { 'application/json': { schema: z.array(UsuariAdminSchema) } },
    },
    ...ERRORS_ADMIN,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/usuaris/{id}',
  tags: ['Admin'],
  security: [{ BearerSupabase: [] }],
  summary: 'Bloqueja o desbloqueja un compte (només administradors, HU41)',
  description:
    'Un compte bloquejat rep 403 `account_blocked` a totes les rutes autenticades de l’API, a partir de la petició següent. Tornar a bloquejar un compte bloquejat no en canvia `dataBloqueig`. Un administrador no es pot bloquejar a si mateix.',
  request: {
    params: UsuariParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UsuariAdminCanvisSchema } } },
  },
  responses: {
    200: {
      description: 'El compte amb el canvi',
      content: { 'application/json': { schema: UsuariAdminSchema } },
    },
    400: errorResponse(
      '`validation_error` si l’`id` o el cos no són vàlids; `cannot_block_self` si l’administrador es vol bloquejar a si mateix',
    ),
    404: errorResponse('`usuari_not_found`: cap perfil amb aquest `id`'),
    ...ERRORS_ADMIN,
  },
});

function toUsuariAdmin(profile: ProfileRecord): UsuariAdmin {
  return {
    ...toPerfil(profile),
    bloquejat: profile.bloquejat,
    dataBloqueig: profile.dataBloqueig?.toISOString() ?? null,
  };
}

/** Rutes de la web d'administració (`/api/v1/admin`). Totes demanen un compte admin no bloquejat. */
export function createAdminRouter({ requireUser, profileStore }: AdminRouterOptions): Router {
  const router = Router();
  router.use(requireUser, requireAdmin);

  router.get('/usuaris', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const profiles = await profileStore.listProfiles();
      res.set('Cache-Control', 'no-store').json(profiles.map(toUsuariAdmin));
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/usuaris/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = UsuariParamsSchema.parse(req.params);
      const { bloquejat } = UsuariAdminCanvisSchema.parse(req.body ?? {});
      // Si no, l'últim administrador es podria deixar fora sense poder-ho desfer des de la web.
      if (bloquejat && (req as AuthenticatedRequest).account?.perfilId === id) {
        return next(
          new ApiError(
            400,
            'cannot_block_self',
            'Un administrador no es pot bloquejar a si mateix',
          ),
        );
      }
      const profile = await profileStore.setBlocked(id, bloquejat);
      if (!profile) {
        return next(new ApiError(404, 'usuari_not_found', 'No hi ha cap usuari amb aquest id'));
      }
      res.set('Cache-Control', 'no-store').json(toUsuariAdmin(profile));
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

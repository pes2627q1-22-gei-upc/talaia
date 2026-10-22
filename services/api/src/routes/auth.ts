import type { Perfil, PerfilCanvis } from '@talaia/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import type { JwksSource } from '../middleware/auth';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import type { ProfileRecord, ProfileStore } from '../services/profileService';

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

const PerfilSchema: z.ZodType<Perfil> = z
  .object({
    id: z.string(),
    authUserId: z.string(),
    email: z.string().nullable(),
    nom: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    dataCreacio: z.string(),
    dataActualitzacio: z.string(),
  })
  .meta({ id: 'Perfil' });

const ProfileEnsureResponseSchema = z
  .object({ created: z.boolean(), profile: PerfilSchema })
  .meta({ id: 'ProfileEnsureResponse' });

/** HU36: de moment només es pot editar el nom. Un camp desconegut és un 400, no s'ignora. */
const PerfilCanvisSchema: z.ZodType<PerfilCanvis> = z
  .strictObject({ nom: z.string().trim().min(1).max(100) })
  .meta({ id: 'PerfilCanvis' });

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
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'get',
  path: '/perfil',
  tags: ['Auth'],
  summary: 'Perfil de l’usuari autenticat (HU36)',
  responses: {
    200: { description: 'El perfil', content: { 'application/json': { schema: PerfilSchema } } },
    404: errorResponse('L’usuari encara no té perfil: l’app ha de fer abans `POST /perfil`'),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/perfil',
  tags: ['Auth'],
  summary: 'Edita el perfil de l’usuari autenticat: de moment, el nom (HU36)',
  request: {
    body: { required: true, content: { 'application/json': { schema: PerfilCanvisSchema } } },
  },
  responses: {
    200: {
      description: 'El perfil amb els canvis',
      content: { 'application/json': { schema: PerfilSchema } },
    },
    400: errorResponse('El cos no és vàlid'),
    404: errorResponse('L’usuari encara no té perfil: l’app ha de fer abans `POST /perfil`'),
    ...ERRORS_AUTH,
  },
});

function toPerfil(profile: ProfileRecord): Perfil {
  return {
    id: profile.id,
    authUserId: profile.authUserId,
    email: profile.email,
    nom: profile.nom,
    avatarUrl: profile.avatarUrl,
    dataCreacio: profile.dataCreacio.toISOString(),
    dataActualitzacio: profile.dataActualitzacio.toISOString(),
  };
}

const profileNotFound = () =>
  new ApiError(404, 'profile_not_found', "L'usuari encara no té perfil (cal POST /perfil)");

/** `requireAuth` ja ha respost 401 si no hi ha usuari: aquí sempre hi és. */
function currentUser(req: Request) {
  const { user } = req as AuthenticatedRequest;
  if (!user) throw new ApiError(401, 'unauthorized', 'JWT invàlid o caducat');
  return user;
}

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
      // Dades personals: cap memòria cau (ni del mòbil ni d'un proxy) no les ha de desar.
      res.set('Cache-Control', 'no-store');
      res
        .status(result.created ? 201 : 200)
        .json({ created: result.created, profile: toPerfil(result.profile) });
      return undefined;
    } catch (error) {
      return next(error);
    }
  };

  const handleProfileGet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await profileStore.getProfile(currentUser(req).id);
      if (!profile) return next(profileNotFound());
      res.set('Cache-Control', 'no-store').json(toPerfil(profile));
      return undefined;
    } catch (error) {
      return next(error);
    }
  };

  const handleProfilePatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = currentUser(req);
      const changes = PerfilCanvisSchema.parse(req.body ?? {});
      const profile = await profileStore.updateProfile(user.id, changes);
      if (!profile) return next(profileNotFound());
      res.set('Cache-Control', 'no-store').json(toPerfil(profile));
      return undefined;
    } catch (error) {
      return next(error);
    }
  };

  router.post('/perfil', requireCurrentUser, handleProfileEnsure);
  router.get('/perfil', requireCurrentUser, handleProfileGet);
  router.patch('/perfil', requireCurrentUser, handleProfilePatch);

  return router;
}

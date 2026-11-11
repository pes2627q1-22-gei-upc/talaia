import type { Favorit, FavoritNou } from '@talaia/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';

import type { FavoritsService } from '../favorits/favoritsService';
import type { AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import { ERRORS_AUTH, errorResponse, profileNotFound } from './auth';
import { IndexMapaSchema } from './punts';

export type FavoritsRouterOptions = {
  /** `requireAuth` amb `accountStatus`: JWT vàlid i compte no bloquejat (`routes/index.ts`). */
  requireUser: RequestHandler;
  /** Sense `DATABASE_URL` no n'hi ha, i les rutes responen 503 `database_unavailable`. */
  service?: FavoritsService;
};

const PuntIdSchema = z
  .uuid({ error: 'puntId ha de ser un UUID' })
  .meta({ description: 'Id del punt (`id` de la fitxa i del GeoJSON del mapa)' });

/** Estricte: un camp de més (per exemple un `perfilId`) és un 400. L'usuari surt sempre del JWT. */
const FavoritNouSchema: z.ZodType<FavoritNou> = z
  .strictObject({ puntId: PuntIdSchema })
  .meta({ id: 'FavoritNou' });

const FavoritParamsSchema = z.object({ puntId: PuntIdSchema });

const FavoritSchema: z.ZodType<Favorit> = z
  .object({
    id: z.string().meta({
      description:
        'Id del punt: el de `GET /punts/{id}` (la fitxa) i el de `DELETE /favorits/{puntId}`',
    }),
    nom: z.string(),
    municipi: z.string(),
    lat: z.number(),
    lon: z.number(),
    index: IndexMapaSchema.nullable().meta({
      description:
        "Índex de l'hora en curs, com al mapa. `null` si el worker encara no l'ha calculat.",
    }),
    dataCreacio: z.iso.datetime().meta({ description: "Quan l'usuari el va desar als favorits" }),
  })
  .meta({ id: 'Favorit' });

const NO_PROFILE = '`profile_not_found`: l’usuari encara no té perfil (cal `POST /perfil`)';

registry.registerPath({
  method: 'post',
  path: '/favorits',
  tags: ['Favorits'],
  security: [{ BearerSupabase: [] }],
  summary: 'Desa un punt publicat als favorits de l’usuari autenticat (HU25)',
  description:
    'Idempotent: si el punt ja hi era, respon 200 amb el mateix favorit (no en canvia `dataCreacio`). Només es poden desar punts publicats.',
  request: {
    body: { required: true, content: { 'application/json': { schema: FavoritNouSchema } } },
  },
  responses: {
    200: {
      description: 'El punt ja era als favorits',
      content: { 'application/json': { schema: FavoritSchema } },
    },
    201: {
      description: 'S’ha desat el punt als favorits',
      content: { 'application/json': { schema: FavoritSchema } },
    },
    400: errorResponse('`validation_error`: el cos no és vàlid'),
    404: errorResponse(`${NO_PROFILE}, o \`punt_not_found\`: cap punt publicat amb aquest id`),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'get',
  path: '/favorits',
  tags: ['Favorits'],
  security: [{ BearerSupabase: [] }],
  summary: 'Els punts favorits de l’usuari autenticat, els més nous primer (HU26)',
  description:
    'Només els punts que encara són publicats: un punt retirat no hi surt, i hi torna si es torna a publicar. L’app hi mira si un punt és favorit (la fitxa és pública i no ho diu).',
  responses: {
    200: {
      description: 'Els favorits (una llista buida si no en té cap)',
      content: { 'application/json': { schema: z.array(FavoritSchema) } },
    },
    404: errorResponse(NO_PROFILE),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/favorits/{puntId}',
  tags: ['Favorits'],
  security: [{ BearerSupabase: [] }],
  summary: 'Treu un punt dels favorits de l’usuari autenticat (HU27)',
  description:
    'Idempotent: si el punt no hi era (o no existeix), també respon 204. També treu els punts retirats.',
  request: { params: FavoritParamsSchema },
  responses: {
    204: { description: 'El punt ja no és als favorits' },
    400: errorResponse('`validation_error`: `puntId` no és un UUID'),
    404: errorResponse(NO_PROFILE),
    ...ERRORS_AUTH,
  },
});

/**
 * El perfil de l'usuari del JWT, que `requireUser` ha llegit per mirar si està bloquejat. Mai no
 * surt de la petició: cadascú només pot llegir i tocar els seus favorits (RNF06).
 */
function currentPerfilId(req: Request): string {
  const perfilId = (req as AuthenticatedRequest).account?.perfilId;
  if (!perfilId) throw profileNotFound();
  return perfilId;
}

const databaseUnavailable = () =>
  new ApiError(
    503,
    'database_unavailable',
    "L'API no té DATABASE_URL: els favorits no estan disponibles",
  );

/** `/api/v1/favorits` (HU25–HU27, TG-169): els punts favorits de l'usuari autenticat. */
export function createFavoritsRouter({ requireUser, service }: FavoritsRouterOptions): Router {
  const router = Router();
  router.use(requireUser);

  router.post('/', async (req, res) => {
    const { puntId } = FavoritNouSchema.parse(req.body ?? {});
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    const { created, favorit } = await service.add(perfilId, puntId);
    // Dades personals: cap memòria cau (ni del mòbil ni d'un proxy) no les ha de desar.
    res
      .set('Cache-Control', 'no-store')
      .status(created ? 201 : 200)
      .json(favorit);
  });

  router.get('/', async (req, res) => {
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    res.set('Cache-Control', 'no-store').json(await service.list(perfilId));
  });

  router.delete('/:puntId', async (req, res) => {
    const { puntId } = FavoritParamsSchema.parse(req.params);
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    await service.remove(perfilId, puntId);
    res.set('Cache-Control', 'no-store').status(204).end();
  });

  return router;
}

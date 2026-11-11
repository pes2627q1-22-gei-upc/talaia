import type { Alerta, AlertaNova } from '@talaia/shared';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import { MAX_ALERTES, type AlertesStore } from '../alertes/alertesRepository';
import type { AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import { ERRORS_AUTH, errorResponse } from './auth';
import { OBJECTIUS } from './recomanacions';

export const DISTANCIA_MAXIMA_KM = 200;

export type AlertesRouterOptions = {
  /** `requireAuth` amb `accountStatus`: JWT vàlid i compte no bloquejat (`routes/index.ts`). */
  requireUser: RequestHandler;
  /** Sense `DATABASE_URL`, `createApp` hi passa un store que respon 503. */
  store: AlertesStore;
};

const OrigenSchema = z
  .strictObject({
    lat: z
      .number({ error: 'origen.lat ha de ser un número entre -90 i 90' })
      .min(-90, { error: 'origen.lat ha de ser un número entre -90 i 90' })
      .max(90, { error: 'origen.lat ha de ser un número entre -90 i 90' })
      .meta({ example: 41.3874 }),
    lon: z
      .number({ error: 'origen.lon ha de ser un número entre -180 i 180' })
      .min(-180, { error: 'origen.lon ha de ser un número entre -180 i 180' })
      .max(180, { error: 'origen.lon ha de ser un número entre -180 i 180' })
      .meta({ example: 2.1686 }),
  })
  .meta({ description: "D'on es mesura la distància (WGS84)" });

const enter = (camp: string, min: number, max: number) => {
  const missatge = `${camp} ha de ser un enter de ${min} a ${max}`;
  return z
    .number({ error: missatge })
    .int({ error: missatge })
    .min(min, { error: missatge })
    .max(max, { error: missatge });
};

/**
 * HU16: fenomen, distància màxima des d'un origen i índex mínim. Estricte: un camp desconegut
 * (per exemple un `perfilId`) és un 400. L'usuari surt sempre del JWT.
 */
const AlertaNovaSchema: z.ZodType<AlertaNova> = z
  .strictObject({
    objectiu: z
      .enum(OBJECTIUS, { error: `objectiu ha de ser un de: ${OBJECTIUS.join(', ')}` })
      .meta({ description: 'El fenomen: el mateix selector que «Què vols veure?»' }),
    origen: OrigenSchema,
    distanciaMaxKm: enter('distanciaMaxKm', 1, DISTANCIA_MAXIMA_KM).meta({
      description: "Radi en línia recta des de l'origen, en km",
      example: 60,
    }),
    indexMinim: enter('indexMinim', 0, 100).meta({
      description: 'Índex de visibilitat mínim per avisar',
      example: 70,
    }),
  })
  .meta({ id: 'AlertaNova' });

const AlertaSchema: z.ZodType<Alerta> = z
  .object({
    id: z.string(),
    objectiu: z.enum(OBJECTIUS),
    origen: z.object({ lat: z.number(), lon: z.number() }),
    distanciaMaxKm: z.number().int(),
    indexMinim: z.number().int(),
    activa: z.boolean(),
    dataCreacio: z.string(),
    dataActualitzacio: z.string(),
  })
  .meta({ id: 'Alerta' });

const PROFILE_NOT_FOUND = errorResponse(
  '`profile_not_found`: l’usuari encara no té perfil, l’app ha de fer abans `POST /perfil`',
);

registry.registerPath({
  method: 'post',
  path: '/alertes',
  tags: ['Alertes'],
  summary: 'Crea una alerta de l’usuari autenticat (HU16)',
  description: `L’alerta neix activa i només la veu qui l’ha creat. Com a molt ${MAX_ALERTES} per usuari.`,
  request: {
    body: { required: true, content: { 'application/json': { schema: AlertaNovaSchema } } },
  },
  responses: {
    201: {
      description: 'L’alerta creada',
      content: { 'application/json': { schema: AlertaSchema } },
    },
    400: errorResponse('El cos no és vàlid'),
    404: PROFILE_NOT_FOUND,
    409: errorResponse(
      `\`alert_limit_reached\`: l’usuari ja té ${MAX_ALERTES} alertes, n’ha d’esborrar alguna`,
    ),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'get',
  path: '/alertes',
  tags: ['Alertes'],
  summary: 'Les alertes de l’usuari autenticat, de la més nova a la més antiga (HU16)',
  responses: {
    200: {
      description: 'Les alertes (una llista buida si no en té cap)',
      content: { 'application/json': { schema: z.array(AlertaSchema) } },
    },
    404: PROFILE_NOT_FOUND,
    ...ERRORS_AUTH,
  },
});

const profileNotFound = () =>
  new ApiError(404, 'profile_not_found', "L'usuari encara no té perfil (cal POST /perfil)");

const alertLimitReached = () =>
  new ApiError(
    409,
    'alert_limit_reached',
    `Ja tens ${MAX_ALERTES} alertes: n'has d'esborrar alguna per crear-ne una de nova`,
  );

/**
 * El perfil de l'usuari del JWT, que `requireUser` ja ha llegit (i ha rebutjat si està bloquejat).
 * `null` si encara no té perfil.
 */
function currentPerfilId(req: Request): string | null {
  return (req as AuthenticatedRequest).account?.perfilId ?? null;
}

export function createAlertesRouter({ requireUser, store }: AlertesRouterOptions): Router {
  const router = Router();

  const handleCreate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perfilId = currentPerfilId(req);
      if (!perfilId) return next(profileNotFound());
      const alertaNova = AlertaNovaSchema.parse(req.body ?? {});
      const result = await store.create(perfilId, alertaNova);
      if (!result.ok) return next(alertLimitReached());
      // Dades personals: cap memòria cau (ni del mòbil ni d'un proxy) no les ha de desar.
      res.set('Cache-Control', 'no-store').status(201).json(result.alerta);
      return undefined;
    } catch (error) {
      return next(error);
    }
  };

  const handleList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perfilId = currentPerfilId(req);
      if (!perfilId) return next(profileNotFound());
      res.set('Cache-Control', 'no-store').json(await store.list(perfilId));
      return undefined;
    } catch (error) {
      return next(error);
    }
  };

  router.post('/', requireUser, handleCreate);
  router.get('/', requireUser, handleList);

  return router;
}

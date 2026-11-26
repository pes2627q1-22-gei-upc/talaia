import type { CalendariPla, Pla, PlaCanvis, PlaNou, QuanPlans } from '@talaia/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import type { PlansService } from '../plans/plansService';
import { ERRORS_AUTH, errorResponse, profileNotFound } from './auth';

export type PlansRouterOptions = {
  /** `requireAuth` amb `accountStatus`: JWT vàlid i compte no bloquejat (`routes/index.ts`). */
  requireUser: RequestHandler;
  /** Sense `DATABASE_URL` no n'hi ha, i les rutes responen 503 `database_unavailable`. */
  service?: PlansService;
};

const QUAN = ['futurs', 'passats'] as const satisfies readonly QuanPlans[];

/** Amb zona obligatòria (`Z` o `+01:00`): una hora sense zona seria ambigua. Es desa en UTC. */
const dataHora = (camp: string) =>
  z.iso.datetime({ offset: true, error: `${camp} ha de ser una data ISO 8601 amb zona` });

/** Opcional: absent o `null` vol dir que no n'hi ha. */
const textOpcional = (camp: string, max: number) =>
  z
    .string({ error: `${camp} ha de ser un text` })
    .min(1, { error: `${camp} no pot ser buit` })
    .max(max, { error: `${camp} pot tenir com a molt ${max} caràcters` })
    .nullable()
    .optional();

const puntIdSchema = z
  .uuid({ error: 'puntId ha de ser un UUID' })
  .meta({ description: 'Un punt publicat (`id` de la fitxa i del GeoJSON del mapa)' });

const esdevenimentIdSchema = z
  .string({ error: 'esdevenimentId ha de ser un text' })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: "esdevenimentId ha de ser l'id d'un esdeveniment",
  })
  .max(200, { error: "esdevenimentId ha de ser l'id d'un esdeveniment" })
  .nullable()
  .optional()
  .meta({
    description: 'L’`id` de `GET /esdeveniments/{id}`. Absent o `null`: sense fenomen concret',
    example: 'perseids-2027',
  });

const dataHoraFiSchema = dataHora('dataHoraFi')
  .nullable()
  .optional()
  .meta({ description: 'Posterior a `dataHoraInici`', example: '2026-11-21T01:00:00Z' });

/**
 * HU12: punt, fenomen (opcional), data i hora. Estricte: un camp desconegut (per exemple un
 * `perfilId`) és un 400. L'usuari surt sempre del JWT. No es comprova que la data sigui futura: ho fa
 * l'app (TG-157).
 */
const PlaNouSchema: z.ZodType<PlaNou> = z
  .strictObject({
    puntId: puntIdSchema,
    esdevenimentId: esdevenimentIdSchema,
    dataHoraInici: dataHora('dataHoraInici').meta({ example: '2026-11-20T21:00:00Z' }),
    dataHoraFi: dataHoraFiSchema,
    calendariEventId: textOpcional('calendariEventId', 255).meta({
      description: 'Id de l’esdeveniment al calendari del mòbil (TG-158)',
    }),
    notes: textOpcional('notes', 1000),
  })
  .refine(
    ({ dataHoraInici, dataHoraFi }) =>
      !dataHoraFi || Date.parse(dataHoraFi) > Date.parse(dataHoraInici),
    { error: 'dataHoraFi ha de ser posterior a dataHoraInici', path: ['dataHoraFi'] },
  )
  .meta({ id: 'PlaNou' });

/**
 * HU14 (TG-161): els camps que canvien, i almenys un. Estricte, com el POST: el vincle al calendari
 * no hi és (va per `PUT /plans/{id}/calendari`) i un camp desconegut és un 400. Les regles que
 * depenen del pla actual (final posterior a l'inici resultant, pla acabat, inici al passat) les
 * comprova el servei.
 */
const PlaCanvisSchema: z.ZodType<PlaCanvis> = z
  .strictObject({
    puntId: puntIdSchema.optional(),
    esdevenimentId: esdevenimentIdSchema,
    dataHoraInici: dataHora('dataHoraInici')
      .optional()
      .meta({ description: 'No pot ser una hora passada', example: '2026-11-20T22:00:00Z' }),
    dataHoraFi: dataHoraFiSchema,
    notes: textOpcional('notes', 1000),
  })
  .refine((canvis) => Object.keys(canvis).length > 0, {
    error: 'Cal almenys un camp per modificar',
  })
  .meta({ id: 'PlaCanvis' });

const PlansQuerySchema = z.object({
  quan: z
    .enum(QUAN, { error: `quan ha de ser un de: ${QUAN.join(', ')}` })
    .optional()
    .meta({
      description:
        'Futurs: els que no s’han acabat (a `dataHoraFi` o, si no en té, a les 12:00 locals de després de la nit de `dataHoraInici`), del més proper al més llunyà. Passats: la resta, del més recent al més antic. Sense: tots, per data.',
    }),
});

const PlaParamsSchema = z.object({
  id: z.uuid({ error: 'id ha de ser un UUID' }).meta({ description: 'L’`id` del pla' }),
});

const CalendariPlaSchema: z.ZodType<CalendariPla> = z
  .strictObject({
    calendariEventId: z.string().trim().min(1).max(255),
  })
  .meta({ id: 'CalendariPla' });

const PlaSchema: z.ZodType<Pla> = z
  .object({
    id: z.string(),
    punt: z.object({
      id: z.string().meta({ description: 'Id del punt: el de `GET /punts/{id}`' }),
      nom: z.string(),
      municipi: z.string(),
      publicat: z.boolean().meta({
        description: '`false` si el punt s’ha retirat després de crear el pla: el pla es conserva',
      }),
    }),
    esdevenimentId: z.string().nullable(),
    dataHoraInici: z.iso.datetime(),
    dataHoraFi: z.iso.datetime().nullable(),
    calendariEventId: z.string().nullable(),
    notes: z.string().nullable(),
    dataCreacio: z.iso.datetime(),
    dataActualitzacio: z.iso.datetime(),
  })
  .meta({ id: 'Pla' });

/** El nom del punt segueix `Accept-Language`, com a `/punts` (TG-164). */
const AcceptLanguageHeaders = z.object({
  'Accept-Language': z.string().optional().meta({ example: 'es-ES,es;q=0.9' }),
});

const NO_PROFILE = '`profile_not_found`: l’usuari encara no té perfil (cal `POST /perfil`)';

registry.registerPath({
  method: 'post',
  path: '/plans',
  tags: ['Plans'],
  security: [{ BearerSupabase: [] }],
  summary: 'Crea un pla d’observació de l’usuari autenticat (HU12)',
  description:
    'Només es pot crear amb un punt publicat i, si n’hi ha, un esdeveniment que `GET /esdeveniments/{id}` retorni. Com a molt 20 plans pendents (els passats no hi compten) i un sol pla per punt i hora d’inici. Respon el mateix `Pla` que el GET. Les dates es desen en UTC.',
  request: {
    headers: AcceptLanguageHeaders,
    body: { required: true, content: { 'application/json': { schema: PlaNouSchema } } },
  },
  responses: {
    201: {
      description: 'El pla creat',
      content: { 'application/json': { schema: PlaSchema } },
    },
    400: errorResponse(
      '`validation_error`: el cos no és vàlid (també si `dataHoraFi` no és posterior a `dataHoraInici`)',
    ),
    404: errorResponse(NO_PROFILE),
    409: errorResponse(
      '`plan_limit_reached`: ja té 20 plans pendents; `plan_already_exists`: ja té un pla en aquest punt a la mateixa hora d’inici',
    ),
    422: errorResponse(
      '`punt_not_found`: cap punt publicat amb aquest id; `event_not_found`: cap esdeveniment públic amb aquest id (el de `GET /esdeveniments/{id}`)',
    ),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'get',
  path: '/plans',
  tags: ['Plans'],
  security: [{ BearerSupabase: [] }],
  summary: 'Els plans de l’usuari autenticat, per data (HU12, TG-160)',
  description:
    'També els d’un punt retirat després de crear-los (`punt.publicat: false`). Els noms segueixen `Accept-Language` (ca, es, en; reserva ca).',
  request: { headers: AcceptLanguageHeaders, query: PlansQuerySchema },
  responses: {
    200: {
      description: 'Els plans (una llista buida si no en té cap)',
      content: { 'application/json': { schema: z.array(PlaSchema) } },
    },
    400: errorResponse('`validation_error`: `quan` no és `futurs` ni `passats`'),
    404: errorResponse(NO_PROFILE),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'get',
  path: '/plans/{id}',
  tags: ['Plans'],
  security: [{ BearerSupabase: [] }],
  summary: 'Un pla de l’usuari autenticat (HU12)',
  description: 'Un pla d’un altre usuari respon igual que un que no existeix.',
  request: { headers: AcceptLanguageHeaders, params: PlaParamsSchema },
  responses: {
    200: {
      description: 'El pla',
      content: { 'application/json': { schema: PlaSchema } },
    },
    400: errorResponse('`validation_error`: l’`id` no és un UUID'),
    404: errorResponse(
      `\`plan_not_found\`: l’usuari no té cap pla amb aquest \`id\`; ${NO_PROFILE}`,
    ),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/plans/{id}',
  tags: ['Plans'],
  security: [{ BearerSupabase: [] }],
  summary: 'Modifica un pla de l’usuari autenticat (HU14, TG-161)',
  description:
    'Només els camps enviats; `null` treu el fenomen, el final o les notes. Les comprovacions es fan sobre el pla resultant (l’actual amb els canvis): el punt ha de ser publicat (també si no es canvia: el pla d’un punt retirat s’ha de moure a un altre), el fenomen públic, el final posterior a l’inici i cap altre pla de l’usuari al mateix punt i hora. Un pla acabat no es pot modificar; un de començat sí, però l’inici no es pot moure a una hora passada. El vincle al calendari no canvia (`PUT /plans/{id}/calendari`). Respon el mateix `Pla` que el GET.',
  request: {
    headers: AcceptLanguageHeaders,
    params: PlaParamsSchema,
    body: { required: true, content: { 'application/json': { schema: PlaCanvisSchema } } },
  },
  responses: {
    200: {
      description: 'El pla modificat, amb `dataActualitzacio` al dia',
      content: { 'application/json': { schema: PlaSchema } },
    },
    400: errorResponse(
      '`validation_error`: l’`id` o el cos no són vàlids (cos buit, camp desconegut), el final no és posterior a l’inici del pla resultant o l’inici nou ja ha passat',
    ),
    404: errorResponse(
      `\`plan_not_found\`: l’usuari no té cap pla amb aquest \`id\`; ${NO_PROFILE}`,
    ),
    409: errorResponse(
      '`plan_finished`: el pla ja ha acabat; `plan_already_exists`: ja té un altre pla en aquest punt a la mateixa hora d’inici',
    ),
    422: errorResponse(
      '`punt_not_found`: el punt del pla resultant no és publicat; `event_not_found`: el fenomen no és cap esdeveniment públic',
    ),
    ...ERRORS_AUTH,
  },
});

/**
 * El perfil de l'usuari del JWT, que `requireUser` ha llegit per mirar si està bloquejat. Mai no
 * surt de la petició: cadascú només pot llegir els seus plans (RNF06).
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
    "L'API no té DATABASE_URL: els plans no estan disponibles",
  );

const NO_CACHE = { 'Cache-Control': 'no-store', Vary: 'Accept-Language' };

registry.registerPath({
  method: 'put',
  path: '/plans/{id}/calendari',
  tags: ['Plans'],
  security: [{ BearerSupabase: [] }],
  summary: 'Vincula un pla propi amb l’esdeveniment del calendari del mòbil (TG-158)',
  description:
    'Idempotent. Només desa l’identificador: l’esdeveniment el crea el mòbil amb permís de l’usuari. No modifica el punt, les dates, el fenomen ni les notes.',
  request: {
    params: PlaParamsSchema,
    body: { required: true, content: { 'application/json': { schema: CalendariPlaSchema } } },
  },
  responses: {
    204: { description: 'Vincle desat' },
    400: errorResponse('`validation_error`: id o cos invàlid'),
    404: errorResponse(
      '`plan_not_found`: el pla no existeix o és d’un altre usuari; `profile_not_found`: sense perfil',
    ),
    ...ERRORS_AUTH,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/plans/{id}',
  tags: ['Plans'],
  security: [{ BearerSupabase: [] }],
  summary: 'Esborra un pla de l’usuari autenticat (HU15, TG-162)',
  description:
    'Un pla d’un altre usuari respon igual que un que no existeix. No toca el calendari del mòbil: l’esdeveniment (`calendariEventId`) l’esborra l’app.',
  request: { params: PlaParamsSchema },
  responses: {
    204: { description: 'Pla esborrat' },
    400: errorResponse('`validation_error`: l’`id` no és un UUID'),
    404: errorResponse(
      `\`plan_not_found\`: l’usuari no té cap pla amb aquest \`id\`; ${NO_PROFILE}`,
    ),
    ...ERRORS_AUTH,
  },
});

/** `/api/v1/plans` (HU12, TG-156): els plans d'observació de l'usuari autenticat. */
export function createPlansRouter({ requireUser, service }: PlansRouterOptions): Router {
  const router = Router();
  router.use(requireUser);

  router.post('/', async (req, res) => {
    const pla = PlaNouSchema.parse(req.body ?? {});
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    // Dades personals: cap memòria cau (ni del mòbil ni d'un proxy) no les ha de desar.
    res
      .set(NO_CACHE)
      .status(201)
      .json(await service.create(perfilId, pla, req.get('Accept-Language')));
  });

  router.get('/', async (req, res) => {
    const { quan } = PlansQuerySchema.parse(req.query);
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    res.set(NO_CACHE).json(await service.list(perfilId, quan, req.get('Accept-Language')));
  });

  router.get('/:id', async (req, res) => {
    const { id } = PlaParamsSchema.parse(req.params);
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    res.set(NO_CACHE).json(await service.get(perfilId, id, req.get('Accept-Language')));
  });

  router.patch('/:id', async (req, res) => {
    const { id } = PlaParamsSchema.parse(req.params);
    const canvis = PlaCanvisSchema.parse(req.body ?? {});
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    res.set(NO_CACHE).json(await service.update(perfilId, id, canvis, req.get('Accept-Language')));
  });

  router.put('/:id/calendari', async (req, res) => {
    const { id } = PlaParamsSchema.parse(req.params);
    const { calendariEventId } = CalendariPlaSchema.parse(req.body ?? {});
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    await service.setCalendarEvent(perfilId, id, calendariEventId);
    res.set(NO_CACHE).status(204).end();
  });

  router.delete('/:id', async (req, res) => {
    const { id } = PlaParamsSchema.parse(req.params);
    const perfilId = currentPerfilId(req);
    if (!service) throw databaseUnavailable();
    await service.delete(perfilId, id);
    res.set(NO_CACHE).status(204).end();
  });

  return router;
}

import type { PuntAdmin, PuntAdminCanvis, PuntAdminNou } from '@talaia/shared';
import { Router } from 'express';
import { z } from 'zod';

import { SLUG_PUNT_REFERENCIA } from '../esdeveniments/esdevenimentsRepository';
import { ApiError } from '../middleware/errors';
import { registry } from '../openapi';
import { MATEIX_LLOC_M } from '../punts/puntsAdminRepository';
import type { PuntsAdminService } from '../punts/puntsAdminService';
import { ERRORS_AUTH, errorResponse } from './auth';
import { DireccioHoritzoSchema } from './punts';

/** Catalunya amb marge, la caixa amb què es valida el catàleg (`data/scripts/punts.ts`). */
const CATALUNYA = { minLon: 0.15, maxLon: 3.35, minLat: 40.5, maxLat: 42.9 };
/** Metres: la Pica d'Estats en fa 3.143. */
const ALTITUD_MAXIMA = 3200;
/** El rang que admet `punts_observacio.sqm` (ADR-0020). */
const SQM = { min: 10, max: 23 };

const ERRORS_ADMIN = {
  ...ERRORS_AUTH,
  403: errorResponse(
    '`forbidden` si el compte no és administrador, o `account_blocked` si està bloquejat',
  ),
};

const text = (max: number) => z.string().trim().min(1).max(max);

const SlugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: 'slug: només minúscules sense accents, xifres i guions (kebab-case)',
  })
  .meta({ description: 'Únic i estable: no es pot canviar', example: 'mirador-del-montsec' });

/** Els camps que es poden posar en crear un punt i canviar després. */
const camps = {
  nom: text(100),
  municipi: text(100),
  descripcio: text(1000),
  lat: z
    .number()
    .min(CATALUNYA.minLat)
    .max(CATALUNYA.maxLat)
    .meta({ description: 'Graus WGS84, dins de Catalunya', example: 42.0244 }),
  lon: z
    .number()
    .min(CATALUNYA.minLon)
    .max(CATALUNYA.maxLon)
    .meta({ description: 'Graus WGS84, dins de Catalunya', example: 0.7364 }),
  altitud: z
    .number()
    .int()
    .min(0)
    .max(ALTITUD_MAXIMA)
    .nullable()
    .optional()
    .meta({ description: 'Metres sobre el nivell del mar' }),
  horitzoObert: z
    .array(DireccioHoritzoSchema)
    .min(1)
    .refine((direccions) => new Set(direccions).size === direccions.length, {
      error: 'horitzoObert: hi ha direccions repetides',
    })
    .nullable()
    .optional()
    .meta({ description: "Direccions amb l'horitzó obert (aproximat). `null` si no és clar." }),
  accessibilitat: text(300)
    .nullable()
    .optional()
    .meta({ description: "Com s'hi arriba. Per buidar-la, `null`" }),
  sqm: z.number().min(SQM.min).max(SQM.max).nullable().optional().meta({
    description:
      'Foscor del cel en mag/arcsec² (ADR-0020), es desa amb 2 decimals. Sense, `null`: la fórmula hi posa la foscor estimada.',
    example: 21.3,
  }),
  estat: z.enum(['PUBLICAT', 'DESACTIVAT']).optional().meta({
    description:
      '`PUBLICAT` surt a l’app; `DESACTIVAT` és un punt retirat, que no surt enlloc de l’app però no s’esborra.',
  }),
};

const PuntAdminNouSchema: z.ZodType<PuntAdminNou> = z
  .strictObject({ slug: SlugSchema, ...camps })
  .meta({ id: 'PuntAdminNou' });

const PuntAdminCanvisSchema: z.ZodType<PuntAdminCanvis> = z
  .strictObject(camps)
  .partial()
  .refine((canvis) => Object.keys(canvis).length > 0, {
    error: 'Cal com a mínim un camp per canviar',
  })
  .refine((canvis) => (canvis.lat === undefined) === (canvis.lon === undefined), {
    error: 'lat i lon es canvien junts',
  })
  .meta({ id: 'PuntAdminCanvis' });

const PuntAdminSchema: z.ZodType<PuntAdmin> = z
  .object({
    id: z.string(),
    slug: z.string(),
    nom: z.string(),
    municipi: z.string(),
    descripcio: z.string(),
    altitud: z.number().int().nullable(),
    horitzoObert: z.array(DireccioHoritzoSchema).nullable(),
    accessibilitat: z.string().nullable(),
    lat: z.number(),
    lon: z.number(),
    sqm: z.number().nullable().meta({
      description: 'Foscor del cel en mag/arcsec² (ADR-0020). `null` si no està calculada.',
    }),
    estat: z.enum(['PENDENT', 'PUBLICAT', 'REBUTJAT', 'DESACTIVAT']).meta({
      description:
        'Només els `PUBLICAT` surten a l’app. `PENDENT` i `REBUTJAT` són dels punts proposats (HU28).',
    }),
    origen: z.enum(['OFICIAL', 'COMUNITAT']),
    dataCreacio: z.string(),
    dataActualitzacio: z.string(),
  })
  .meta({ id: 'PuntAdmin' });

const PuntParamsSchema = z.object({
  id: z.uuid({ error: 'id ha de ser un UUID' }).meta({ description: 'Id del punt' }),
});

const noTrobat = errorResponse('`punt_not_found`: cap punt amb aquest `id`');

registry.registerPath({
  method: 'get',
  path: '/admin/punts',
  tags: ['Admin'],
  security: [{ BearerSupabase: [] }],
  summary: 'Tots els punts del catàleg, en qualsevol estat (només administradors, HU39)',
  responses: {
    200: {
      description: 'Els punts per `slug`, també els retirats',
      content: { 'application/json': { schema: z.array(PuntAdminSchema) } },
    },
    ...ERRORS_ADMIN,
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/punts',
  tags: ['Admin'],
  security: [{ BearerSupabase: [] }],
  summary: 'Crea un punt oficial (només administradors, HU39)',
  description:
    'El punt és `OFICIAL` i, si no es diu el contrari, `PUBLICAT`: surt a `/punts` a la petició següent, amb l’índex a `null` fins que el worker el calcula a la propera hora. Sense `sqm`, té la foscor estimada; el perfil d’horitzó (`horitzo`) queda per calcular.',
  request: {
    body: { required: true, content: { 'application/json': { schema: PuntAdminNouSchema } } },
  },
  responses: {
    201: {
      description: 'El punt creat',
      headers: z.object({
        Location: z.string().meta({ example: '/api/v1/admin/punts/7d3f2c1a-…' }),
      }),
      content: { 'application/json': { schema: PuntAdminSchema } },
    },
    400: errorResponse('`validation_error`: el cos no és vàlid'),
    409: errorResponse('`slug_already_exists`: ja hi ha un punt amb aquest `slug`'),
    ...ERRORS_ADMIN,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/punts/{id}',
  tags: ['Admin'],
  security: [{ BearerSupabase: [] }],
  summary: 'Un punt en qualsevol estat (només administradors, HU39)',
  request: { params: PuntParamsSchema },
  responses: {
    200: {
      description: 'El punt',
      content: { 'application/json': { schema: PuntAdminSchema } },
    },
    400: errorResponse('`validation_error`: l’`id` no és un UUID'),
    404: noTrobat,
    ...ERRORS_ADMIN,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/punts/{id}',
  tags: ['Admin'],
  security: [{ BearerSupabase: [] }],
  summary: 'Edita, retira o torna a publicar un punt (només administradors, HU39)',
  description: `Només canvien els camps que s’envien; l’\`slug\` no es pot canviar. **Retirar** un punt és \`{ "estat": "DESACTIVAT" }\`: deixa de sortir a \`/punts\`, \`/punts/{id}\` (404) i \`/recomanacions\` a la petició següent, i el worker ja no en calcula l’índex. No s’esborra mai, perquè l’índex i els favorits hi apunten; \`{ "estat": "PUBLICAT" }\` el torna a publicar. Si \`lat\` i \`lon\` el mouen més de ${MATEIX_LLOC_M} m, \`sqm\` (si no s’envia), el perfil d’horitzó i l’estació XEMA tornen a \`null\`.`,
  request: {
    params: PuntParamsSchema,
    body: { required: true, content: { 'application/json': { schema: PuntAdminCanvisSchema } } },
  },
  responses: {
    200: {
      description: 'El punt amb els canvis',
      content: { 'application/json': { schema: PuntAdminSchema } },
    },
    400: errorResponse('`validation_error`: l’`id` o el cos no són vàlids'),
    404: noTrobat,
    409: errorResponse(
      `\`reference_point_required\`: el punt de referència del calendari d’Aprop (\`${SLUG_PUNT_REFERENCIA}\`, ADR-0026) no es pot retirar`,
    ),
    ...ERRORS_ADMIN,
  },
});

const databaseUnavailable = () =>
  new ApiError(
    503,
    'database_unavailable',
    "L'API no té DATABASE_URL: el catàleg de punts no està disponible",
  );

/**
 * `/admin/punts`. No posa l'autenticació: el munta `createAdminRouter`, després de `requireUser` i
 * `requireAdmin`. Sense `service` (no hi ha `DATABASE_URL`), les rutes responen 503.
 */
export function createAdminPuntsRouter(service: PuntsAdminService | undefined): Router {
  const router = Router();
  const servei = () => {
    if (!service) throw databaseUnavailable();
    return service;
  };

  router.get('/', async (_req, res) => {
    const punts = await servei().list();
    res.set('Cache-Control', 'no-store').json(punts);
  });

  router.post('/', async (req, res) => {
    const nou = PuntAdminNouSchema.parse(req.body ?? {});
    const punt = await servei().create(nou);
    res
      .status(201)
      .location(`${req.baseUrl}/${punt.id}`)
      .set('Cache-Control', 'no-store')
      .json(punt);
  });

  router.get('/:id', async (req, res) => {
    const { id } = PuntParamsSchema.parse(req.params);
    const punt = await servei().get(id);
    res.set('Cache-Control', 'no-store').json(punt);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = PuntParamsSchema.parse(req.params);
    const canvis = PuntAdminCanvisSchema.parse(req.body ?? {});
    const punt = await servei().update(id, canvis);
    res.set('Cache-Control', 'no-store').json(punt);
  });

  return router;
}

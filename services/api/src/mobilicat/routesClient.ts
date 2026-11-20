import { MODES_RUTA } from '@talaia/shared';
import { z } from 'zod';

/** Modes que accepta `GET /routes` de Mobilicat. */
export const MobilicatModeSchema = z.enum(MODES_RUTA);
export type MobilicatMode = z.infer<typeof MobilicatModeSchema>;

export const MobilicatTimePreferenceSchema = z.enum(['ARRIVE_BY', 'DEPART_AT']);
export type MobilicatTimePreference = z.infer<typeof MobilicatTimePreferenceSchema>;

const CoordinatesSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
});

export const MobilicatRoutesQuerySchema = z
  .object({
    from: CoordinatesSchema,
    to: CoordinatesSchema,
    time: z.iso.datetime({ offset: true }),
    timePreference: MobilicatTimePreferenceSchema,
    modes: z.array(MobilicatModeSchema).min(1).max(5),
    limit: z.number().int().min(1).max(5),
  })
  .refine(({ modes }) => new Set(modes).size === modes.length, {
    path: ['modes'],
    message: 'Els modes de Mobilicat no es poden repetir',
  });
export type MobilicatRoutesQuery = z.infer<typeof MobilicatRoutesQuerySchema>;

const MobilicatStretchSchema = z.object({
  sequence: z.number().int().nonnegative(),
  mode: MobilicatModeSchema,
  transitMode: z.string().optional(),
  lineShortName: z.string().nullable().optional(),
  lineLongName: z.string().nullable().optional(),
  agencyName: z.string().nullable().optional(),
});

const MobilicatDateTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

// El contracte declara enters; arrodonim fraccions si el proveïdor les retorna igualment.
const MobilicatRouteSchema = z.object({
  startTime: MobilicatDateTimeSchema,
  endTime: MobilicatDateTimeSchema,
  durationSeconds: z.number().finite().nonnegative().transform(Math.round),
  distanceMeters: z.number().finite().nonnegative().transform(Math.round),
  transfers: z.number().int().nonnegative(),
  stretches: z.array(MobilicatStretchSchema).min(1),
});

// Es valida cada alternativa a part perquè una de malformada no invalidi les altres.
const MobilicatRoutesResponseSchema = z.object({ routes: z.array(z.unknown()) });
export type MobilicatRoute = z.infer<typeof MobilicatRouteSchema>;

export type MobilicatRoutesClient = {
  getRoutes(query: MobilicatRoutesQuery): Promise<MobilicatRoute[]>;
};

export type MobilicatRoutesClientOptions = {
  /** URL base configurable, per defecte `https://api.mobili.cat`. */
  baseUrl: string;
  /** Timeout en mil·lisegons. */
  timeoutMs?: number;
  /** Injectable a les proves; per defecte, el `fetch` global de Node. */
  fetch?: typeof fetch;
};

export type MobilicatRoutesErrorKind = 'timeout' | 'network' | 'http' | 'invalid_response';

/** Error tipat perquè la capa de servei decideixi com respondre a l'app sense exposar el proveïdor. */
export class MobilicatRoutesError extends Error {
  constructor(
    readonly kind: MobilicatRoutesErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MobilicatRoutesError';
  }
}

export const MOBILICAT_ROUTES_TIMEOUT_MS = 5_000;

/** `/routes` rep coordenades decimals; sis decimals equivalen a una precisió d'uns 11 cm. */
const coordenadaDecimal = (value: number): string => value.toFixed(6);

function urlPer(baseUrl: string, query: MobilicatRoutesQuery): URL {
  const url = new URL(baseUrl);
  const basePath = url.pathname;
  let pathLength = basePath.length;
  while (pathLength > 0 && basePath[pathLength - 1] === '/') pathLength -= 1;
  url.pathname = `${basePath.slice(0, pathLength)}/routes`;
  url.search = '';
  url.hash = '';
  url.searchParams.set(
    'from',
    `${coordenadaDecimal(query.from.lat)},${coordenadaDecimal(query.from.lon)}`,
  );
  url.searchParams.set(
    'to',
    `${coordenadaDecimal(query.to.lat)},${coordenadaDecimal(query.to.lon)}`,
  );
  url.searchParams.set('time', query.time);
  url.searchParams.set('timePreference', query.timePreference);
  url.searchParams.set('modes', query.modes.join(','));
  url.searchParams.set('limit', String(query.limit));
  return url;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createMobilicatRoutesClient({
  baseUrl,
  timeoutMs = MOBILICAT_ROUTES_TIMEOUT_MS,
  fetch: doFetch = fetch,
}: MobilicatRoutesClientOptions): MobilicatRoutesClient {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`timeoutMs ha de ser un nombre positiu (rebut: ${timeoutMs})`);
  }

  return {
    async getRoutes(input) {
      const query = MobilicatRoutesQuerySchema.parse(input);
      let response: Response;
      try {
        response = await doFetch(urlPer(baseUrl, query), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const kind =
          error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
        throw new MobilicatRoutesError(
          kind,
          kind === 'timeout'
            ? `Mobilicat no ha respost en ${timeoutMs} ms`
            : `No s'ha pogut contactar amb Mobilicat: ${errorMessage(error)}`,
        );
      }

      if (!response.ok) {
        try {
          await response.body?.cancel();
        } catch {
          // La cancel·lació només allibera recursos; no ha d'amagar l'error HTTP original.
        }
        throw new MobilicatRoutesError(
          'http',
          `Mobilicat ha respost ${response.status}`,
          response.status,
        );
      }

      const body: unknown = await response.json().catch(() => undefined);
      const parsed = MobilicatRoutesResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MobilicatRoutesError(
          'invalid_response',
          'Mobilicat ha retornat una resposta de rutes invàlida',
          response.status,
        );
      }

      const routes = parsed.data.routes.flatMap((route) => {
        const routeParsed = MobilicatRouteSchema.safeParse(route);
        return routeParsed.success ? [routeParsed.data] : [];
      });
      if (parsed.data.routes.length > 0 && routes.length === 0) {
        throw new MobilicatRoutesError(
          'invalid_response',
          'Mobilicat no ha retornat cap alternativa de ruta vàlida',
          response.status,
        );
      }

      return routes.slice(0, query.limit);
    },
  };
}

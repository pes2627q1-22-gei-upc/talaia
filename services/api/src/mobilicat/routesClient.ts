import { z } from 'zod';

/** Modes que accepta `GET /routes` de Mobilicat. */
export const MobilicatModeSchema = z.enum([
  'WALK',
  'BIKE',
  'BIKE_SHARE',
  'CAR',
  'PUBLIC_TRANSPORT',
]);
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

const MobilicatRouteSchema = z.object({
  startTime: MobilicatDateTimeSchema,
  endTime: MobilicatDateTimeSchema,
  durationSeconds: z.number().int().nonnegative(),
  distanceMeters: z.number().int().nonnegative(),
  walkDistanceMeters: z.number().int().nonnegative(),
  transfers: z.number().int().nonnegative(),
  stretches: z.array(MobilicatStretchSchema).min(1),
});

const MobilicatRoutesResponseSchema = z.object({ routes: z.array(MobilicatRouteSchema) });
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

/** Escriu els nombres decimals sense notació exponencial, que `/routes` no accepta. */
function decimalSenseExponent(value: number): string {
  const text = String(value);
  if (!/[eE]/.test(text)) return text;

  const [mantissa = '0', exponentText = '0'] = text.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const negatiu = mantissa.startsWith('-');
  const absolut = negatiu ? mantissa.slice(1) : mantissa;
  const [enter = '0', decimals = ''] = absolut.split('.');
  const digits = enter + decimals;
  const punt = enter.length + exponent;
  const decimal =
    punt <= 0
      ? `0.${'0'.repeat(-punt)}${digits}`
      : punt >= digits.length
        ? `${digits}${'0'.repeat(punt - digits.length)}`
        : `${digits.slice(0, punt)}.${digits.slice(punt)}`;
  return `${negatiu ? '-' : ''}${decimal}`;
}

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
    `${decimalSenseExponent(query.from.lat)},${decimalSenseExponent(query.from.lon)}`,
  );
  url.searchParams.set(
    'to',
    `${decimalSenseExponent(query.to.lat)},${decimalSenseExponent(query.to.lon)}`,
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

      return parsed.data.routes.slice(0, query.limit);
    },
  };
}

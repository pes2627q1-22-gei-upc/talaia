import type { PrevisioMeteoHora } from '@talaia/shared';
import { z } from 'zod';

/** Coordenades WGS84 d'un lloc del qual es demana la previsió. */
export type Coordenades = { lat: number; lon: number };

/**
 * Variables horàries d'Open-Meteo: les de TG-95 (núvols, humitat, visibilitat) i les de TG-114
 * (temperatura, punt de rosada, precipitació, vent). Una variable nova va aquí, a `HourlySchema`
 * i al mapatge de `toHores`; el typecheck avisa si en falta alguna.
 * Referència: https://open-meteo.com/en/docs
 */
export const VARIABLES_HORARIES = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'relative_humidity_2m',
  'visibility',
  'temperature_2m',
  'dew_point_2m',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
] as const;

/**
 * Unitats demanades explícitament, perquè el domini (`PrevisioMeteoHora`) no depengui dels valors
 * per defecte de la font: °C, mm i km/h. Els percentatges, els metres i els graus no es configuren.
 */
export const UNITATS = {
  temperature_unit: 'celsius',
  precipitation_unit: 'mm',
  wind_speed_unit: 'kmh',
} as const;

/**
 * Dies de previsió per defecte. Open-Meteo compta els dies de 00:00 a 23:00 UTC: amb 3 dies, la
 * nit de demà passat quedaria tallada a la 01:00 hora local. Amb 4, la nit d'avui i les dues
 * següents hi són senceres.
 */
export const DIES_PREVISIO_PER_DEFECTE = 4;

/** Temps màxim d'espera d'una petició. Sense límit, `fetch` pot quedar penjat minuts. */
export const TIMEOUT_MS_PER_DEFECTE = 15_000;

/**
 * Llocs per petició HTTP. Open-Meteo admet llistes de coordenades i respon amb un lloc per
 * element; cada lloc compta com una crida de la quota (10.000/dia sense clau).
 */
export const LLOCS_PER_PETICIO_PER_DEFECTE = 50;

export type OpenMeteoClientOptions = {
  /** `OPEN_METEO_BASE_URL`, sense barra final (`https://api.open-meteo.com/v1`). */
  baseUrl: string;
  /** Entre 1 i 16. */
  diesPrevisio?: number;
  llocsPerPeticio?: number;
  /** Mil·lisegons abans d'abandonar una petició. */
  timeoutMs?: number;
  /** Injectable als tests. Per defecte, el `fetch` global de Node. */
  fetch?: typeof fetch;
};

export type OpenMeteoClient = {
  /** Previsió horària de cada lloc, en el mateix ordre que `llocs`. */
  previsio(llocs: Coordenades[]): Promise<PrevisioMeteoHora[][]>;
};

/**
 * Error en parlar amb Open-Meteo: xarxa o timeout (sense `status`), HTTP, cos inesperat o
 * resposta incoherent amb la petició.
 */
export class OpenMeteoError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

// Una sèrie horària pot portar `null` quan el model no dóna el valor per a alguna hora.
const Serie = z.array(z.number().nullable());

const HourlySchema = z
  .object({
    /** Amb `timeformat=unixtime`: segons des de l'època, en UTC. */
    time: z.array(z.number()),
    cloud_cover: Serie,
    cloud_cover_low: Serie,
    cloud_cover_mid: Serie,
    cloud_cover_high: Serie,
    relative_humidity_2m: Serie,
    visibility: Serie,
    temperature_2m: Serie,
    dew_point_2m: Serie,
    precipitation: Serie,
    precipitation_probability: Serie,
    wind_speed_10m: Serie,
    wind_gusts_10m: Serie,
    wind_direction_10m: Serie,
  })
  // Les sèries són paral·leles a `time`: una de més curta és una resposta mal formada.
  .refine((hourly) => VARIABLES_HORARIES.every((v) => hourly[v].length === hourly.time.length), {
    message: 'Totes les sèries horàries han de tenir la mateixa llargada que `time`',
  });

const LlocSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: HourlySchema,
});

type Lloc = z.infer<typeof LlocSchema>;

// Amb un sol lloc respon un objecte; amb més d'un, un array en el mateix ordre.
const RespostaSchema = z.union([z.array(LlocSchema), LlocSchema]);

const ErrorSchema = z.object({ error: z.literal(true), reason: z.string() });

/**
 * Converteix les sèries paral·leles d'Open-Meteo en una llista d'hores del domini.
 * L'esquema ja garanteix que totes tenen la llargada de `time`; el `?? null` només tipa l'accés.
 */
export function toHores(hourly: Lloc['hourly']): PrevisioMeteoHora[] {
  return hourly.time.map((segons, i) => ({
    hora: new Date(segons * 1000).toISOString(),
    nuvolsTotal: hourly.cloud_cover[i] ?? null,
    nuvolsBaixos: hourly.cloud_cover_low[i] ?? null,
    nuvolsMitjans: hourly.cloud_cover_mid[i] ?? null,
    nuvolsAlts: hourly.cloud_cover_high[i] ?? null,
    humitat: hourly.relative_humidity_2m[i] ?? null,
    visibilitat: hourly.visibility[i] ?? null,
    temperatura: hourly.temperature_2m[i] ?? null,
    puntRosada: hourly.dew_point_2m[i] ?? null,
    precipitacio: hourly.precipitation[i] ?? null,
    probabilitatPrecipitacio: hourly.precipitation_probability[i] ?? null,
    ventVelocitat: hourly.wind_speed_10m[i] ?? null,
    ventRafegues: hourly.wind_gusts_10m[i] ?? null,
    ventDireccio: hourly.wind_direction_10m[i] ?? null,
  }));
}

export function createOpenMeteoClient(options: OpenMeteoClientOptions): OpenMeteoClient {
  const {
    baseUrl,
    diesPrevisio = DIES_PREVISIO_PER_DEFECTE,
    llocsPerPeticio = LLOCS_PER_PETICIO_PER_DEFECTE,
    timeoutMs = TIMEOUT_MS_PER_DEFECTE,
    fetch: doFetch = fetch,
  } = options;

  if (!Number.isInteger(diesPrevisio) || diesPrevisio < 1 || diesPrevisio > 16) {
    throw new RangeError(`diesPrevisio ha de ser un enter entre 1 i 16 (rebut: ${diesPrevisio})`);
  }
  if (!Number.isInteger(llocsPerPeticio) || llocsPerPeticio < 1) {
    throw new RangeError(`llocsPerPeticio ha de ser un enter positiu (rebut: ${llocsPerPeticio})`);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`timeoutMs ha de ser un nombre positiu (rebut: ${timeoutMs})`);
  }

  function urlPer(llocs: Coordenades[]): URL {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/forecast`);
    url.searchParams.set('latitude', llocs.map((l) => l.lat).join(','));
    url.searchParams.set('longitude', llocs.map((l) => l.lon).join(','));
    url.searchParams.set('hourly', VARIABLES_HORARIES.join(','));
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('forecast_days', String(diesPrevisio));
    for (const [param, unitat] of Object.entries(UNITATS)) url.searchParams.set(param, unitat);
    return url;
  }

  async function demana(llocs: Coordenades[]): Promise<PrevisioMeteoHora[][]> {
    // Un error de xarxa (DNS, connexió tallada) o el timeout surten de `fetch` com a TypeError o
    // DOMException: es tradueixen a OpenMeteoError perquè el worker els tracti igual que la resta.
    const resposta = await doFetch(urlPer(llocs), { signal: AbortSignal.timeout(timeoutMs) }).catch(
      (error: unknown) => {
        const motiu = error instanceof Error ? error.message : String(error);
        throw new OpenMeteoError(`No s'ha pogut contactar amb Open-Meteo: ${motiu}`);
      },
    );
    const cos: unknown = await resposta.json().catch(() => undefined);

    if (!resposta.ok) {
      const error = ErrorSchema.safeParse(cos);
      const motiu = error.success ? error.data.reason : resposta.statusText;
      throw new OpenMeteoError(
        `Open-Meteo ha respost ${resposta.status}: ${motiu}`,
        resposta.status,
      );
    }

    const parsed = RespostaSchema.safeParse(cos);
    if (!parsed.success) {
      throw new OpenMeteoError(
        `Resposta d'Open-Meteo inesperada:\n${z.prettifyError(parsed.error)}`,
        resposta.status,
      );
    }

    const resultats = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    if (resultats.length !== llocs.length) {
      throw new OpenMeteoError(
        `S'han demanat ${llocs.length} llocs i Open-Meteo n'ha retornat ${resultats.length}`,
        resposta.status,
      );
    }
    return resultats.map((lloc) => toHores(lloc.hourly));
  }

  return {
    async previsio(llocs) {
      const resultat: PrevisioMeteoHora[][] = [];
      for (let i = 0; i < llocs.length; i += llocsPerPeticio) {
        resultat.push(...(await demana(llocs.slice(i, i + llocsPerPeticio))));
      }
      return resultat;
    },
  };
}

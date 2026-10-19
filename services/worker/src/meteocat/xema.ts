import type { LecturaXema } from '@talaia/shared';
import { z } from 'zod';

/**
 * Client de l'API de dades mesurades de la XEMA de Meteocat (TG-115, ADR-0025). Cal una clau
 * (`x-api-key`) del pla gratuït «Accés ciutadà i administració». La quota és mensual: el worker
 * només fa una petició per variable i dia per a totes les estacions, i les metadades un cop al mes.
 * Referència: https://apidocs.meteocat.gencat.cat/documentacio/dades-mesurades/
 */
export const URL_BASE_XEMA = 'https://api.meteo.cat/xema/v1';

/**
 * Codis de variable de la XEMA que es contrasten amb la previsió d'Open-Meteo. La XEMA no mesura
 * els núvols: la irradiància solar en fa de testimoni de dia (TG-184). Codis d'un llistat de
 * tercers (oscaromeu/meteocat); cal confirmar-los amb `/variables/mesurades/metadades`.
 */
export const VARIABLES_XEMA = {
  ventVelocitat: 30,
  ventDireccio: 31,
  temperatura: 32,
  humitat: 33,
  precipitacio: 35,
  irradiancia: 36,
} as const satisfies Record<Exclude<keyof LecturaXema, 'estacio' | 'data' | 'validada'>, number>;

export type VariableXema = keyof typeof VARIABLES_XEMA;

export const TIMEOUT_MS_PER_DEFECTE = 30_000;

/** Una estació de la XEMA amb el que cal per triar la més propera a cada punt. */
export type EstacioXema = {
  codi: string;
  nom: string;
  lat: number;
  lon: number;
  altitud: number | null;
};

export type XemaClientOptions = {
  /** `METEOCAT_API_KEY`. */
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Injectable als tests. Per defecte, el `fetch` global de Node. */
  fetch?: typeof fetch;
};

export type XemaClient = {
  /** Estacions operatives en una data (`YYYY-MM-DD`). */
  estacionsOperatives(data: string): Promise<EstacioXema[]>;
  /** Lectures semihoràries d'una variable de totes les estacions en un dia (`YYYY-MM-DD`, UTC). */
  lectures(
    variable: VariableXema,
    data: string,
  ): Promise<Array<{ estacio: string; data: string; valor: number; validada: boolean }>>;
};

/** Error en parlar amb la XEMA: xarxa o timeout (sense `status`), HTTP o cos inesperat. */
export class XemaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'XemaError';
  }
}

const EstacionsSchema = z.array(
  z.object({
    codi: z.string(),
    nom: z.string(),
    coordenades: z.object({ latitud: z.number(), longitud: z.number() }),
    altitud: z.number().nullable().optional(),
  }),
);

const Lectura = z.object({ data: z.string(), valor: z.number(), estat: z.string() });

/** `/variables/mesurades/{codi}/{any}/{mes}/{dia}`: una llista per estació. */
const LecturesSchema = z.array(
  z.object({
    codi: z.string(),
    variables: z.array(z.object({ codi: z.number(), lectures: z.array(Lectura) })),
  }),
);

const ErrorSchema = z.object({ message: z.string() });

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function createXemaClient(options: XemaClientOptions): XemaClient {
  const {
    apiKey,
    baseUrl = URL_BASE_XEMA,
    timeoutMs = TIMEOUT_MS_PER_DEFECTE,
    fetch: doFetch = fetch,
  } = options;
  if (!apiKey) throw new Error('Cal METEOCAT_API_KEY per consultar la XEMA');

  async function demana(ruta: string): Promise<unknown> {
    const url = `${baseUrl.replace(/\/$/, '')}${ruta}`;
    const resposta = await doFetch(url, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((error: unknown) => {
      const motiu = error instanceof Error ? error.message : String(error);
      throw new XemaError(`No s'ha pogut contactar amb la XEMA: ${motiu}`);
    });
    const cos: unknown = await resposta.json().catch(() => undefined);
    if (!resposta.ok) {
      const error = ErrorSchema.safeParse(cos);
      const motiu = error.success ? error.data.message : resposta.statusText;
      throw new XemaError(`La XEMA ha respost ${resposta.status}: ${motiu}`, resposta.status);
    }
    return cos;
  }

  function parseja<T>(schema: z.ZodType<T>, cos: unknown, ruta: string): T {
    const parsed = schema.safeParse(cos);
    if (!parsed.success) {
      throw new XemaError(
        `Resposta inesperada de la XEMA a ${ruta}:\n${z.prettifyError(parsed.error)}`,
        200,
      );
    }
    return parsed.data;
  }

  function dataEnRuta(data: string): string {
    const m = DATA.exec(data);
    if (!m) throw new RangeError(`Data invàlida: "${data}" (format YYYY-MM-DD)`);
    return `${m[1]}/${m[2]}/${m[3]}`;
  }

  return {
    async estacionsOperatives(data) {
      dataEnRuta(data);
      const ruta = `/estacions/metadades?estat=ope&data=${data}Z`;
      return parseja(EstacionsSchema, await demana(ruta), ruta).map((e) => ({
        codi: e.codi,
        nom: e.nom,
        lat: e.coordenades.latitud,
        lon: e.coordenades.longitud,
        altitud: e.altitud ?? null,
      }));
    },

    async lectures(variable, data) {
      const codi = VARIABLES_XEMA[variable];
      const ruta = `/variables/mesurades/${codi}/${dataEnRuta(data)}`;
      const estacions = parseja(LecturesSchema, await demana(ruta), ruta);
      return estacions.flatMap((estacio) =>
        estacio.variables
          .filter((v) => v.codi === codi)
          .flatMap((v) =>
            v.lectures.map((l) => ({
              estacio: estacio.codi,
              // La XEMA dona `2026-10-18T21:30Z`: es normalitza a ISO amb mil·lisegons, com la resta.
              data: new Date(l.data).toISOString(),
              valor: l.valor,
              // «V» és una lectura validada per Meteocat; la resta encara és provisional.
              validada: l.estat === 'V',
            })),
          ),
      );
    },
  };
}

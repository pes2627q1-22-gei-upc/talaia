import type { LecturaXema } from '@talaia/shared';

import {
  VARIABLES_XEMA,
  XemaError,
  type EstacioXema,
  type VariableXema,
  type XemaClient,
} from './xema';

/** Persistència de la XEMA: Kysely a `repository.ts`, en memòria als tests. */
export type XemaRepository = {
  /**
   * Desa (o actualitza) les estacions operatives i marca com a no operatives les que no hi són,
   * sense esborrar-les: les seves lectures passades continuen servint (TG-184).
   */
  desaEstacions(estacions: EstacioXema[]): Promise<void>;
  /** Assigna a cada punt l'estació operativa més propera; torna quants punts en tenen. */
  assignaEstacionsProperes(): Promise<number>;
  /** Codis de les estacions assignades a algun punt: les úniques de les quals es desen lectures. */
  estacionsDelsPunts(): Promise<string[]>;
  /** Desa les lectures; una que ja hi és s'actualitza sense esborrar els valors que no porta. */
  desaLectures(lectures: LecturaXema[]): Promise<void>;
  /** Esborra les lectures anteriors a `abans`. */
  esborraLecturesAnteriors(abans: Date): Promise<void>;
};

export type IngestaXemaDeps = {
  client: XemaClient;
  repository: XemaRepository;
  /** Rellotge injectable als tests. */
  ara?: () => Date;
  /** Si s'activa (aturada del procés), no es demana cap variable més. */
  senyal?: AbortSignal;
};

const DIA_MS = 86_400_000;
/** Les lectures es guarden 90 dies: prou per ajustar l'índex (TG-184) sense fer créixer la BD. */
export const DIES_LECTURES_GUARDATS = 90;
/** m/s (XEMA) → km/h (`LecturaXema`, igual que Open-Meteo). */
const KMH_PER_MS = 3.6;

const diaUtc = (data: Date) => data.toISOString().slice(0, 10);

/**
 * Rang físic de cada variable, el mateix que els `check` de `lectures_xema`. Un valor de fora
 * (una humitat de 101 per un sensor descalibrat) es descarta: no ha de fer perdre la resta del dia.
 */
export const RANGS: Record<VariableXema, [number, number]> = {
  temperatura: [-60, 60],
  humitat: [0, 100],
  precipitacio: [0, 500],
  ventVelocitat: [0, 500],
  ventDireccio: [0, 360],
  irradiancia: [0, 2000],
};

/** Clau rebutjada (401, 403) o quota exhaurida (429): les altres variables fallarien igual. */
const esErrorDeCompte = (error: unknown) =>
  error instanceof XemaError &&
  (error.status === 401 || error.status === 403 || error.status === 429);

/**
 * Actualitza les estacions operatives de la XEMA i torna a triar l'estació més propera a cada
 * punt. Una sola petició: el worker ho fa un cop al mes.
 */
export async function actualitzaEstacionsXema({
  client,
  repository,
  ara = () => new Date(),
}: IngestaXemaDeps): Promise<{ estacions: number; puntsAmbEstacio: number }> {
  const estacions = await client.estacionsOperatives(diaUtc(ara()));
  await repository.desaEstacions(estacions);
  const puntsAmbEstacio = await repository.assignaEstacionsProperes();
  return { estacions: estacions.length, puntsAmbEstacio };
}

export type ResumIngestaXema = {
  dia: string;
  estacions: number;
  lectures: number;
  /** Valors fora del rang físic (`RANGS`) que s'han descartat. */
  descartades: number;
  /** Variables que no s'han pogut baixar (la resta sí que s'han desat). */
  errors: string[];
};

/**
 * Baixa les lectures d'un dia sencer (per defecte, ahir en UTC) de les estacions assignades als
 * punts. Una petició per variable per a totes les estacions: 6 al dia, sigui quin sigui el nombre
 * de punts. Si falla una variable, es desen les altres i l'error queda al resum.
 *
 * El dia és en UTC: el worker ho ha de planificar en UTC i no abans de les 03:00 UTC, perquè la
 * XEMA ja tingui el dia anterior sencer i el canvi d'hora no faci saltar cap dia.
 *
 * Llança un error si no s'ha pogut baixar cap variable, o de seguida si la clau és rebutjada o
 * la quota s'ha exhaurit: en aquests casos no es continua gastant consultes.
 */
export async function ingestaLecturesXema(
  { client, repository, ara = () => new Date(), senyal }: IngestaXemaDeps,
  dia = diaUtc(new Date(ara().getTime() - DIA_MS)),
): Promise<ResumIngestaXema> {
  const estacions = new Set(await repository.estacionsDelsPunts());
  if (estacions.size === 0) return { dia, estacions: 0, lectures: 0, descartades: 0, errors: [] };

  const files = new Map<string, LecturaXema>();
  const errors: string[] = [];
  const variables = Object.keys(VARIABLES_XEMA) as VariableXema[];
  let descartades = 0;
  for (const variable of variables) {
    if (senyal?.aborted) {
      errors.push(`${variable}: aturat abans de demanar-la`);
      continue;
    }
    let lectures;
    try {
      lectures = await client.lectures(variable, dia);
    } catch (error) {
      if (esErrorDeCompte(error)) throw error;
      errors.push(`${variable}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const [minim, maxim] = RANGS[variable];
    for (const lectura of lectures) {
      if (!estacions.has(lectura.estacio)) continue;
      const valor = variable === 'ventVelocitat' ? lectura.valor * KMH_PER_MS : lectura.valor;
      if (valor < minim || valor > maxim) {
        descartades += 1;
        continue;
      }
      const clau = `${lectura.estacio}|${lectura.data}`;
      const fila = files.get(clau) ?? buida(lectura.estacio, lectura.data);
      fila[variable] = valor;
      fila.validada &&= lectura.validada;
      files.set(clau, fila);
    }
  }
  if (errors.length === variables.length) {
    throw new Error(`No s'ha pogut baixar cap variable de la XEMA (${dia}): ${errors.join('; ')}`);
  }

  await repository.desaLectures([...files.values()]);
  await repository.esborraLecturesAnteriors(
    new Date(ara().getTime() - DIES_LECTURES_GUARDATS * DIA_MS),
  );
  return { dia, estacions: estacions.size, lectures: files.size, descartades, errors };
}

function buida(estacio: string, data: string): LecturaXema {
  return {
    estacio,
    data,
    temperatura: null,
    humitat: null,
    precipitacio: null,
    ventVelocitat: null,
    ventDireccio: null,
    irradiancia: null,
    validada: true,
  };
}

import type { LecturaXema } from '@talaia/shared';

import { VARIABLES_XEMA, type EstacioXema, type VariableXema, type XemaClient } from './xema';

/** Persistència de la XEMA: Kysely a `repository.ts`, en memòria als tests. */
export type XemaRepository = {
  /** Desa (o actualitza) les estacions operatives. */
  desaEstacions(estacions: EstacioXema[]): Promise<void>;
  /** Assigna a cada punt l'estació desada més propera; torna quants punts en tenen. */
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
};

const DIA_MS = 86_400_000;
/** Les lectures es guarden 90 dies: prou per ajustar l'índex (TG-184) sense fer créixer la BD. */
export const DIES_LECTURES_GUARDATS = 90;
/** m/s (XEMA) → km/h (`LecturaXema`, igual que Open-Meteo). */
const KMH_PER_MS = 3.6;

const diaUtc = (data: Date) => data.toISOString().slice(0, 10);

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
  /** Variables que no s'han pogut baixar (la resta sí que s'han desat). */
  errors: string[];
};

/**
 * Baixa les lectures d'un dia sencer (per defecte, ahir en UTC) de les estacions assignades als
 * punts. Una petició per variable per a totes les estacions: 6 al dia, sigui quin sigui el nombre
 * de punts. Si falla una variable, es desen les altres i l'error queda al resum.
 */
export async function ingestaLecturesXema(
  { client, repository, ara = () => new Date() }: IngestaXemaDeps,
  dia = diaUtc(new Date(ara().getTime() - DIA_MS)),
): Promise<ResumIngestaXema> {
  const estacions = new Set(await repository.estacionsDelsPunts());
  if (estacions.size === 0) return { dia, estacions: 0, lectures: 0, errors: [] };

  const files = new Map<string, LecturaXema>();
  const errors: string[] = [];
  for (const variable of Object.keys(VARIABLES_XEMA) as VariableXema[]) {
    let lectures;
    try {
      lectures = await client.lectures(variable, dia);
    } catch (error) {
      errors.push(`${variable}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const lectura of lectures) {
      if (!estacions.has(lectura.estacio)) continue;
      const clau = `${lectura.estacio}|${lectura.data}`;
      const fila = files.get(clau) ?? buida(lectura.estacio, lectura.data);
      fila[variable] = variable === 'ventVelocitat' ? lectura.valor * KMH_PER_MS : lectura.valor;
      fila.validada &&= lectura.validada;
      files.set(clau, fila);
    }
  }

  await repository.desaLectures([...files.values()]);
  await repository.esborraLecturesAnteriors(
    new Date(ara().getTime() - DIES_LECTURES_GUARDATS * DIA_MS),
  );
  return { dia, estacions: estacions.size, lectures: files.size, errors };
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

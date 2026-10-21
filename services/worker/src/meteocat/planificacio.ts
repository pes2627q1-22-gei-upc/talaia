import { actualitzaEstacionsXema, ingestaLecturesXema, type XemaRepository } from './ingesta';
import type { XemaClient } from './xema';

/**
 * Lectures d'ahir cada dia a les 06:15 UTC: la XEMA ja té el dia anterior sencer i, en UTC, el
 * canvi d'hora no fa saltar cap dia (ADR-0025).
 */
export const PLANIFICACIO_LECTURES = '15 6 * * *';
/** Estacions el dia 1 de cada mes, abans de les lectures perquè ja facin servir les noves. */
export const PLANIFICACIO_ESTACIONS = '0 6 1 * *';

/** La part de node-cron que es fa servir: injectable als tests. */
export type Programa = (
  expressio: string,
  tasca: () => void,
  opcions: { name: string; timezone: string },
) => { stop(): unknown };

export type PlanificacioXemaDeps = {
  /** `undefined` si no hi ha `METEOCAT_API_KEY`: llavors no es planifica res. */
  xema?: {
    client: XemaClient;
    repository: XemaRepository;
    /** Si `estacions_xema` té alguna fila. Si és buida, s'actualitzen les estacions en arrencar. */
    hiHaEstacions(): Promise<boolean>;
  };
  programa: Programa;
};

export type PlanificacioXema = {
  /** Atura els crons i espera la tasca en curs; no en comença cap més. */
  atura(): Promise<void>;
};

/**
 * Planifica la ingesta de la XEMA (TG-115) al procés del worker. Les dues tasques comparteixen un
 * executor: mai no van a la vegada, i un error queda al log sense aturar el procés.
 */
export function planificaXema({ xema, programa }: PlanificacioXemaDeps): PlanificacioXema {
  if (!xema) {
    console.warn("[worker] sense METEOCAT_API_KEY: no s'ingesten les observacions de la XEMA");
    return { atura: () => Promise.resolve() };
  }
  const { client, repository, hiHaEstacions } = xema;
  const aturada = new AbortController();
  let enCurs: Promise<void> | undefined;

  const executa = (motiu: string, feina: () => Promise<void>) => {
    if (aturada.signal.aborted) return Promise.resolve();
    if (enCurs) {
      console.warn(`[worker] xema ${motiu}: la tasca anterior encara no ha acabat, se salta`);
      return enCurs;
    }
    enCurs = feina()
      .catch((error: unknown) => {
        console.error(`[worker] xema ${motiu}: ha fallat`, error);
      })
      .finally(() => {
        enCurs = undefined;
      });
    return enCurs;
  };

  const estacions = async () => {
    const { estacions, puntsAmbEstacio } = await actualitzaEstacionsXema({ client, repository });
    console.log(`[worker] xema: ${estacions} estacions, ${puntsAmbEstacio} punts amb estació`);
  };
  const lectures = async () => {
    const resum = await ingestaLecturesXema({ client, repository, senyal: aturada.signal });
    console.log(
      `[worker] xema: ${resum.lectures} lectures del ${resum.dia} (${resum.estacions} estacions, ${resum.descartades} descartades)`,
    );
    for (const error of resum.errors) console.error(`[worker] xema ${resum.dia}: ${error}`);
  };

  const tasques = [
    programa(PLANIFICACIO_ESTACIONS, () => void executa('estacions', estacions), {
      name: 'xema-estacions',
      timezone: 'UTC',
    }),
    programa(PLANIFICACIO_LECTURES, () => void executa('lectures', lectures), {
      name: 'xema-lectures',
      timezone: 'UTC',
    }),
  ];
  void executa('arrencada', async () => {
    if (!(await hiHaEstacions())) await estacions();
  });
  console.log(
    `[worker] xema: lectures a «${PLANIFICACIO_LECTURES}» i estacions a «${PLANIFICACIO_ESTACIONS}» (UTC)`,
  );

  return {
    async atura() {
      for (const tasca of tasques) await tasca.stop();
      aturada.abort();
      await enCurs;
    },
  };
}

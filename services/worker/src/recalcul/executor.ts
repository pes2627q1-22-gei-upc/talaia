import type { ResumRecalcul } from './recalcul';

export type Executor = {
  /** Llança una execució. Si l'anterior encara no ha acabat o el procés s'atura, no fa res. */
  executa(motiu: string): Promise<void>;
  /** Demana a l'execució en curs que no comenci més lots i n'espera el final. */
  atura(): Promise<void>;
};

/**
 * El que fa `main.ts` a cada hora, separat dels efectes en importar-lo (cron, pool, senyals)
 * perquè es pugui provar: sense solapaments, els errors no aturen el procés i l'aturada espera.
 */
export function createExecutor(
  recalcula: (senyal: AbortSignal) => Promise<ResumRecalcul>,
): Executor {
  const aturada = new AbortController();
  let enCurs: Promise<void> | undefined;

  return {
    executa(motiu) {
      if (aturada.signal.aborted) return Promise.resolve();
      if (enCurs) {
        console.warn(`[worker] ${motiu}: l'execució anterior encara no ha acabat, se salta`);
        return enCurs;
      }
      enCurs = recalcula(aturada.signal)
        .then(({ punts, hores, iniciadaEl, acabadaEl, notificacions }) => {
          const segons = (acabadaEl.getTime() - iniciadaEl.getTime()) / 1000;
          const alertes =
            notificacions === undefined ? '' : `; notificacions d'alertes noves: ${notificacions}`;
          console.log(
            `[worker] ${motiu}: índex de ${punts} punts (${hores} hores) en ${segons} s${alertes}`,
          );
        })
        .catch((error: unknown) => {
          // L'error ja és a `execucions_worker`; es torna a provar a l'hora següent.
          console.error(`[worker] ${motiu}: el recàlcul ha fallat`, error);
        })
        .finally(() => {
          enCurs = undefined;
        });
      return enCurs;
    },
    async atura() {
      aturada.abort();
      await enCurs;
    },
  };
}

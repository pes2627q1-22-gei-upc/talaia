/**
 * Procés llarg del worker (TG-99, ADR-0024): recalcula l'índex en arrencar i cada hora amb
 * node-cron, dins del contenidor. És el `CMD` del Dockerfile (`dist/main.js`).
 *
 *   npm run start -w services/worker          # cal DATABASE_URL al .env de l'arrel
 */
import { createDb } from '@talaia/db';
import cron from 'node-cron';

import { loadEnv } from './config/env';
import { createOpenMeteoClient } from './meteo/openMeteo';
import { recalculaIndex } from './recalcul/recalcul';
import { createKyselyRecalculRepositories } from './recalcul/repository';

/** Al minut 5 de cada hora: Open-Meteo ja ha publicat el model de l'hora en punt. */
export const PLANIFICACIO = '5 * * * *';

const env = loadEnv();
if (!env.DATABASE_URL) {
  throw new Error("El worker necessita DATABASE_URL per desar l'índex");
}

const db = createDb(env.DATABASE_URL, { max: 2 });
const deps = {
  ...createKyselyRecalculRepositories(db),
  meteo: createOpenMeteoClient({ baseUrl: env.OPEN_METEO_BASE_URL }),
};

let enCurs: Promise<void> | undefined;

/** Una execució; si l'anterior encara no ha acabat, aquesta se salta. */
function executa(motiu: string): Promise<void> {
  if (enCurs) {
    console.warn(`[worker] ${motiu}: l'execució anterior encara no ha acabat, se salta`);
    return enCurs;
  }
  enCurs = recalculaIndex(deps)
    .then(({ punts, hores, iniciadaEl, acabadaEl }) => {
      const segons = (acabadaEl.getTime() - iniciadaEl.getTime()) / 1000;
      console.log(`[worker] ${motiu}: índex de ${punts} punts (${hores} hores) en ${segons} s`);
    })
    .catch((error: unknown) => {
      // L'error ja és a `execucions_worker`; el procés continua i ho torna a provar d'aquí a una hora.
      console.error(`[worker] ${motiu}: el recàlcul ha fallat`, error);
    })
    .finally(() => {
      enCurs = undefined;
    });
  return enCurs;
}

const tasca = cron.schedule(PLANIFICACIO, () => void executa('hora'), {
  name: 'recalcul-index',
  timezone: 'Europe/Madrid',
});
void executa('arrencada');
console.log(`[worker] en marxa: recàlcul de l'índex a «${PLANIFICACIO}» (Europe/Madrid)`);

// Docker envia SIGTERM en aturar el contenidor: s'espera l'execució en curs i es tanca el pool.
for (const senyal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(senyal, () => {
    console.log(`[worker] ${senyal}: aturant`);
    void tasca.stop();
    void Promise.resolve(enCurs)
      .then(() => db.destroy())
      .finally(() => process.exit(0));
  });
}

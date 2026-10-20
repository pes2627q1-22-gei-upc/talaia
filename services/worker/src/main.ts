/**
 * Procés llarg del worker (TG-99, ADR-0024): recalcula l'índex en arrencar i cada hora amb
 * node-cron, dins del contenidor. És el `CMD` del Dockerfile (`dist/main.js`). La lògica és a
 * `recalcul/`; aquí només hi ha el cablejat (pool, cron i senyals).
 *
 *   npm run start -w services/worker          # cal DATABASE_URL al .env de l'arrel
 */
import { createDb } from '@talaia/db';
import cron from 'node-cron';

import { loadEnv } from './config/env';
import { createOpenMeteoClient } from './meteo/openMeteo';
import { createExecutor } from './recalcul/executor';
import { PUNTS_PER_LOT, recalculaIndex } from './recalcul/recalcul';
import { createKyselyRecalculRepositories } from './recalcul/repository';

/**
 * Al minut 5 de cada hora: Open-Meteo ja ha publicat el model de l'hora en punt. En UTC: amb
 * l'hora de Catalunya, node-cron se salta una execució en el canvi d'hora d'octubre.
 */
export const PLANIFICACIO = '5 * * * *';

const env = loadEnv();
if (!env.DATABASE_URL) {
  throw new Error("El worker necessita DATABASE_URL per desar l'índex");
}

// Amb timeouts: una BD que accepta la connexió i no respon no pot deixar l'execució penjada.
const db = createDb(env.DATABASE_URL, {
  max: 2,
  connectionTimeoutMillis: 10_000,
  queryTimeoutMillis: 30_000,
});
const meteo = createOpenMeteoClient({
  baseUrl: env.OPEN_METEO_BASE_URL,
  llocsPerPeticio: PUNTS_PER_LOT,
  timeoutMs: 30_000,
});
const executor = createExecutor((senyal) =>
  recalculaIndex({ ...createKyselyRecalculRepositories(db), meteo, senyal }),
);

const tasca = cron.schedule(PLANIFICACIO, () => void executor.executa('hora'), {
  name: 'recalcul-index',
  timezone: 'UTC',
});
void executor.executa('arrencada');
console.log(`[worker] en marxa: recàlcul de l'índex a «${PLANIFICACIO}» (UTC)`);

// Docker envia SIGTERM en aturar el contenidor (`stop_grace_period` al compose): no es comença
// cap lot més, s'espera el que està en curs i es tanca el pool.
for (const senyal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(senyal, () => {
    console.log(`[worker] ${senyal}: aturant`);
    void tasca.stop();
    void executor
      .atura()
      .then(() => db.destroy())
      .finally(() => process.exit(0));
  });
}

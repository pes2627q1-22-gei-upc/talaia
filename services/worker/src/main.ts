/**
 * Procés llarg del worker (TG-99, ADR-0024): recalcula l'índex en arrencar i cada hora amb
 * node-cron, dins del contenidor, i després avalua les alertes i n'envia les notificacions (TG-153, TG-154, ADR-0033). És el `CMD` del
 * Dockerfile (`dist/main.js`). La lògica és a `recalcul/`, a `alertes/` i, la de la XEMA, a
 * `meteocat/planificacio.ts`; aquí només hi ha el cablejat (pool, cron i senyals).
 *
 *   npm run start -w services/worker          # cal DATABASE_URL al .env de l'arrel
 */
import { createDb } from '@talaia/db';
import { createOpenMeteoClient } from '@talaia/index';
import cron from 'node-cron';

import { createAlertsStep } from './alertes/avaluacio';
import { createKyselyEnviamentRepository } from './alertes/enviamentRepository';
import { createExpoPushClient } from './alertes/expoPush';
import { createKyselyAlertesRepository } from './alertes/repository';
import { loadEnv } from './config/env';
import { DIES_BIAIX, ajustaHumitatXema } from './meteocat/ajust';
import { planificaXema } from './meteocat/planificacio';
import { createKyselyXemaRepository } from './meteocat/repository';
import { createXemaClient } from './meteocat/xema';
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
// Les alertes s'avaluen dins de cada execució, amb l'índex ja desat, i, amb `ENVIA_PUSH=true`, les
// notificacions pendents s'envien per Expo Push (TG-154).
const alertes = createAlertsStep(
  createKyselyAlertesRepository(db),
  env.ENVIA_PUSH
    ? {
        repository: createKyselyEnviamentRepository(db),
        push: createExpoPushClient({ accessToken: env.EXPO_ACCESS_TOKEN }),
      }
    : undefined,
);
if (!env.ENVIA_PUSH) console.log('[worker] ENVIA_PUSH no és true: no s’envien notificacions push');
const executor = createExecutor((senyal) =>
  recalculaIndex({ ...createKyselyRecalculRepositories(db), meteo, alertes, senyal }),
);

const tasca = cron.schedule(PLANIFICACIO, () => void executor.executa('hora'), {
  name: 'recalcul-index',
  timezone: 'UTC',
});
void executor.executa('arrencada');
console.log(`[worker] en marxa: recàlcul de l'índex a «${PLANIFICACIO}» (UTC)`);

// Open-Meteo dels dies passats, per mesurar el biaix de la humitat a les estacions (TG-184,
// ADR-0037): una petició per estació i dia, no una previsió.
const meteoPassat = createOpenMeteoClient({
  baseUrl: env.OPEN_METEO_BASE_URL,
  diesPrevisio: 0,
  diesPassats: DIES_BIAIX,
  timeoutMs: 30_000,
});

// Observacions de la XEMA (TG-115, ADR-0025): només amb la clau de Meteocat, amb el mateix pool.
const xema = planificaXema({
  xema: env.METEOCAT_API_KEY
    ? (() => {
        const repository = createKyselyXemaRepository(db);
        return {
          client: createXemaClient({ apiKey: env.METEOCAT_API_KEY }),
          repository,
          hiHaEstacions: async () =>
            (await db.selectFrom('estacionsXema').select('codi').limit(1).executeTakeFirst()) !==
            undefined,
          ajustaHumitat: (ara: Date) => ajustaHumitatXema({ meteo: meteoPassat, repository, ara }),
        };
      })()
    : undefined,
  programa: (expressio, tasca, opcions) => cron.schedule(expressio, tasca, opcions),
});

// Docker envia SIGTERM en aturar el contenidor (`stop_grace_period` al compose): no es comença
// cap lot més, s'espera el que està en curs i es tanca el pool.
for (const senyal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(senyal, () => {
    console.log(`[worker] ${senyal}: aturant`);
    void tasca.stop();
    void Promise.all([executor.atura(), xema.atura()])
      .then(() => db.destroy())
      .finally(() => process.exit(0));
  });
}

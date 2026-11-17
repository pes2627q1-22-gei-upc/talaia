import { createDb } from '@talaia/db';
import { createOpenMeteoClient } from '@talaia/index';

import { createDatabaseAlertesStore } from './alertes/alertesRepository';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createEsdevenimentsRepository } from './esdeveniments/esdevenimentsRepository';
import { createEsdevenimentsService } from './esdeveniments/esdevenimentsService';
import { createFavoritsRepository } from './favorits/favoritsRepository';
import { createFavoritsService } from './favorits/favoritsService';
import { createBreakdownService } from './index/breakdownService';
import { createPuntsRepository } from './punts/puntsRepository';
import { createDefaultPuntsService } from './punts/puntsService';
import { createRecomanacionsRepository } from './recomanacions/recomanacionsRepository';
import { createRecomanacionsService } from './recomanacions/recomanacionsService';
import { createDatabaseProfileStore } from './services/profileService';
import { createSqmRepository } from './visibilitat/sqmRepository';
import { createVisibilitatService } from './visibilitat/visibilitatService';

const env = loadEnv();

let punts;
let breakdown;
let recomanacions;
let profileStore;
let alertes;
let esdeveniments;
let favorits;
let sqm;
if (env.DATABASE_URL) {
  // Un sol pool per a tota l'API.
  // Per sota del timeout de 15 s de l'app: la ruta respon un error abans que l'app talli.
  const db = createDb(env.DATABASE_URL, {
    max: 5,
    connectionTimeoutMillis: 5_000,
    queryTimeoutMillis: 8_000,
  });
  const puntsRepository = createPuntsRepository(db);
  punts = createDefaultPuntsService(puntsRepository);
  breakdown = createBreakdownService(puntsRepository);
  const esdevenimentsRepository = createEsdevenimentsRepository(db);
  recomanacions = createRecomanacionsService(
    createRecomanacionsRepository(db),
    undefined,
    esdevenimentsRepository,
  );
  profileStore = createDatabaseProfileStore(db);
  alertes = createDatabaseAlertesStore(db);
  esdeveniments = createEsdevenimentsService(esdevenimentsRepository);
  favorits = createFavoritsService(createFavoritsRepository(db));
  sqm = createSqmRepository(db);
} else {
  console.warn(
    'Avís: sense DATABASE_URL. /api/v1/health funciona, però /api/v1/punts, /api/v1/punts/{id}/index, /api/v1/recomanacions, /api/v1/perfil, /api/v1/alertes, /api/v1/favorits i /api/v1/esdeveniments responen 503. /api/v1/visibilitat funciona amb la foscor estimada.',
  );
}

// No necessita la base de dades: sense, la foscor de qualsevol ubicació és estimada (ADR-0031).
// Timeout de 5 s: la resposta ha d'arribar en menys de 3 s (HU05), però una d'Open-Meteo lenta és
// millor que un error.
const visibilitat = createVisibilitatService({
  meteo: createOpenMeteoClient({ baseUrl: env.OPEN_METEO_BASE_URL, timeoutMs: 5_000 }),
  sqmProper: sqm?.sqmProper,
});

createApp({
  punts,
  breakdown,
  recomanacions,
  visibilitat,
  profileStore,
  alertes,
  esdeveniments,
  favorits,
}).listen(env.API_PORT, (error) => {
  if (error) throw error;
  console.log(`Talaia API a http://localhost:${env.API_PORT}/api/v1 (docs: /api/v1/docs)`);
});

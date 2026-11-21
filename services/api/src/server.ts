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
import { createMobilicatRoutesClient, MOBILICAT_ROUTES_TIMEOUT_MS } from './mobilicat/routesClient';
import { createRutesService } from './mobilicat/rutesService';
import type { RutesService } from './mobilicat/rutesService';
import { createPuntsAdminRepository } from './punts/puntsAdminRepository';
import { createPuntsAdminService } from './punts/puntsAdminService';
import { createPlansRepository } from './plans/plansRepository';
import { createPlansService } from './plans/plansService';
import { createPuntsRepository } from './punts/puntsRepository';
import { createDefaultPuntsService } from './punts/puntsService';
import { createRecomanacionsRepository } from './recomanacions/recomanacionsRepository';
import { createRecomanacionsService } from './recomanacions/recomanacionsService';
import { createDatabaseProfileStore } from './services/profileService';
import { createDatabasePushDeviceStore } from './services/pushDeviceService';
import { createSqmRepository } from './visibilitat/sqmRepository';
import { createVisibilitatService } from './visibilitat/visibilitatService';

const env = loadEnv();

let punts;
let breakdown;
let recomanacions;
let puntsAdmin;
let profileStore;
let alertes;
let dispositius;
let esdeveniments;
let favorits;
let rutes: RutesService | undefined;
let plans;
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
  // Cada canvi de l'administració descarta el document del mapa (TG-174).
  puntsAdmin = createPuntsAdminService(createPuntsAdminRepository(db), { mapa: punts });
  breakdown = createBreakdownService(puntsRepository);
  rutes = createRutesService(
    puntsRepository,
    createMobilicatRoutesClient({
      baseUrl: env.MOBILICAT_ROUTES_BASE_URL,
      timeoutMs: MOBILICAT_ROUTES_TIMEOUT_MS,
    }),
  );
  const esdevenimentsRepository = createEsdevenimentsRepository(db);
  recomanacions = createRecomanacionsService(
    createRecomanacionsRepository(db),
    undefined,
    esdevenimentsRepository,
  );
  profileStore = createDatabaseProfileStore(db);
  alertes = createDatabaseAlertesStore(db);
  dispositius = createDatabasePushDeviceStore(db);
  esdeveniments = createEsdevenimentsService(esdevenimentsRepository);
  favorits = createFavoritsService(createFavoritsRepository(db));
  plans = createPlansService(createPlansRepository(db));
  sqm = createSqmRepository(db);
} else {
  console.warn(
    'Avís: sense DATABASE_URL. /api/v1/health funciona, però /api/v1/punts, /api/v1/punts/{id}, /api/v1/punts/{id}/index, /api/v1/punts/{id}/rutes, /api/v1/recomanacions, /api/v1/perfil (i /perfil/dispositius), /api/v1/admin, /api/v1/alertes, /api/v1/favorits, /api/v1/plans i /api/v1/esdeveniments responen 503. /api/v1/visibilitat funciona amb la foscor estimada.',
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
  puntsAdmin,
  visibilitat,
  profileStore,
  alertes,
  dispositius,
  esdeveniments,
  favorits,
  rutes,
  plans,
}).listen(env.API_PORT, (error) => {
  if (error) throw error;
  console.log(`Talaia API a http://localhost:${env.API_PORT}/api/v1 (docs: /api/v1/docs)`);
});
